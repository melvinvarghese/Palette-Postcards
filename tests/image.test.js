import assert from 'node:assert/strict';
import test from 'node:test';
import { validateImageFile } from '../src/image.js';

const megabyte = 1024 * 1024;

test('accepts supported browser image types within the size limit', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.deepEqual(validateImageFile({ type, size: megabyte }), { valid: true, message: '' });
  }
});

test('rejects unsupported and empty files with a useful reason', () => {
  assert.match(validateImageFile({ type: 'image/gif', size: 123 }).message, /JPG, PNG, or WebP/i);
  assert.match(validateImageFile({ type: 'image/png', size: 0 }).message, /empty/i);
});

test('rejects files larger than 15 megabytes', () => {
  const result = validateImageFile({ type: 'image/jpeg', size: 15 * megabyte + 1 });
  assert.equal(result.valid, false);
  assert.match(result.message, /15 MB/i);
});
