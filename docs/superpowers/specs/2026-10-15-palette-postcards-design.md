# Palette Postcards — Design Spec

Status: Draft for owner review  
Date: 2026-10-15  
Working project name: Palette Postcards (final repository name to be confirmed)

## Purpose

Palette Postcards turns a photo into a polished, shareable color-study card. The card is the main outcome; extracting colors is the step that makes it personal. The first release should feel like a small creative tool, not a complex color-analysis suite.

## Intended user and success

The intended user has a photo whose colors they like and wants a clean card they can save or share. A first-time visitor should be able to select a photo, get a five-color palette, edit the card title, and download a legible PNG without instructions or an account.

## Agreed design direction

The site should evoke a bright print studio: quiet paper-like surfaces, dark ink-blue text, and a vivid cobalt action color. The central card pairs the user’s photo with five distinct swatches and readable color values. The visual hierarchy should make the finished export feel like a small collectible color study.

Use system fonts only, a responsive single-page layout, clear focus states, and reduced-motion support. Keep the interface calm so the photo and palette provide the color.

Initial token proposal:

- Paper: `#F7F4EC`
- Ink blue: `#172B3A`
- Cobalt: `#315DFF`
- Mist blue: `#DCE7F2`
- Warm coral: `#E98972`

## First-release flow

1. The visitor selects a local image file in JPG, JPEG, PNG, or WebP format, up to 15 MB.
2. The browser reads the image locally and samples its pixels to generate five representative colors.
3. A card preview updates with the photo, five swatches, and an editable title.
4. The visitor can reorder swatches and copy their HEX values (or a CSS-variable snippet).
5. The visitor downloads a 4:5 PNG card at 1200 × 1500 pixels.

To keep the first build small, use one card layout and one extraction approach. Fit the full source photo within the card rather than adding a crop editor. If the file type is unsupported or the image cannot be read, explain the problem and how to choose another file.

## Privacy and technical approach

Publish as a fully static site on GitHub Pages. Use client-side HTML, CSS, and JavaScript with the browser File API and Canvas for sampling and rendering. Do not upload or persist the selected photo; the image and generated card remain in the visitor’s browser until they leave or choose another photo. No account, backend, analytics, third-party fonts, or external image service is needed.

## Scope boundaries

The first release includes one responsive page, local image selection, five-color extraction, editable card title, swatch reordering, copyable color values, and PNG export.

It excludes multiple templates, a full image editor, manual color-wheel controls, accounts, saved palettes, cloud storage, social publishing, AI-generated captions, and server-side processing. Those can be considered only after the basic card-making flow is useful.

## Acceptance criteria

- A visitor can select a supported local image and see a preview plus five color swatches.
- Changing the title or swatch order updates the card preview and exported PNG.
- Color values can be copied accurately.
- The exported PNG is 1200 × 1500 pixels, contains the same title, image, and swatches as the preview, and has readable labels.
- The core flow works on mobile and desktop, with keyboard-operable controls, visible focus, and no horizontal overflow at narrow widths.
- The photo is not sent to a server or stored by the site.
- Unsupported, over-15-MB, or unreadable files produce a useful message without breaking the page.
- The project can be built and hosted as static files without a backend or required GitHub Actions workflow.

## Open decisions

- Final repository name and domain/handle availability.
