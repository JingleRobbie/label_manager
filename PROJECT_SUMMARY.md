# Project Summary

## Overview

This repository contains an Electron desktop app for importing part data from a QuickBooks-style Excel export, searching parts, editing descriptions, previewing labels, and printing thermal labels.

The active app lives in `part-label-printer/`. Root-level `assets/` and `dev/` contain source/reference materials used by the project.

## Repository Layout

- `README.md` - Minimal project readme.
- `AGENTS.md` - Codex/Claude memory context placeholder.
- `assets/FULL PARTS LIST.xlsx` - Sample or source parts workbook.
- `assets/Icon.ico` - App icon asset.
- `assets/LAK-LogoFireflyBW.png` - Logo asset likely used for label branding.
- `dev/PartLabelPrinter_Plan_v5.docx` - Planning/spec document.
- `part-label-printer/` - Electron application.
- `part-label-printer/main.js` - Electron main process, window creation, IPC handlers, printing, file dialogs.
- `part-label-printer/preload.js` - Context-isolated bridge exposing `window.api`.
- `part-label-printer/db/database.js` - JSON-backed storage for parts and settings.
- `part-label-printer/renderer/index.html` - App shell with sidebar navigation.
- `part-label-printer/renderer/app.js` - Renderer logic for view loading, import, search, parts editing, setup, preview, and print jobs.
- `part-label-printer/renderer/styles.css` - App styling.
- `part-label-printer/renderer/views/*.html` - Partial HTML views loaded dynamically by the renderer.

## Tech Stack

- Electron 30
- Plain JavaScript, HTML, and CSS
- Fuse.js for fuzzy part search
- SheetJS `xlsx` for parsing Excel files in the renderer
- JSON file storage under Electron `app.getPath('userData')`
- Electron Builder for Windows packaging

## Commands

Run from `part-label-printer/`:

```powershell
npm start
npm run build
```

There is no test script currently defined in `package.json`.

## Application Flow

On startup:

1. `main.js` initializes the JSON-backed database from `db/database.js`.
2. IPC handlers are registered for database access, print calls, file dialogs, and base64 file reads.
3. The main BrowserWindow loads `renderer/index.html`.
4. `renderer/app.js` rebuilds the part search index and loads the Print view by default.

Navigation is handled by clicking sidebar items. Each view is fetched from `renderer/views/<name>.html` and then initialized by the matching `init*View()` function in `renderer/app.js`.

## Data Storage

The app stores data in a JSON file named `parts-label.json` inside Electron's user data directory.

Stored shape:

```json
{
  "parts": [],
  "settings": {
    "printer_name": "POLONO PL60 - FOR REALS on Ne01:",
    "label_width_in": "4",
    "label_height_in": "3",
    "logo_path": "",
    "last_import_date": ""
  },
  "nextId": 1
}
```

Important behavior:

- Import replaces all existing parts.
- `nextId` is incremented when imports occur.
- Part descriptions can be edited from the Parts view and persisted.
- Settings are simple key/value entries.

## Import Rules

The Import view expects an Excel workbook with a sheet named `Sheet1`.

Required headers:

- `Item`
- `Description`
- `Bin Location`

Rows are included only when:

- `Item` is non-empty.
- `Item` contains a colon.
- `Description` does not contain `do not use` case-insensitively.
- The text after the first colon in `Item` is non-empty.

Parsing details:

- Text before the first colon in `Item` becomes `category`.
- Text after the first colon becomes `part_number`.
- `Bin Location` is parsed for a `Tulsa:` segment; text after `Tulsa:` up to the next comma becomes `bin_location`.

The import UI previews the first 10 parsed rows, shows a destructive warning, and requires a confirmation checkbox before replacing part data.

## Search And Parts Management

Search uses Fuse.js over:

- `part_number`
- `description`
- `bin_location`

The Print view shows up to 10 fuzzy search results. Selecting a result fills read-only part fields and enables label preview/printing once quantity is valid.

The Parts view supports:

- Search/filtering
- Sortable columns for part number, description, and bin location
- Row selection
- Description editing and saving

## Printing

The app prints by creating a hidden BrowserWindow, loading generated label HTML via a `data:` URL, and calling `webContents.print()`.

Print settings in `main.js`:

- `silent: true`
- `deviceName: printerName`
- `pageSize: { width: 101600, height: 76200 }`
- `landscape: true`
- `printBackground: true`
- no margins

The generated label HTML uses `@page { size: 4in 3in landscape; margin: 0; }` and fixed `body` dimensions of `4in x 3in`.

The Setup view text currently says label size is fixed at `4 x 6 inches`, which conflicts with the generated print CSS and Electron page size. Verify the intended physical label orientation/size before changing printing logic.

Print jobs:

- Part labels are printed `labelCount * containerCount` times.
- If a Customer value is present, one customer label is printed per container/set.
- A failed print stops the job and resets the print fields.

## Label Content

Part label includes:

- Optional logo
- Part number
- Description
- Quantity per label

Customer label includes:

- Optional logo
- Customer name
- Optional PO/job name

Both label builders include small font-fitting scripts to shrink text when content exceeds available space.

## Current Caveats

- Some UI source strings appear mojibake-encoded, especially comments and visible text containing dashes, ellipses, arrows, check marks, and warning symbols. Prefer preserving existing behavior but clean encoding deliberately if touching those strings.
- The package build config references `assets/icon.ico` inside the packaged app, but the tracked icon is at root `assets/Icon.ico`. Confirm whether packaging currently copies or resolves this asset correctly.
- `part-label-printer/label/` exists but appears empty.
- The app stores data in JSON despite the folder name `db/`; there is no SQLite database.
- No automated tests are present.
- `node_modules/` is installed locally and ignored by `part-label-printer/.gitignore`.

## Git Notes

At the time this summary was created, tracked source files were clean and `.codex/` was untracked. This summary file is new.
