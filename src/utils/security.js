'use strict';

const MAX_TEXT_CHARS = 4096;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function validateUserText(value, maxChars = MAX_TEXT_CHARS) {
  if (typeof value !== 'string') return { ok: false, reason: 'Masukan harus berupa teks.' };
  if (value.length > maxChars) return { ok: false, reason: 'Masukan terlalu panjang.' };
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) return { ok: false, reason: 'Masukan berisi karakter kontrol.' };
  return { ok: true, value: value.trim() };
}

function validateUrlInput(value) {
  if (typeof value !== 'string' || value.length > 2048) return { ok: false, reason: 'URL tidak valid.' };
  let url;
  try { url = new URL(value); } catch { return { ok: false, reason: 'URL tidak valid.' }; }
  if (url.protocol !== 'https:' || url.username || url.password) return { ok: false, reason: 'Hanya URL HTTPS tanpa kredensial yang diterima.' };
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname === 'metadata.google.internal') {
    return { ok: false, reason: 'Host lokal atau metadata tidak diizinkan.' };
  }
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) || hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80:')) {
    return { ok: false, reason: 'Alamat jaringan privat tidak diizinkan.' };
  }
  return { ok: true, value: url.toString() };
}

function validateFileSize(size, maxBytes = MAX_UPLOAD_BYTES) {
  return Number.isSafeInteger(size) && size >= 0 && size <= maxBytes;
}

module.exports = { MAX_TEXT_CHARS, MAX_UPLOAD_BYTES, validateUserText, validateUrlInput, validateFileSize };
