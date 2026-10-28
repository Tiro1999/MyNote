# Software Bill of Materials (SBOM)

## Policy

Every MyNote release ships with a machine-readable SBOM in **CycloneDX JSON** format.
The SBOM is generated automatically by the release pipeline and attached to the GitHub Release
alongside the platform installers.

## Source of truth

**`application/package-lock.json`** is the locked dependency manifest.

> ⚠️ Always commit `package-lock.json`. CI runs `npm ci` (not `npm install`), so it always
> installs the exact locked versions. **Never add `package-lock.json` to `.gitignore`.**

## Generate locally

```bash
cd application
npm sbom --sbom-format cyclonedx --package-lock-only > sbom-local.cdx.json
```

Requires npm ≥ 11 (ships with Node 26+). See [`runtime-versions.md`](./runtime-versions.md) for pinned version details.

### Troubleshooting: `ESBOMPROBLEMS` / `missing: … required by @tailwindcss/oxide-wasm32-wasi`

`@tailwindcss/oxide-wasm32-wasi` is an optional platform package that **bundles** its
dependencies (`bundleDependencies`). npm only records bundled deps in the lockfile when it
actually extracts the tarball — which never happens on x64/arm64 machines. `npm sbom
--package-lock-only` then sees unresolved edges and aborts. CI runs the same check, so this
surfaces in the PR, not on the release tag.

Fix: re-resolve the lockfile once *as if* on wasm32, which records the bundled entries
(`node_modules/@tailwindcss/oxide-wasm32-wasi/node_modules/*`) without changing anything else:

```bash
cd application
npm install --ignore-scripts --cpu=wasm32
npm ci                          # restore the normal node_modules for this platform
```

Normal `npm install`/`npm ci` keep these entries. They are typically lost again when the
Tailwind version changes, so repeat the fix after a Tailwind upgrade if CI flags it.
Do **not** use `npm sbom --omit=optional` as a workaround — it also drops non-optional
packages (`@tiptap/pm`, `prosemirror-*`, `undici`, …) from the SBOM.

## Release artifact naming

| File | Description |
|------|-------------|
| `sbom-v1.0.0.cdx.json` | CycloneDX SBOM for release tag `v1.0.0` |

SBOM files are attached to the GitHub Release matching the same `vMajor.Minor.Patch` tag.

## Nightly vulnerability scan

The [`nightly-sbom-scan.yml`](../../../.github/workflows/nightly-sbom-scan.yml) workflow runs every
night against the SBOM of the **most recent release tag**. It scans with
[Grype](https://github.com/anchore/grype) and, when vulnerabilities are found, fails the run
and opens/updates a GitHub issue labeled `sbom-scan` with a per-package findings table.
It prefers the SBOM asset attached to the published release and falls back to regenerating
the SBOM from the tag's `package-lock.json` (identical content) while a release is still a draft.

## Updating dependencies

```bash
cd application
npm update                      # update within declared semver ranges
npm audit fix                   # patch known vulnerabilities
# commit the updated package-lock.json
```

Run before each release:

```bash
npm audit                       # check for known vulnerabilities
npx license-checker --summary   # review license compliance across all deps
```

## Runtime environment

The Node.js runtime, npm, and V8 versions used for every build are recorded in
`application/runtime-versions.txt` and uploaded as a CI/release artifact.
See [`runtime-versions.md`](./runtime-versions.md) for the pinning policy and update instructions.

## Versioning policy

Tags follow **`vMajor.Minor.Patch`** (semver, e.g. `v1.2.0`).
The release pipeline reads the tag name, strips the `v` prefix, and stamps it into
`package.json` via `npm version` before building — so every packaged binary carries
the correct version string.

All release artifacts (installers, SBOM files, CI reports) reference the same tag so they
remain fully traceable across GitHub Releases, the Actions run log, and the SBOM.
