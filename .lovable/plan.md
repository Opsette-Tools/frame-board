
# Before / After Visual Planner — V1 Plan

A mobile-first PWA for service pros to upload before/after photos and add **structured visual markup** (pins, zones, callouts) tied to a synced notes panel — not a freehand drawing app.

---

## Tech Stack
- React + TypeScript + Vite (already scaffolded)
- **Ant Design** as the primary UI system + ConfigProvider for light/dark theming
- **Konva / react-konva** for the image markup canvas (handles zoom, pan, hit-testing, transformable shapes — much more reliable than DOM overlays for pins/zones)
- **IndexedDB via `idb`** for project + image blob persistence
- **vite-plugin-pwa** with manifest, theme color, standalone display, and a guarded SW registration that disables itself inside the Lovable iframe/preview host
- Vite `base` configured for clean GitHub Pages deploys
- Tailwind kept only for layout helpers; visible UI = Ant Design

---

## App Structure

### 1. Projects Dashboard (`/`)
- AntD `Layout` with header (app name, theme toggle, "New Project" button)
- Grid of AntD `Card`s per project: thumbnail (before image preview), name, type tag, "updated X ago"
- Card actions via `Dropdown` menu: Open, Rename, Duplicate, Delete (with `Modal.confirm`)
- AntD `Empty` state when no projects
- "New Project" opens a `Modal` with: name input + project type `Select` (Cleaning walkthrough, Landscaping scope, Moving prep, Home organization, Contractor punch list, General review) — preset just sets a tag + default status palette

### 2. Project Editor (`/project/:id`)
Three-zone layout:
- **Top toolbar**: back, project name (inline editable), view-mode `Segmented` control (Before / After / Compare), theme toggle, export menu (`Dropdown`)
- **Center canvas**: react-konva stage with the active image, pan/pinch-zoom, AntD `FloatButton.Group` for tool selection (Pin, Numbered, Warning, Check, Issue, Callout, Rect zone, Rounded zone, Select)
- **Notes panel**: side panel on tablet/desktop, AntD `Drawer` (bottom sheet on mobile) toggled by a FloatButton

**View modes:**
- Before only / After only — full canvas, annotations scoped to that side
- Compare — side-by-side (stacked on narrow screens, horizontal on wide), each side independently markup-able
- Each side has an "Upload / Replace" affordance using AntD `Upload` (stored as Blob in IndexedDB)

**Markup tools (all functional, no placeholders):**
- **Pins/markers**: 5 types (standard, numbered auto-incrementing, warning, check, issue) — colored icons rendered on canvas, draggable, tap to open edit `Drawer` with title, note, status, color
- **Callouts**: text label + connector line to an anchor point, draggable both ends
- **Zones**: rectangle and rounded rectangle, drag-to-create, transformer handles for resize, configurable fill color + opacity + border style + label
- **Status tagging** on any annotation: Included / Excluded / Needs attention / Completed / Optional — drives badge color and border treatment consistently

**Editor interactions (all wired):** upload, replace, zoom +/−, fit-to-screen, pan, select, move, resize zones, edit content (Drawer with AntD `Form`), delete, duplicate.

### 3. Notes Panel (synced)
- AntD `List` of all annotations for the active side (or grouped Before/After in compare mode)
- Each item: type icon, title, status `Badge`, truncated note
- Tap → selects + centers/zooms canvas to that annotation
- Inline edit, delete, drag-to-reorder (numbered pins re-number)
- Stays bidirectionally synced with canvas selection

### 4. Export
Accessed from editor toolbar `Dropdown`:
- **PNG of current view** (flattened image + annotations via Konva `toDataURL`)
- **Side-by-side comparison PNG** (renders both stages to an offscreen canvas)
- **PDF** (jsPDF with the rendered PNG + a notes summary page)
- **Project JSON export** (full project + base64 images) and **JSON import** on dashboard

All buttons trigger real downloads — no dead controls.

---

## Data Model (IndexedDB via `idb`)

**Stores:** `projects`, `images` (blobs keyed by id, referenced from projects to keep project records light)

```ts
Project { id, name, type, tag, createdAt, updatedAt,
          beforeImageId?, afterImageId?,
          annotations: Annotation[], settings }

Annotation { id, imageSide: 'before'|'after',
             type: 'pin'|'callout'|'zone',
             pinKind?, zoneShape?, x, y, width?, height?,
             anchorX?, anchorY?,
             title, note, status, color, icon,
             createdAt, updatedAt }
```

Auto-save on every change (debounced); reopening a project fully restores images + annotations.

---

## Theming
- AntD `ConfigProvider` with `theme.darkAlgorithm` / `defaultAlgorithm`
- Manual toggle in header, persisted to localStorage, respects `prefers-color-scheme` on first load
- Canvas background, zone defaults, and pin palettes adapt per theme for contrast

---

## Mobile-First UX
- Bottom FloatButton group for tools (thumb-reachable)
- Notes panel = bottom Drawer on mobile, side panel ≥ md
- Compare mode stacks vertically on narrow screens
- Large hit targets on pins/handles; pinch-zoom + single-finger pan on canvas
- Project actions collapse into Dropdown menus, not crowded button rows

---

## PWA Setup
- `vite-plugin-pwa` with manifest (name, short_name, theme_color, background_color, `display: "standalone"`, icons)
- `devOptions.enabled: false`
- `navigateFallbackDenylist: [/^\/~oauth/]`
- Registration guard in `main.tsx`: skip + unregister existing SWs when inside an iframe or on `id-preview--*` / `lovableproject.com` hosts → preview stays clean, production gets full PWA
- Vite `base` set for GitHub Pages compatibility (relative-safe)

---

## Out of Scope (V1)
Auth, collaboration, AI/object detection, freehand brush, polygon zones (rect + rounded rect only), scheduling, CRM. Polygon zones noted as a clean future addition.

---

## Success Checklist
✅ Create/rename/duplicate/delete projects · ✅ Upload before & after images · ✅ Place pins, callouts, zones on each side · ✅ Edit/move/resize/delete annotations · ✅ Notes panel synced both ways · ✅ Switch Before / After / Compare · ✅ Reload restores everything from IndexedDB · ✅ Export PNG, comparison PNG, PDF, JSON · ✅ Real light/dark mode · ✅ Comfortable on mobile · ✅ Runs in Lovable preview with PWA setup intact for production
