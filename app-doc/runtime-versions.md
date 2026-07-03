# Runtime Versions

This file is the **source of truth** for the fixed runtime environment used across
development, CI, and release builds. Update this table whenever the pinned versions change,
and commit the change together with any updated `package-lock.json`.

---

## Single source of truth

| What | File | How it's consumed |
|------|------|--------------------|
| **Node.js major** | **`.nvmrc`** (repo root) | nvm · devcontainer · `actions/setup-node node-version-file` · Docker `ARG NODE_VERSION` |
| **npm major** | **`ARG NPM_VERSION`** top of both Dockerfiles | `RUN npm install -g npm@${NPM_VERSION}` · documents `engines.npm` in `package.json` |

> To upgrade Node or npm, change **one file each** — `.nvmrc` for Node, the `ARG` block at the
> top of `.devcontainer/Dockerfile` and `docker/Dockerfile.ci` for npm — and commit. Everything
> downstream (CI, release, devcontainer, local nvm) picks up the new value automatically.

---

## Pinned versions

| Component | Pinned version | How to verify |
|-----------|---------------|---------------|
| **Node.js** | `^26.0.0` (latest 26.x patch) | `node --version` |
| **npm** | `^11.0.0` (latest 11.x patch) | `npm --version` |
| **V8** (in Node.js) | extracted at build time | `node -e "console.log(process.versions.v8)"` |

> The `.nvmrc` file in the repo root pins the Node **major** version to `26`.
> For fully reproducible builds, replace the range above with the exact output of `node --version`
> at the time of release (e.g. `26.2.1`) and record it in the release SBOM.

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
# 1. Switch to the new Node version (nvm example)
nvm install 26
nvm use 26

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
npm sbom --format cyclonedx-json --package-lock-only > sbom-vX.Y.Z.cdx.json
```

See [`SBOM.md`](./SBOM.md) for the full policy.
