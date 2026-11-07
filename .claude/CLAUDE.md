# Project Profile

Fill in per project; values in `<angle brackets>` are unset. Every agent reads this file.
The universal rules live in `.claude/rules/` and stay untouched.

| Field           | Value |
| --------------- | ----- |
| Purpose         | Local-first desktop notebook: free-form canvas pages with rich text, slash-command blocks and an optional finance ledger, stored as plain files. |
| Type            | desktop |
| Language        | TypeScript |
| SDK / Framework | Electron 42 · electron-vite 5 · React 18 · TipTap 3 · Zustand 4 · Tailwind CSS 4 · Vitest 4 |
| Target          | Windows x64, macOS x64/arm64, Linux x64 (AppImage) |
| Test hardware   | none; GUI runs are done by the owner |
| Default tasks   | Build → `MyNote: Build` · Test → `MyNote: Test` · Run → `MyNote: Run Dev` |
| Environment     | Devcontainer only, no Node on the host: `docker exec -u node CONTAINER bash -lc 'cd /workspaces/MyNote/application && COMMAND'`, where CONTAINER is the running container whose image starts with `vsc-mynote` |
| Version source  | `git describe --tags` |
