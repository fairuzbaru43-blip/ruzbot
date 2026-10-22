'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs/promises');
const path = require('node:path');
const { WhatsAppAccountStore } = require('../src/database/whatsapp-account-store');
const { WhatsAppSessionManager } = require('../src/whatsapp/session-manager');
const { createDashboardServer } = require('../src/web/server');

const config = {
  prefix: '!',
  clientId: 'ruzbot',
  sessionPath: '.wwebjs_auth',
  chromeExecutablePath: '',
  ownerId: '',
  adminIds: [],
  dashboardPassword: 'test-password-long-enough',
  frontendOrigin: ''
};

class FakeLocalAuth {
  constructor(options) {
    this.options = options;
  }
}

class FakeClient extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.destroyed = false;
  }

  async initialize() {
    this.emit('qr', 'fake-qr');
  }

  async logout() {
    this.loggedOut = true;
    this.emit('disconnected', 'logged out');
  }

  async destroy() {
    this.destroyed = true;
  }
}

test('session manager memulihkan akun, menampilkan QR, dan menghapus sesi terpilih', async (t) => {
  const directory = await fs.mkdtemp(path.join(process.cwd(), 'work', 'dashboard-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const accountStore = new WhatsAppAccountStore(path.join(directory, 'accounts.json'));
  const clients = [];
  const manager = new WhatsAppSessionManager({
    Client: class extends FakeClient {
      constructor(options) {
        super(options);
        clients.push(this);
      }
    },
    LocalAuth: FakeLocalAuth,
    config,
    registry: { find: () => null, list: () => [] },
    accountStore,
    qrToDataUrl: async (qr) => `data:image/png;base64,${qr}`,
    baseDir: directory,
    logger: { error: () => {} }
  });

  await manager.restore();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(manager.list()[0].id, 'main');
  assert.equal(manager.list()[0].qr, 'data:image/png;base64,fake-qr');
  assert.equal(clients[0].options.authStrategy.options.clientId, 'ruzbot');

  const added = await manager.add('Akun toko');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(added.label, 'Akun toko');
  assert.equal(manager.list().length, 2);
  assert.equal(manager.snapshot(added.id).qr, 'data:image/png;base64,fake-qr');
  assert.equal(clients[1].options.authStrategy.options.clientId, `ruzbot-${added.id}`);

  clients[1].emit('ready');
  await manager.remove(added.id);
  assert.equal(manager.list().length, 1);
  assert.equal(clients[1].destroyed, true);
  assert.equal(clients[1].loggedOut, true);
  assert.deepEqual((await accountStore.list()).map((account) => account.id), ['main']);
  await manager.destroy();
});

test('dashboard mengunci endpoint akun dengan token admin', async (t) => {
  const calls = [];
  const manager = {
    list: () => [{ id: 'main', label: 'RuzBot', status: 'terhubung', qr: null, error: null }],
    add: async (label) => {
      calls.push(['add', label]);
      return { id: 'new-account', label, status: 'menunggu QR dipindai', qr: null };
    },
    remove: async (id) => calls.push(['remove', id])
  };
  const server = createDashboardServer({ config, manager, logger: { error: () => {} } });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const unauthorized = await fetch(`${baseUrl}/api/accounts`);
  assert.equal(unauthorized.status, 401);

  const wrongLogin = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrong-password' })
  });
  assert.equal(wrongLogin.status, 401);

  const login = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: config.dashboardPassword })
  });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  assert.match(token, /^[A-Za-z0-9_-]{40,}$/);

  const accounts = await fetch(`${baseUrl}/api/accounts`, { headers: { Authorization: `Bearer ${token}` } });
  assert.deepEqual((await accounts.json()).accounts.map((account) => account.id), ['main']);

  const created = await fetch(`${baseUrl}/api/accounts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'Akun baru' })
  });
  assert.equal(created.status, 201);
  assert.deepEqual(calls[0], ['add', 'Akun baru']);
});

test('dashboard membatasi CORS hanya ke frontend yang dikonfigurasi', async (t) => {
  const server = createDashboardServer({
    config: { ...config, frontendOrigin: 'https://ruzbot.vercel.app' },
    manager: { list: () => [], add: async () => {}, remove: async () => {} },
    logger: { error: () => {} }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const allowed = await fetch(`${baseUrl}/api/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://ruzbot.vercel.app',
      'Access-Control-Request-Method': 'POST'
    }
  });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://ruzbot.vercel.app');

  const denied = await fetch(`${baseUrl}/api/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://attacker.example',
      'Access-Control-Request-Method': 'POST'
    }
  });
  assert.equal(denied.status, 403);
});
