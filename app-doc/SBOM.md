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

Requires npm ≥ 10 (ships with Node 20+).

## Release artifact naming

| File | Description |
|------|-------------|
| `sbom-v1.0.0.cdx.json` | CycloneDX SBOM for release tag `v1.0.0` |

SBOM files are attached to the GitHub Release matching the same `vMajor.Minor.Patch` tag.

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

## Versioning policy

Tags follow **`vMajor.Minor.Patch`** (semver, e.g. `v1.2.0`).
The release pipeline reads the tag name, strips the `v` prefix, and stamps it into
`package.json` via `npm version` before building — so every packaged binary carries
the correct version string.

All release artifacts (installers, SBOM files, CI reports) reference the same tag so they
remain fully traceable across GitHub Releases, the Actions run log, and the SBOM.
