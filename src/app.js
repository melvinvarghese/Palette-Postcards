import { loadLocalImage, sampleImage, validateImageFile } from './image.js';
import { contrastTextColor, downloadCard, moveSwatch, randomCardNumber } from './card.js';
import { extractPalette } from './palette.js';

const fileInput = document.querySelector('#photo-input');
const uploadTarget = document.querySelector('.upload-target');
const titleInput = document.querySelector('#card-title');
const titlePreview = document.querySelector('#card-title-preview');
const cardNumberPreview = document.querySelector('#card-number-preview');
const photoPreview = document.querySelector('#photo-preview');
const photoPlaceholder = document.querySelector('#photo-placeholder');
const paletteList = document.querySelector('#palette-list');
const cardSwatches = document.querySelector('#card-swatches');
const statusMessage = document.querySelector('#status-message');
const copyButton = document.querySelector('#copy-colors');
const downloadButton = document.querySelector('#download-card');

const state = { bitmap: null, previewUrl: null, colors: [], title: titleInput.value, cardNumber: randomCardNumber() };
let loadSequence = 0;

function setStatus(message, kind = 'error') {
  statusMessage.textContent = message;
  statusMessage.dataset.kind = kind;
}

function shownTitle() {
  return state.title.trim() || 'A little color story';
}

function updatePreviewTitle() {
  titlePreview.textContent = shownTitle();
}

function updatePreviewNumber() {
  cardNumberPreview.textContent = state.cardNumber;
}

function renderCardSwatches() {
  const colors = state.colors.length ? state.colors : ['#e88b63', '#f3d39b', '#5a9a86', '#406d8b', '#263b4b'];
  cardSwatches.replaceChildren(...colors.map((color) => {
    const item = document.createElement('li');
    item.style.setProperty('--swatch', color);
    item.style.setProperty('--swatch-ink', contrastTextColor(color));
    const label = document.createElement('span');
    label.textContent = color.toUpperCase();
    item.append(label);
    return item;
  }));
}

function renderPaletteList() {
  if (!state.colors.length) {
    paletteList.replaceChildren(Object.assign(document.createElement('li'), {
      className: 'palette-empty', textContent: 'Your colors will appear here.'
    }));
    copyButton.disabled = true;
    downloadButton.disabled = true;
    return;
  }

  paletteList.replaceChildren(...state.colors.map((color, index) => {
    const item = document.createElement('li');
    item.className = 'palette-swatch';
    item.style.setProperty('--swatch', color);

    const chip = document.createElement('span');
    chip.className = 'palette-chip';
    chip.style.backgroundColor = color;
    chip.setAttribute('aria-hidden', 'true');

    const value = document.createElement('span');
    value.className = 'color-hex';
    value.textContent = color.toUpperCase();

    const actions = document.createElement('span');
    actions.className = 'swatch-actions';
    const up = document.createElement('button');
    up.className = 'move-swatch';
    up.type = 'button';
    up.disabled = index === 0;
    up.setAttribute('aria-label', `Move color ${index + 1} up`);
    up.title = 'Move up';
    up.textContent = '↑';
    up.addEventListener('click', () => {
      const nextIndex = index - 1;
      state.colors = moveSwatch(state.colors, index, nextIndex);
      renderPaletteList();
      renderCardSwatches();
      setStatus(`Moved ${color.toUpperCase()} to position ${index}.`, 'success');
      paletteList.querySelector(`[aria-label="Move color ${nextIndex + 1} down"]`)?.focus();
    });

    const down = document.createElement('button');
    down.className = 'move-swatch';
    down.type = 'button';
    down.disabled = index === state.colors.length - 1;
    down.setAttribute('aria-label', `Move color ${index + 1} down`);
    down.title = 'Move down';
    down.textContent = '↓';
    down.addEventListener('click', () => {
      const nextIndex = index + 1;
      state.colors = moveSwatch(state.colors, index, nextIndex);
      renderPaletteList();
      renderCardSwatches();
      setStatus(`Moved ${color.toUpperCase()} to position ${index + 2}.`, 'success');
      paletteList.querySelector(`[aria-label="Move color ${nextIndex + 1} up"]`)?.focus();
    });

    actions.append(up, down);
    item.append(chip, value, actions);
    return item;
  }));
  copyButton.disabled = false;
  downloadButton.disabled = !state.bitmap;
}

function renderAll() {
  updatePreviewTitle();
  updatePreviewNumber();
  renderPaletteList();
  renderCardSwatches();
}

async function handleFile(file) {
  if (!file) return;
  const request = ++loadSequence;
  const validation = validateImageFile(file);
  if (!validation.valid) {
    setStatus(validation.message);
    return;
  }

  setStatus('Reading your photo…', 'progress');
  let bitmap;
  try {
    const loaded = await loadLocalImage(file);
    bitmap = loaded.bitmap;
    const sample = sampleImage(bitmap, 64);
    const colors = extractPalette(sample.data, sample.width, sample.height, 5);
    const previewUrl = URL.createObjectURL(file);

    if (request !== loadSequence) {
      bitmap.close?.();
      URL.revokeObjectURL(previewUrl);
      return;
    }

    const oldBitmap = state.bitmap;
    const oldUrl = state.previewUrl;
    state.bitmap = bitmap;
    state.previewUrl = previewUrl;
    state.colors = colors;
    photoPreview.src = previewUrl;
    photoPreview.alt = `Selected photo: ${file.name}`;
    photoPreview.hidden = false;
    photoPlaceholder.hidden = true;
    renderAll();
    setStatus('Five colors found. Make the postcard yours.', 'success');
    oldBitmap?.close?.();
    if (oldUrl) URL.revokeObjectURL(oldUrl);
  } catch (error) {
    bitmap?.close?.();
    if (request === loadSequence) setStatus(error instanceof Error ? error.message : 'This image could not be opened. Try another photo.');
  }
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  handleFile(file);
});

titleInput.addEventListener('input', () => {
  state.title = titleInput.value.slice(0, 48);
  updatePreviewTitle();
});

for (const eventName of ['dragenter', 'dragover']) {
  uploadTarget.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadTarget.classList.add('is-dragging');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  uploadTarget.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadTarget.classList.remove('is-dragging');
  });
}
uploadTarget.addEventListener('drop', (event) => {
  const file = event.dataTransfer?.files?.[0];
  if (file) handleFile(file);
});

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const helper = document.createElement('textarea');
  helper.value = text;
  helper.setAttribute('readonly', '');
  helper.className = 'sr-only';
  document.body.append(helper);
  helper.select();
  const copied = document.execCommand('copy');
  helper.remove();
  if (!copied) throw new Error('Copy is unavailable here. Select the visible HEX values and copy them instead.');
}

copyButton.addEventListener('click', async () => {
  try {
    await copyText(state.colors.map((color) => color.toUpperCase()).join('\n'));
    setStatus('Five HEX colors copied.', 'success');
  } catch {
    setStatus('Could not copy automatically. Select the visible HEX values and copy them instead.');
  }
});

downloadButton.addEventListener('click', async () => {
  if (!state.bitmap || state.colors.length !== 5) return;
  downloadButton.disabled = true;
  try {
    await downloadCard({ bitmap: state.bitmap, title: shownTitle(), colors: state.colors, cardNumber: state.cardNumber });
    setStatus('Your postcard is ready to save.', 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'The postcard could not be downloaded. Try again.');
  } finally {
    downloadButton.disabled = false;
  }
});

renderAll();
