'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const { createWhatsAppClient, resolveChromeExecutablePath, attachClientEvents } = require('../src/whatsapp/client');
const { createMessageService, messageContext } = require('../src/services/message-service');
const { CommandRegistry } = require('../src/commands/registry');

test('client menyiapkan LocalAuth persisten dan Chromium headless', () => {
  class FakeLocalAuth { constructor(options) { this.options = options; } }
  class FakeClient { constructor(options) { this.options = options; } }
  const client = createWhatsAppClient({
    Client: FakeClient,
    LocalAuth: FakeLocalAuth,
    config: { clientId: 'ruzbot', sessionPath: '.wwebjs_auth', chromeExecutablePath: '' },
    baseDir: 'C:\\ruzbot'
  });
  assert.equal(client.options.authStrategy.options.clientId, 'ruzbot');
  assert.equal(client.options.authStrategy.options.dataPath, path.resolve('C:\\ruzbot', '.wwebjs_auth'));
  assert.equal(client.options.puppeteer.headless, true);
});

test('client otomatis memakai Chrome terpasang di Windows', () => {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const config = { chromeExecutablePath: '' };
  assert.equal(
    resolveChromeExecutablePath(config, {
      platform: 'win32',
      env: { ProgramFiles: 'C:\\Program Files' },
      existsSync: (candidate) => candidate === chromePath
    }),
    chromePath
  );
  assert.equal(resolveChromeExecutablePath(config, { platform: 'linux' }), '');
});

test('client memberi error jelas untuk path Chrome yang dikonfigurasi tetapi tidak ada', () => {
  assert.throws(
    () => resolveChromeExecutablePath(
      { chromeExecutablePath: 'C:\\missing\\chrome.exe' },
      { existsSync: () => false }
    ),
    /CHROME_EXECUTABLE_PATH tidak ditemukan/
  );
});

test('QR dan event koneksi memperbarui status sesi', () => {
  const client = new EventEmitter();
  const runtimeStatus = { whatsapp: 'menginisialisasi' };
  const rendered = [];
  const errors = [];
  attachClientEvents({
    client,
    runtimeStatus,
    qrRenderer: (qr) => rendered.push(qr),
    messageService: async () => {},
    logger: { error: (message) => errors.push(message) }
  });
  client.emit('qr', 'qr-test');
  assert.equal(runtimeStatus.whatsapp, 'menunggu QR dipindai');
  assert.deepEqual(rendered, ['qr-test']);
  client.emit('authenticated');
  assert.equal(runtimeStatus.whatsapp, 'terautentikasi');
  client.emit('ready');
  assert.equal(runtimeStatus.whatsapp, 'terhubung');
  client.emit('disconnected');
  assert.equal(runtimeStatus.whatsapp, 'terputus');
  assert.equal(errors.length, 1);
});

test('pesan grup diklasifikasikan dan perintah private tidak membalas di grup', async () => {
  const replies = [];
  const config = { prefix: '!', ownerId: '', adminIds: [] };
  const service = createMessageService({ config, registry: new CommandRegistry(), sendText: async (to, text) => replies.push({ to, text }) });
  assert.equal(messageContext({ from: '12345@g.us' }), 'group');
  await service({ id: { _serialized: 'group-msg-1' }, from: '12345@g.us', author: '628123@c.us', isGroupMsg: true, body: '!ping' });
  assert.equal(replies.length, 0);
});

test('pesan WhatsApp duplikat tidak memicu balasan dua kali', async () => {
  const replies = [];
  const config = { prefix: '!', ownerId: '', adminIds: [] };
  const service = createMessageService({ config, registry: new CommandRegistry(), sendText: async (to, text) => replies.push({ to, text }) });
  const message = { id: { _serialized: 'private-msg-1' }, from: '628123@c.us', body: '!ping', fromMe: false };
  await service(message);
  await service(message);
  assert.equal(replies.length, 1);
  assert.equal(replies[0].text, 'Pong! RuzBot sedang berjalan.');
});
