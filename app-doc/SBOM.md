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
npm sbom --format cyclonedx-json --package-lock-only > sbom-local.cdx.json
```

Requires npm ≥ 11 (ships with Node 26+). See [`runtime-versions.md`](./runtime-versions.md) for pinned version details.

## Release artifact naming

| File | Description |
|------|-------------|
| `sbom-v1.0.0.cdx.json` | CycloneDX SBOM for release tag `v1.0.0` |

SBOM files are attached to the GitHub Release matching the same `vMajor.Minor.Patch` tag.

## Nightly vulnerability scan

The [`nightly-sbom-scan.yml`](../.github/workflows/nightly-sbom-scan.yml) workflow runs every
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
