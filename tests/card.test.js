import assert from 'node:assert/strict';
import test from 'node:test';
import { contrastTextColor, moveSwatch, normalizeColors } from '../src/card.js';

test('normalizes five valid HEX colors without changing their order', () => {
  assert.deepEqual(
    normalizeColors(['#DC232D', '#1EAA50', '#285AD2', '#E6C323', '#8737AA']),
    ['#dc232d', '#1eaa50', '#285ad2', '#e6c323', '#8737aa']
  );
});

test('moves a swatch one position and leaves the input array unchanged', () => {
  const source = ['#111111', '#222222', '#333333'];
  assert.deepEqual(moveSwatch(source, 0, 1), ['#222222', '#111111', '#333333']);
  assert.deepEqual(source, ['#111111', '#222222', '#333333']);
  assert.throws(() => moveSwatch(source, 0, 8), /position/i);
});

test('chooses a readable black or white label for light and dark swatches', () => {
  assert.equal(contrastTextColor('#f3d39b'), '#000000');
  assert.equal(contrastTextColor('#263b4b'), '#ffffff');
  assert.equal(contrastTextColor('#315dff'), '#ffffff');
});

test('keeps swatch-label contrast at or above WCAG AA for every gray level', () => {
  function luminance(hex) {
    const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
    const [r, g, b] = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  for (let gray = 0; gray <= 255; gray += 1) {
    const color = `#${gray.toString(16).padStart(2, '0').repeat(3)}`;
    const text = contrastTextColor(color);
    const values = [luminance(color), luminance(text)].sort((a, b) => b - a);
    assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, `${text} on ${color} is below 4.5:1`);
  }
});
