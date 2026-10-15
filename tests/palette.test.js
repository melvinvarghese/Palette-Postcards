import assert from 'node:assert/strict';
import test from 'node:test';
import { extractPalette } from '../src/palette.js';

function pixels(colors) {
  return Uint8ClampedArray.from(colors.flatMap(([r, g, b, a = 255]) => [r, g, b, a]));
}

test('returns the five most common colors in deterministic order', () => {
  const rgba = pixels([
    [220, 35, 45], [220, 35, 45],
    [30, 170, 80], [40, 90, 210], [230, 195, 35], [135, 55, 170]
  ]);
  const palette = extractPalette(rgba, 6, 1);
  assert.equal(palette.length, 5);
  assert.equal(palette[0], '#dc232d');
  assert.deepEqual(palette, ['#dc232d', '#1eaa50', '#285ad2', '#e6c323', '#8737aa']);
  assert.deepEqual([...palette].sort(), ['#1eaa50', '#285ad2', '#8737aa', '#dc232d', '#e6c323']);
  assert.deepEqual(extractPalette(rgba, 6, 1), palette);
});

test('ignores fully transparent pixels', () => {
  const rgba = pixels([[240, 10, 10, 0], [25, 80, 210, 255]]);
  const palette = extractPalette(rgba, 2, 1);
  assert.equal(palette.length, 5);
  assert.equal(palette[0], '#1950d2');
});

test('derives distinct nearby swatches when a photo has only one color', () => {
  const rgba = pixels([[85, 85, 85], [85, 85, 85], [85, 85, 85]]);
  const palette = extractPalette(rgba, 3, 1);
  assert.equal(palette.length, 5);
  assert.equal(palette[0], '#555555');
  assert.equal(new Set(palette).size, 5);
  assert.ok(palette.every((color) => /^#[0-9a-f]{6}$/i.test(color)));
});

test('rejects malformed image data instead of returning nonsense', () => {
  assert.throws(() => extractPalette(new Uint8ClampedArray(3), 1, 1), /pixel data/i);
  assert.throws(() => extractPalette(new Uint8ClampedArray(4), 0, 1), /dimensions/i);
});
