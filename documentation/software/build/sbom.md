# Software Bill of Materials (SBOM)

How MyNote produces, checks and scans its SBOM: one CycloneDX file per release, a CI check that keeps the generation working, and a nightly vulnerability scan of the latest release.

## Release SBOM

Every release ships one machine-readable SBOM in **CycloneDX JSON**, named `sbom-vMajor.Minor.Patch.cdx.json` after its tag. The `sbom` job of [`release.yml`](../../../.github/workflows/release.yml) builds it from the lockfile, checks that it is well-formed and hands it to the `release` job, which attaches it to the draft GitHub Release beside the installers (see [Build and release](build-and-release.md)). The job is mandatory: the `release` job needs it, so a release without an SBOM cannot be created.

- `application/package-lock.json` is the single source. Always commit it and never add it to `.gitignore`; CI runs `npm ci`, which installs exactly the locked versions.
- The job stamps the tag's version into `package.json` first, so the root component of the SBOM matches the release.
- `npm sbom --package-lock-only` reads the lockfile directly, so the job needs no `npm ci` and the result is the same on every platform.

## Generate locally

```bash
cd application
npm sbom --sbom-format cyclonedx --package-lock-only > sbom-local.cdx.json
```

This needs the npm that comes with the pinned Node; `engines` in `application/package.json` require npm 11 or newer (see [Build and release](build-and-release.md)).

## CI check

`ci.yml` runs the same command, with the output discarded, as the step "Check SBOM generation". A broken lockfile therefore fails the pull request and not the release on the tag.

### `ESBOMPROBLEMS` / `missing: … required by @tailwindcss/oxide-wasm32-wasi`

`@tailwindcss/oxide-wasm32-wasi` is an optional platform package that **bundles** its dependencies (`bundleDependencies`). npm records bundled dependencies in the lockfile only when it extracts the tarball, which never happens on x64 or arm64 machines. `npm sbom --package-lock-only` then sees unresolved edges and aborts.

Fix: re-resolve the lockfile once as if on wasm32. That records the bundled entries (`node_modules/@tailwindcss/oxide-wasm32-wasi/node_modules/*`) and changes nothing else.

```bash
cd application
npm install --ignore-scripts --cpu=wasm32
npm ci                          # restore the normal node_modules for this platform
```

Normal `npm install` and `npm ci` keep these entries. They are typically lost when the Tailwind version changes, so repeat the fix after a Tailwind upgrade if CI flags it. Do not use `npm sbom --omit=optional` instead: it also drops non-optional packages (`@tiptap/pm`, `prosemirror-*`, `undici`, ...) from the SBOM.

## Nightly vulnerability scan

[`nightly-sbom-scan.yml`](../../../.github/workflows/nightly-sbom-scan.yml) runs every night at 03:17 UTC (and on demand) against the SBOM of the latest release tag. The tag is the highest `vMajor.Minor.Patch` by semver, whatever the draft status of its GitHub Release. Without a tag the run only prints a notice.

The last step, "Fail run when vulnerabilities were found", turns the run red when the scanners report any finding; archiving the reports can never do that (see below). A failed tool install, SBOM check or count parsing fails the run as well. Findings go to the job summary and to a GitHub issue labelled `sbom-scan`, one per release tag; a later run with findings updates that issue instead of opening a second one.

### Obtaining the SBOM

The scan takes the SBOM asset of the release first. If that download fails, for example while the release is still a draft, the step regenerates the SBOM from the tag's `package-lock.json`; `npm sbom` is deterministic from the lockfile, so the result describes the same dependency set.

### Four scanners

Each tool draws on a different advisory feed, so running all four catches advisories that a single source misses.

| Scanner | Data source |
|---|---|
| Grype | NVD and vendor feeds |
| OSV-Scanner | OSV.dev and GHSA |
| Trivy | NVD, Red Hat, Debian and GHSA |
| `npm audit` (on the lockfile) | GitHub Advisory Database |

### Report retention

Reports are archived only when there is something to read, and only as a best effort.

- On a clean night every report is a list of zeros that the summary already states, and the SBOM is reproducible from the tag. The upload is skipped, so quiet nights cost no storage.
- With findings, the reports are uploaded as one artifact named `sbom-scan-reports-` plus the tag, with a retention of 14 days.
- Artifacts are immutable: a later run that uploads the same name adds a copy. The step "Purge superseded scan artifacts" therefore deletes the earlier `sbom-scan-reports-*` artifacts first, so the workflow holds one run's reports and not one per night.
- Both steps are `continue-on-error`. A full storage quota never turns a scan red; a failed upload is noted in the summary and the scanner counts stay the result.

## Updating dependencies

```bash
cd application
npm update       # within the declared semver ranges
npm audit        # known vulnerabilities in the lockfile
```

Commit the updated `package-lock.json`. A vulnerable transitive package can be pinned with an entry under `overrides` in `application/package.json`, as the existing entries are.

## Versioning

Tags follow `vMajor.Minor.Patch` (semver). The release workflow stamps the tag's number into `package.json` with `npm version` before it builds, so installers, SBOM and runtime-version files all refer to the same tag.
