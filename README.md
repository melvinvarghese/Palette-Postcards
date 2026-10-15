# Palette Postcards

Palette Postcards turns a photo into a small color-study card you can download and share. Choose a picture, give the card a title, arrange its five colors, and save a 4:5 PNG.

**Try it:** [Palette Postcards](https://melvinvarghese.github.io/Palette-Postcards/)

## Use it

Open the page in a current browser, choose or drop a JPG, PNG, or WebP image up to 15 MB, edit the title, and move the color swatches into the order you like. Copy the HEX values or download the 1200 × 1500 pixel postcard.

The palette is an automatic selection of representative colors, not a color-science measurement. Images are processed in your browser and are not uploaded or saved by the site. The photo stays available only while the page is open.

## Run locally

You need Python 3 to serve the static files and Node.js 18 or later to run the unit tests. No package installation is required.

```sh
npm test
python3 -m http.server 4173
```

Then open `http://localhost:4173`. The module-based image workflow needs a local web server; opening `index.html` directly as a `file://` URL is not supported.

The real-browser integration checks use Python Playwright and Chromium:

```sh
python3 -m unittest tests.browser-smoke -v
```

## Publish with GitHub Pages

This is a static site and needs no build step. In the repository’s Pages settings, choose “Deploy from a branch,” select `main` and `/ (root)`, then save. GitHub Pages serves `index.html` and the `assets/` and `src/` files directly.

## Project structure

- `index.html` — accessible photo, title, palette, and preview interface
- `assets/css/site.css` — responsive visual system
- `src/image.js` — local file validation, image loading, and bounded sampling
- `src/palette.js` — deterministic five-color extraction
- `src/card.js` — palette editing helpers and PNG card renderer
- `src/app.js` — browser interactions
- `tests/` — Node unit tests and Chromium integration checks
