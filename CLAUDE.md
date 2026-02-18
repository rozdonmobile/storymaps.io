# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm install       # Install dependencies
npm start         # Start dev server at http://localhost:8080
```

No build step, test runner, or linter is configured. The client uses native ES modules loaded directly by the browser.

## Architecture

**Single-server Node.js app** (`server.js`) — handles HTTP, WebSocket, REST API, and static file serving. No framework (Express, etc.); uses raw `node:http`.

### Server (`server.js`)
- **WebSocket**: Real-time collaboration via y-websocket (Yjs CRDT sync)
- **Static files**: Serves `public/` and `src/` with in-memory cache, ETag, gzip
- **REST API**: Lock (`/api/lock/:mapId`), backups (`/api/backups/:mapId`), stats (`/api/stats`), new map ID (`/api/maps/new-id`)
- **Format endpoints**: `/:mapId.json` and `/:mapId.yaml` serialize live Yjs docs
- **SPA fallback**: Non-file, non-API paths serve `public/index.html`
- **SQLite** (`data/maps.db`): Map index (id, name, timestamps). Uses `better-sqlite3` with WAL mode
- **LevelDB** (`data/`): Yjs document persistence (via `y-leveldb`)
- **JSON files**: `data/locks.json`, `data/stats.json`, `data/backups/*.json`

### Client (`src/` + `public/`)
No build step — ES modules served directly. All source is in `src/`, HTML/CSS/vendor bundles in `public/`.

**Module dependency injection pattern**: Each module exports an `init()` function that receives its dependencies (state, dom refs, callbacks). The orchestrator `app.js` wires everything together. This avoids circular imports — modules never import each other directly except for `constants.js` and `state.js`.

Key modules:
| File | Role |
|------|------|
| `app.js` | Orchestrator — imports all modules, calls `init()`, owns DOM refs and event listeners |
| `state.js` | Central state object, undo/redo stack, factory functions (`createColumn`, `createStory`, `createSlice`) |
| `render.js` | DOM rendering and state mutations (reads state, builds DOM, attaches Sortable drag-and-drop) |
| `ui.js` | UI component builders — creates card elements, slice containers, legend, partials list |
| `yjs.js` | Yjs document management, CRDT helpers, WebSocket provider, Sortable.js lazy loading |
| `serialization.js` | Pure serialize/deserialize between state and JSON v1 format |
| `yaml.js` | YAML ↔ JSON transform + validation (shared by client and server via `#js-yaml` import map) |
| `navigation.js` | Zoom, pan, scroll, marquee selection, keyboard shortcuts |
| `exports.js` | Jira/Asana/Phabricator export (CSV and API) |
| `lock.js` | Password-protect maps (client-side lock UI + server API) |
| `presence.js` | Cursor tracking and viewer count (via Yjs awareness) |
| `notepad.js` | Collaborative notepad (CodeMirror 6 + y-codemirror) |
| `constants.js` | Shared constants (`CARD_COLORS`, `STATUS_OPTIONS`, `ZOOM_LEVELS`) and `el()` DOM helper |

### Vendor bundles (`public/vendor/`)
Pre-built bundles for Yjs, CodeMirror, js-yaml, html-to-image. Lazy-loaded at runtime (not on initial page load).

### Data Model
The story map state (`state.js`) is column-indexed:
- `columns[]` — ordered array of step objects (the backbone)
- `users{}`, `activities{}` — keyed by column ID → array of cards
- `slices[]` — each has `stories{}` keyed by column ID → array of cards
- `partialMaps[]` — reusable column sequences with their own users/activities/stories
- `legend[]` — color/label pairs for card categories

The serialized JSON v1 format converts column-keyed maps to positional arrays (index-aligned with `steps[]`).

### Yjs Integration
Each map is a Yjs document with a `YMap('storymap')` containing nested `YArray`/`YMap` structures mirroring the state model. Changes sync bidirectionally: local state → Yjs (via helpers in `yjs.js`) and remote Yjs updates → local state + re-render. The `isSyncingFromRemote` flag prevents echo loops.

### Deployment
Docker container (Node.js app) behind Caddy reverse proxy. `docker-compose.yml` runs both services. Data persists in host-mounted `./data/` volume.

## Conventions
- ES module imports use absolute paths from root (e.g., `'/src/constants.js'`, `'/vendor/yjs.bundle.js'`)
- The `el()` helper (`constants.js`) is used for all DOM element creation — accepts tag, className, and an attrs object
- `generateId()` produces 8-char base36 IDs from 6 random bytes (used for map IDs, card IDs, column IDs)
- Card fields are sparse — only non-default values are serialized (no `color: null` in JSON)
- Origin checking (`ALLOWED_ORIGINS` + localhost) gates WebSocket connections and API writes
