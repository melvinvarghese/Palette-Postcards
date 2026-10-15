const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 1500;
const INK = '#172b3a';
const PAPER = '#fffdf9';

function rgbFromHex(hex) {
  if (typeof hex !== 'string' || !/^#[\da-f]{6}$/i.test(hex)) throw new Error(`Invalid HEX color: ${hex}`);
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

function relativeLuminance(hex) {
  const channels = rgbFromHex(hex).map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a, b) {
  const values = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

export function normalizeColors(colors) {
  if (!Array.isArray(colors) || colors.length !== 5) throw new Error('A postcard needs exactly five colors.');
  return colors.map((color) => {
    rgbFromHex(color);
    return color.toLowerCase();
  });
}

export function moveSwatch(colors, from, to) {
  if (!Array.isArray(colors) || !Number.isInteger(from) || !Number.isInteger(to)
      || from < 0 || to < 0 || from >= colors.length || to >= colors.length) {
    throw new RangeError('Swatch positions must refer to colors in the palette.');
  }
  const next = [...colors];
  const [color] = next.splice(from, 1);
  next.splice(to, 0, color);
  return next;
}

export function contrastTextColor(background) {
  rgbFromHex(background);
  const blackRatio = contrastRatio(background, '#000000');
  const whiteRatio = contrastRatio(background, '#ffffff');
  return blackRatio >= whiteRatio ? '#000000' : '#ffffff';
}

function containPhoto(bitmap, x, y, width, height) {
  const sourceWidth = bitmap.width || bitmap.naturalWidth;
  const sourceHeight = bitmap.height || bitmap.naturalHeight;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;
  return [0, 0, sourceWidth, sourceHeight, drawX, drawY, drawWidth, drawHeight];
}

function wrapTitle(context, title, maxWidth, maxLines = 2) {
  const words = title.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const pieces = [];
    let piece = '';
    for (const character of word) {
      if (piece && context.measureText(`${piece}${character}`).width > maxWidth) {
        pieces.push(piece);
        piece = character;
      } else {
        piece += character;
      }
    }
    if (piece) pieces.push(piece);
    for (const part of pieces) {
      const candidate = line ? `${line} ${part}` : part;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = part;
      } else {
        line = candidate;
      }
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const last = lines[maxLines - 1];
    lines.length = maxLines;
    let trimmed = last;
    while (trimmed && context.measureText(`${trimmed}…`).width > maxWidth) trimmed = trimmed.slice(0, -1);
    lines[maxLines - 1] = `${trimmed.trimEnd()}…`;
  }
  return lines;
}

export function drawCard(context, { bitmap, title, colors, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT }) {
  const palette = normalizeColors(colors);
  if (!bitmap || !(bitmap.width || bitmap.naturalWidth) || !(bitmap.height || bitmap.naturalHeight)) {
    throw new Error('A readable photo is required to draw a postcard.');
  }
  if (!context || !Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error('A drawing context and positive card dimensions are required.');
  }

  const scale = width / DEFAULT_WIDTH;
  const px = (value) => value * scale;
  context.save();
  context.clearRect(0, 0, width, height);
  context.fillStyle = PAPER;
  context.fillRect(0, 0, width, height);

  const photo = { x: px(64), y: px(64), width: px(1072), height: px(818) };
  context.fillStyle = '#dce7f2';
  context.fillRect(photo.x, photo.y, photo.width, photo.height);
  context.save();
  context.beginPath();
  context.roundRect(photo.x, photo.y, photo.width, photo.height, px(24));
  context.clip();
  context.drawImage(bitmap, ...containPhoto(bitmap, photo.x, photo.y, photo.width, photo.height));
  context.restore();

  context.fillStyle = '#60717b';
  context.font = `700 ${px(18)}px ui-sans-serif, system-ui, sans-serif`;
  context.textAlign = 'left';
  context.fillText('COLOR STUDY', px(64), px(936));
  context.textAlign = 'right';
  context.fillStyle = '#9d7564';
  context.fillText('NO. 001', px(1136), px(936));

  const cleanTitle = String(title || '').trim() || 'A little color story';
  context.textAlign = 'left';
  context.fillStyle = INK;
  context.font = `500 ${px(54)}px Georgia, 'Times New Roman', serif`;
  const titleLines = wrapTitle(context, cleanTitle, px(1072), 2);
  titleLines.forEach((line, index) => context.fillText(line, px(64), px(1010 + index * 62)));

  const top = px(1080);
  const swatchHeight = px(235);
  const gap = px(12);
  const swatchWidth = (px(1072) - gap * 4) / 5;
  palette.forEach((color, index) => {
    const x = px(64) + index * (swatchWidth + gap);
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(x, top, swatchWidth, swatchHeight, px(10));
    context.fill();
    context.fillStyle = contrastTextColor(color);
    context.font = `700 ${px(22)}px ui-sans-serif, system-ui, sans-serif`;
    context.textAlign = 'left';
    context.fillText(color.toUpperCase(), x + px(14), top + swatchHeight - px(18));
  });

  context.fillStyle = '#60717b';
  context.font = `700 ${px(16)}px ui-sans-serif, system-ui, sans-serif`;
  context.textAlign = 'left';
  context.fillText('MADE FROM A MOMENT', px(64), px(1392));
  context.fillStyle = '#e98972';
  context.font = `${px(28)}px Georgia, 'Times New Roman', serif`;
  context.textAlign = 'right';
  context.fillText('✳', px(1136), px(1396));
  context.restore();
}

export async function downloadCard({ bitmap, title, colors }) {
  const canvas = document.createElement('canvas');
  canvas.width = DEFAULT_WIDTH;
  canvas.height = DEFAULT_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not prepare the postcard image.');
  drawCard(context, { bitmap, title, colors });
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('The postcard could not be exported. Try again.')), 'image/png');
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'palette-postcard.png';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
