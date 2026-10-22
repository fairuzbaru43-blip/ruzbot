'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { validateUserText, validateUrlInput, validateFileSize, MAX_UPLOAD_BYTES } = require('../src/utils/security');
const { JsonStore } = require('../src/database/json-store');

test('validasi teks membatasi ukuran dan karakter kontrol', () => {
  assert.equal(validateUserText('hai').ok, true);
  assert.equal(validateUserText('x'.repeat(4097)).ok, false);
  assert.equal(validateUserText('teks\u0000berbahaya').ok, false);
});

test('validasi URL menolak skema, localhost, dan jaringan privat', () => {
  assert.equal(validateUrlInput('https://example.com/path').ok, true);
  assert.equal(validateUrlInput('http://example.com').ok, false);
  assert.equal(validateUrlInput('https://127.0.0.1/admin').ok, false);
  assert.equal(validateUrlInput('https://user:pass@example.com').ok, false);
});

test('batas ukuran berkas menolak ukuran terlalu besar dan nilai tidak valid', () => {
  assert.equal(validateFileSize(MAX_UPLOAD_BYTES), true);
  assert.equal(validateFileSize(MAX_UPLOAD_BYTES + 1), false);
  assert.equal(validateFileSize(-1), false);
});

test('penyimpanan lokal memuat profil dan sesi game, lalu menghapus sesi', async (t) => {
  const directory = await fs.mkdtemp(path.join(process.cwd(), 'work', 'ruzbot-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = new JsonStore(path.join(directory, 'store.json'));
  assert.equal(await store.getProfile('anon-1'), null);
  await store.setProfile('anon-1', { points: 4 });
  await store.setSession('game-1', { type: 'quiz', state: 'active' });
  assert.deepEqual(await store.getProfile('anon-1'), { points: 4 });
  assert.deepEqual(await store.getSession('game-1'), { type: 'quiz', state: 'active' });
  await store.deleteSession('game-1');
  assert.equal(await store.getSession('game-1'), null);
});
