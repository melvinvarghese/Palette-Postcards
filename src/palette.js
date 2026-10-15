const DEFAULT_COUNT = 5;

function toHex(value) {
  return Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0');
}

function colorHex(r, g, b) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function createVariations(base, count, used) {
  const shades = [];
  const deltas = [32, -32, 64, -64, 96, -96, 128, -128, 160, -160, 192, -192];
  for (const delta of deltas) {
    const shade = colorHex(base.r + delta, base.g + delta, base.b + delta);
    if (!used.has(shade)) {
      used.add(shade);
      shades.push(shade);
    }
    if (shades.length >= count) break;
  }
  return shades;
}

export function extractPalette(rgba, width, height, count = DEFAULT_COUNT) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('Image dimensions must be positive integers.');
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Palette count must be a positive integer.');
  }
  if (!rgba || rgba.length !== width * height * 4) {
    throw new Error('Pixel data does not match image dimensions.');
  }

  const buckets = new Map();
  let visiblePixels = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3];
    if (alpha === 0) continue;
    visiblePixels += 1;
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const key = `${r >> 4},${g >> 4},${b >> 4}`;
    const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0, firstIndex: i / 4 };
    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }

  if (visiblePixels === 0) throw new Error('No visible colors were found in this photo.');

  const colors = [...buckets.values()]
    .sort((a, b) => b.count - a.count || a.firstIndex - b.firstIndex)
    .slice(0, count)
    .map((bucket) => ({
      hex: colorHex(bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count),
      r: bucket.r / bucket.count,
      g: bucket.g / bucket.count,
      b: bucket.b / bucket.count
    }));

  const palette = colors.map(({ hex }) => hex);
  const used = new Set(palette);
  if (palette.length < count) {
    palette.push(...createVariations(colors[0], count - palette.length, used));
  }
  return palette;
}
