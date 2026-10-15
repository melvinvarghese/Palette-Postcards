# Palette Postcards Implementation Plan

> For implementation, use the approved native or subagent-driven execution method selected by the owner. Work task-by-task and keep the project static.

**Goal:** Build a small GitHub Pages-compatible site that turns a local photo into an editable, shareable five-color PNG card.

**Architecture:** Use a single static HTML page, vanilla ES modules, CSS, and the browser File API/Canvas. Keep image validation and palette extraction separate from card rendering and UI state; no image leaves the browser.

**Tech Stack:** HTML, CSS, vanilla JavaScript modules, Node.js built-in test runner, browser Canvas API.

**Spec:** `docs/superpowers/specs/2026-10-15-palette-postcards-design.md`

## Global Constraints

- No runtime dependencies, backend, account, analytics, external font, or image upload.
- Accept local JPG, JPEG, PNG, and WebP files up to 15 MB.
- Make one portrait card at 1200 × 1500 pixels.
- Keep the palette to five representative colors; title and swatch order are editable.
- Serve as static files from a repository root suitable for GitHub Pages.
- Preserve keyboard operation, readable contrast, mobile layout, and clear file errors.

## Review Focus

- Unsupported type, empty file, or over-limit image: reject it clearly and keep the page usable.
- Transparent PNG or a monochrome image: ignore transparent pixels and still create a coherent five-swatch card.
- Very small or low-detail photo: avoid crashes and render a stable card.
- Browser without clipboard permission: show the HEX values and a useful copy fallback/error.
- Export failure or rapid file/title changes: do not download a stale or blank card.

---

### Task 1: Static shell and design foundation

**Files:**
- Create: `index.html`
- Create: `assets/css/site.css`
- Create: `package.json`
- Create: `tests/site.test.js`
- Create: `.gitignore`

**Interfaces:**
- Produces: a responsive, semantic page shell, accessible file picker/drop target, card preview container, and labeled action controls for later tasks.
- Test command: `npm test` runs `node --test`.

- [ ] **Step 1: Write failing page-contract tests**
  - Assert the page has a document title, `main` landmark, labeled image input, editable card-title field, preview region, and named copy/download controls.
  - Assert there are no remote font or script dependencies.
- [ ] **Step 2: Run `npm test` and confirm the missing page fails for expected reasons.**
- [ ] **Step 3: Implement the semantic HTML, responsive visual system, minimal package script, and ignore rules.**
  - Establish the paper, ink-blue, cobalt, mist-blue, and coral tokens from the spec; keep the image/card preview visually primary.
- [ ] **Step 4: Run `npm test`; confirm the page-contract tests pass.**
- [ ] **Step 5: Commit `feat: add Palette Postcards static shell`.**

### Task 2: Local image handling and palette extraction

**Files:**
- Create: `src/image.js`
- Create: `src/palette.js`
- Create: `tests/image.test.js`
- Create: `tests/palette.test.js`

**Interfaces:**
- `validateImageFile(file) -> { valid: boolean, message: string }`
- `loadLocalImage(file) -> Promise<{ bitmap, width, height }>`
- `extractPalette(rgba, width, height, count = 5) -> string[]`
- `sampleImage(bitmap, maxDimension = 64) -> { data: Uint8ClampedArray, width, height }`

- [ ] **Step 1: Write tests** for supported/unsupported MIME types and size, deterministic extraction from a synthetic five-color image, alpha-transparent pixels, and low-color input.
- [ ] **Step 2: Run the targeted tests and confirm they fail because the modules do not exist.**
- [ ] **Step 3: Implement validation and a deterministic, bounded-cost Canvas sampling/color-quantization path.**
  - Ignore fully transparent pixels; produce five HEX colors for the card, using nearby light/dark variations only when the source has too few distinct colors.
  - Release temporary object URLs and image resources after use.
- [ ] **Step 4: Run the targeted tests and then the full `npm test` suite.**
- [ ] **Step 5: Commit `feat: extract palettes from local photos`.**

### Task 3: Card editor, PNG export, and release verification

**Files:**
- Create: `src/card.js`
- Create: `src/app.js`
- Create: `tests/card.test.js`
- Modify: `index.html`
- Modify: `assets/css/site.css`
- Create: `README.md`

**Interfaces:**
- `drawCard(context, { bitmap, title, colors, width = 1200, height = 1500 }) -> void`
- `downloadCard({ bitmap, title, colors }) -> Promise<void>`

- [ ] **Step 1: Write failing tests** for the 4:5 export size, live title changes, swatch reorder, HEX copy content, and keeping preview/export data in sync.
- [ ] **Step 2: Run `npm test` and confirm the card behavior tests fail before implementation.**
- [ ] **Step 3: Implement the card renderer and page interactions.**
  - Select or drag a local image, show useful validation errors, update the preview on title/order changes, copy color values, and download the 1200 × 1500 PNG.
  - Choose black or white text for each swatch based on contrast; do not rely on color alone to identify values.
- [ ] **Step 4: Run `npm test` and a browser smoke pass on the local server.**
  - Check a standard photo, a transparent PNG, a low-color image, invalid file, and an image over 15 MB.
  - Check keyboard use, mobile at 390 px, desktop at 1440 px, direct reload, no horizontal overflow, and that no image request leaves the browser.
- [ ] **Step 5: Write concise README instructions for the local test/server commands and GitHub Pages-compatible static deployment.**
- [ ] **Step 6: Run the full test suite, verify `git diff --check`, inspect the final diff, and commit `feat: create shareable palette cards`.**

## Plan Self-Review

- All scope and privacy requirements map to Tasks 1–3; no service or repository-publication action is included.
- Palette extraction is tested independently from DOM behavior; export behavior is checked in the browser as well as by deterministic unit tests.
- File-size/type, transparency, low-color, clipboard, stale-render, keyboard, and mobile failure modes are explicitly covered.
- Name/handle availability remains open; “Palette Postcards” is a working title, not a final repository name.
