import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pageUrl = new URL('../index.html', import.meta.url);

async function readPage() {
  return readFile(pageUrl, 'utf8');
}

test('the page has a document title and main landmark', async () => {
  const html = await readPage();
  assert.match(html, /<title>[^<]+<\/title>/i);
  assert.match(html, /<main\b/i);
});

test('the image picker has a visible associated label', async () => {
  const html = await readPage();
  assert.match(html, /<label\b[^>]*for=["']photo-input["'][^>]*>/i);
  assert.match(html, /<input\b(?=[^>]*\bid=["']photo-input["'])(?=[^>]*\btype=["']file["'])[^>]*>/i);
});

test('the card has an editable title, preview, and named actions', async () => {
  const html = await readPage();
  assert.match(html, /<input\b[^>]*id=["']card-title["']/i);
  assert.match(html, /id=["']card-preview["']/i);
  assert.match(html, /<button\b[^>]*id=["']copy-colors["'][^>]*>\s*Copy\s+colors\s*<\/button>/i);
  assert.match(html, /<button\b[^>]*id=["']download-card["'][^>]*>\s*Download\s+card\s*<\/button>/i);
});

test('the page does not depend on remote scripts or fonts', async () => {
  const html = await readPage();
  assert.doesNotMatch(html, /<script\b[^>]*src=["']https?:/i);
  assert.doesNotMatch(html, /@import\s+url\s*\(\s*["']?https?:|fonts\.googleapis\.com/i);
});
