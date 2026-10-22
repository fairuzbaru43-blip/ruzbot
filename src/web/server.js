'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { FixedWindowLimiter } = require('../middleware/rate-limit');
const { MAX_ACCOUNTS } = require('../whatsapp/session-manager');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 8192;
const PUBLIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']]
]);

function createDashboardServer({ config, manager, publicDir = path.resolve(__dirname, '..', '..', 'public'), logger = console }) {
  if (!config.dashboardPassword || config.dashboardPassword.length < 12) {
    throw new Error('Atur DASHBOARD_PASSWORD minimal 12 karakter sebelum menjalankan dashboard.');
  }

  const frontendOrigin = config.frontendOrigin ? new URL(config.frontendOrigin).origin : '';
  if (frontendOrigin && !frontendOrigin.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(frontendOrigin)) {
    throw new Error('FRONTEND_ORIGIN harus memakai HTTPS, kecuali untuk localhost.');
  }

  const sessions = new Map();
  const loginLimiter = new FixedWindowLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });
  const httpsExpected = process.env.NODE_ENV === 'production' || Boolean(frontendOrigin);
  const allowedOrigins = new Set(frontendOrigin ? [frontendOrigin] : []);

  function isAllowedOrigin(origin, request) {
    if (!origin) return true;
    if (allowedOrigins.has(origin)) return true;
    const host = request.headers.host;
    const protocol = request.headers['x-forwarded-proto'] || (httpsExpected ? 'https' : 'http');
    return origin === `${protocol}://${host}`;
  }

  function setCorsHeaders(request, response) {
    const origin = request.headers.origin;
    if (origin && frontendOrigin && origin === frontendOrigin) {
      response.setHeader('Access-Control-Allow-Origin', frontendOrigin);
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      response.setHeader('Vary', 'Origin');
    }
  }

  function sendJson(response, status, value, headers = {}) {
    response.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers
    });
    response.end(JSON.stringify(value));
  }

  function getSession(request) {
    const authorization = request.headers.authorization || '';
    const match = authorization.match(/^Bearer ([A-Za-z0-9_-]{40,})$/);
    const token = match ? match[1] : '';
    const session = sessions.get(token);
    if (!session) return null;
    if (Date.now() >= session.expiresAt) {
      sessions.delete(token);
      return null;
    }
    session.expiresAt = Date.now() + SESSION_TTL_MS;
    return session;
  }

  async function readJson(request) {
    let size = 0;
    const chunks = [];
    for await (const chunk of request) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Isi permintaan terlalu besar.'), { statusCode: 413 });
      chunks.push(chunk);
    }
    if (!size) return {};
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Objek JSON diperlukan.');
      return body;
    } catch {
      throw Object.assign(new Error('Format JSON tidak valid.'), { statusCode: 400 });
    }
  }

  async function serveFile(request, response, pathname) {
    const file = PUBLIC_FILES.get(pathname);
    if (!file || !['GET', 'HEAD'].includes(request.method)) {
      sendJson(response, 404, { error: 'Halaman tidak ditemukan.' });
      return;
    }
    const [name, contentType] = file;
    const content = await fs.readFile(path.join(publicDir, name));
    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  }

  async function handleApi(request, response, url) {
    const pathname = url.pathname;
    const method = request.method;

    if (pathname === '/api/health' && method === 'GET') {
      sendJson(response, 200, { status: 'ok' });
      return;
    }

    if (pathname === '/api/login' && method === 'POST') {
      if (!loginLimiter.allow(request.socket.remoteAddress || 'unknown')) {
        sendJson(response, 429, { error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' });
        return;
      }
      const body = await readJson(request);
      const supplied = typeof body.password === 'string' ? Buffer.from(body.password) : Buffer.alloc(0);
      const expected = Buffer.from(config.dashboardPassword);
      const valid = supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
      if (!valid) {
        sendJson(response, 401, { error: 'Kata sandi salah.' });
        return;
      }
      const token = crypto.randomBytes(32).toString('base64url');
      sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS });
      sendJson(response, 200, { authenticated: true, token });
      return;
    }

    if (pathname === '/api/auth' && method === 'GET') {
      sendJson(response, 200, { authenticated: Boolean(getSession(request)) });
      return;
    }

    const session = getSession(request);
    if (!session) {
      sendJson(response, 401, { error: 'Silakan login kembali.' });
      return;
    }

    if (pathname === '/api/logout' && method === 'POST') {
      const authorization = request.headers.authorization || '';
      const match = authorization.match(/^Bearer ([A-Za-z0-9_-]{40,})$/);
      if (match) sessions.delete(match[1]);
      sendJson(response, 200, { authenticated: false });
      return;
    }

    if (pathname === '/api/accounts' && method === 'GET') {
      sendJson(response, 200, { accounts: manager.list(), maxAccounts: MAX_ACCOUNTS });
      return;
    }

    if (pathname === '/api/accounts' && method === 'POST') {
      const body = await readJson(request);
      const label = typeof body.label === 'string' ? body.label.trim() : '';
      if (!label || label.length > 40 || /[\u0000-\u001f\u007f]/.test(label)) {
        sendJson(response, 400, { error: 'Nama akun wajib diisi (maksimal 40 karakter).' });
        return;
      }
      let account;
      try {
        account = await manager.add(label);
      } catch (error) {
        if (error.message.startsWith('Maksimal ')) {
          sendJson(response, 409, { error: error.message });
          return;
        }
        throw error;
      }
      sendJson(response, 201, { account });
      return;
    }

    const match = pathname.match(/^\/api\/accounts\/([a-zA-Z0-9-]{1,64})$/);
    if (match && method === 'DELETE') {
      try {
        await manager.remove(match[1]);
      } catch (error) {
        if (error.message === 'Akun WhatsApp tidak ditemukan.') {
          sendJson(response, 404, { error: error.message });
          return;
        }
        throw error;
      }
      sendJson(response, 200, { removed: true });
      return;
    }

    sendJson(response, 404, { error: 'Endpoint tidak ditemukan.' });
  }

  return http.createServer(async (request, response) => {
    try {
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('X-Frame-Options', 'DENY');
      response.setHeader('Referrer-Policy', 'no-referrer');
      const url = new URL(request.url, 'http://localhost');
      setCorsHeaders(request, response);
      if (!isAllowedOrigin(request.headers.origin, request)) {
        sendJson(response, 403, { error: 'Origin tidak diizinkan.' });
        return;
      }
      if (request.method === 'OPTIONS') {
        response.writeHead(204);
        response.end();
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        await handleApi(request, response, url);
        return;
      }
      await serveFile(request, response, url.pathname);
    } catch (error) {
      logger.error?.('Permintaan dashboard gagal:', error.message);
      sendJson(response, error.statusCode || 500, {
        error: error.statusCode ? error.message : 'Terjadi kesalahan server.'
      });
    }
  });
}

module.exports = { createDashboardServer };
