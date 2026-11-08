# MyNote

A local-first desktop notebook: free-form canvas pages with rich text, slash-command blocks and an optional finance ledger, stored as plain files in a folder you choose.

Status: in development (v0.2.0).

<!--
Screenshots (add the files, then remove this comment):
![Workspace](documentation/user/images/workspace.png)
![Editor](documentation/user/images/editor.png)
![Ledger](documentation/user/images/ledger.png)
-->

## Features

- Notebooks, chapters, pages and subpages, with a free-form canvas per page: place, resize and zoom text boxes, with a minimap.
- Rich text with a formatting toolbar (headings, lists, links) and `/` blocks: callouts, tables, a table of contents and a page hierarchy.
- An optional finance module: ledgers with accounts and categories, CSV and Money Manager import, CSV export and statistics charts. A build with `MYNOTE_FINANCE=off` leaves it out.
- Local storage only: JSON and CSV files in any folder, including a synced or network folder. Writes are atomic and a damaged file is reported, never overwritten.
- Installers for Windows, macOS and Linux; Windows and Linux update from GitHub Releases.

## Install

Download the installer for your system from [Releases](https://github.com/Tiro1999/MyNote/releases), then follow [Getting started](documentation/user/getting-started.md).

## Develop

The toolchain runs in the devcontainer (`.devcontainer/`); there is no Node.js on the host.

```bash
cd application
npm ci
npm run dev      # start the app with hot reload
npm test         # unit tests
npm run build    # production build
```

`npm run lint` and `npm run typecheck` are the other CI gates, see [Build and release](documentation/software/build/build-and-release.md).

## Documentation

- [Overview page](documentation/index.html) with the architecture diagram and the module map
- [Getting started](documentation/user/getting-started.md), [finance](documentation/user/finance.md) and [network storage](documentation/user/network-storage.md)
- [Architecture](documentation/software/architecture.md) and [file format](documentation/software/file-format/file-format.md)
- [Glossary](documentation/glossar.md): the binding names for code, comments and documentation
- [Changelog](CHANGELOG.md)

## Contributing

Bugs and ideas are welcome as [issues](https://github.com/Tiro1999/MyNote/issues). Names follow the glossary and comments stay at one line.

## License

MyNote is released under the [MIT License](LICENSE).
