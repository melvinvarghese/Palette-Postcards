const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateImageFile(file) {
  if (!file || typeof file !== 'object') {
    return { valid: false, message: 'Choose a JPG, PNG, or WebP image.' };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { valid: false, message: 'Choose a JPG, PNG, or WebP image.' };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { valid: false, message: 'This image file is empty. Choose another photo.' };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { valid: false, message: 'Choose an image smaller than 15 MB.' };
  }
  return { valid: true, message: '' };
}

export async function loadLocalImage(file) {
  const validation = validateImageFile(file);
  if (!validation.valid) throw new Error(validation.message);

  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    if (!bitmap.width || !bitmap.height) {
      bitmap.close?.();
      throw new Error('This image has no visible size. Choose another photo.');
    }
    return { bitmap, width: bitmap.width, height: bitmap.height };
  }

  if (typeof Image === 'undefined' || typeof URL?.createObjectURL !== 'function') {
    throw new Error('This browser cannot open local images. Try a current browser.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const bitmap = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('This image could not be opened. Try another photo.'));
      image.src = objectUrl;
    });
    if (!bitmap.naturalWidth || !bitmap.naturalHeight) {
      throw new Error('This image has no visible size. Choose another photo.');
    }
    return { bitmap, width: bitmap.naturalWidth, height: bitmap.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function sampleImage(bitmap, maxDimension = 64) {
  const sourceWidth = bitmap?.width || bitmap?.naturalWidth;
  const sourceHeight = bitmap?.height || bitmap?.naturalHeight;
  if (!sourceWidth || !sourceHeight) throw new Error('Image dimensions are unavailable.');
  if (!Number.isInteger(maxDimension) || maxDimension < 1) throw new Error('Sampling dimensions must be positive.');

  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = typeof OffscreenCanvas === 'function'
    ? new OffscreenCanvas(width, height)
    : document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('This browser could not read the photo colors.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  return { data, width, height };
}
