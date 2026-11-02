# Runtime Versions

This file is the **source of truth** for the fixed runtime environment used across
development, CI, and release builds. Update this table whenever the pinned versions change,
and commit the change together with any updated `package-lock.json`.

---

## Single source of truth

| What | File | How it's consumed |
|------|------|--------------------|
| **Node.js** (exact version) | **`.nvmrc`** (repo root) | nvm · `actions/setup-node node-version-file` (CI, release, nightly scan) |
| **Node.js** (exact version, Docker copy) | **`ARG NODE_VERSION`** top of `.devcontainer/Dockerfile` and `docker/Dockerfile.ci` | `FROM node:${NODE_VERSION}-bookworm[-slim]` — **must equal `.nvmrc`** |
| **Node.js** (security floor) | **`engines.node`** in `application/package.json` (+ lockfile root) | npm warns (`EBADENGINE`) when the local Node is older |
| **npm major** | **`ARG NPM_VERSION`** top of both Dockerfiles | `RUN npm install -g npm@${NPM_VERSION}` · documents `engines.npm` in `package.json` |

> To upgrade Node, change `.nvmrc` **and** the `ARG NODE_VERSION` of both Dockerfiles to the same
> exact version, raise `engines.node` when a security fix sets a new floor, then rebuild the
> devcontainer. Node is pinned to an **exact patch version** on purpose: a major-only pin
> (`26`) let stale Docker layers and runner caches keep an old, vulnerable patch release
> (CVE-2026-111497, see below).

---

## Pinned versions

| Component | Pinned version | How to verify |
|-----------|---------------|---------------|
| **Node.js** | `26.13.0` (LTS "Lithium"); minimum `>=26.12.1` | `node --version` |
| **npm** | `^11.0.0` (latest 11.x patch) | `npm --version` |
| **V8** (in Node.js) | extracted at build time | `node -e "console.log(process.versions.v8)"` |

> **Why not older than 26.12.1:** Node.js releases before 26.12.1 (21.10.2026) bundle a Brotli
> decoder with an out-of-bounds write that can lead to remote code execution
> (CVE-2026-111497, fixed in Brotli 1.2.1; same release fixes several TLS/DNS CVEs).
> 26.13.0 (28.10.2026) contains everything from 26.12.1.
> Source: <https://nodejs.org/en/blog/vulnerability/october-2026-security-releases>

---

## Electron's embedded V8 (separate runtime)

Electron bundles its own Chromium + V8 for the renderer and main processes, independent of the
Node.js V8 above. To check it at runtime:

```javascript
// In Electron's main process or renderer DevTools console
console.log(process.versions)
// → { node: '...', v8: '...', electron: '...', chrome: '...', ... }
```

The Electron version is pinned in `application/package.json` under `devDependencies.electron`.

> **Not covered by the Node pin above:** the packaged app runs on Electron's embedded Node.
> `electron@42.11.18` embeds Node **24.19.0**, which predates the CVE-2026-111497 fix (24.22.1).
> Electron 43.8.6 / 44.10.1 / 45.2.1 embed Node 24.22.1.
> Source: <https://artifacts.electronjs.org/headers/dist/index.json>

---

## How CI records these versions

Every CI run writes `application/runtime-versions.txt` with the exact versions used:

```
node=v26.2.1
npm=11.4.2
v8=13.2.152.32
```

This file is uploaded as a build artifact and — on release builds — attached to the GitHub
Release alongside the SBOM and installers.

---

## Updating the pinned versions

```bash
# 1. Switch to the pinned Node version (nvm reads .nvmrc)
nvm install
nvm use

# 2. Update npm to the latest 11.x
npm install -g npm@11

# 3. Reinstall dependencies with the new runtime
cd application
rm -rf node_modules
npm install

# 4. Commit the updated package-lock.json and this file
#    (record the new exact versions in the table above)
```

---

## SBOM cross-reference

Runtime versions are sourced into the CycloneDX SBOM generated during release:

```bash
cd application
npm sbom --sbom-format cyclonedx --package-lock-only > sbom-vX.Y.Z.cdx.json
```

See [`SBOM.md`](./SBOM.md) for the full policy.
