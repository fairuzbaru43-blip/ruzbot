'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CommandRegistry } = require('../src/commands/registry');
const { parseCommand, createDispatcher } = require('../src/handlers/dispatch');
const { hasPermission } = require('../src/middleware/permissions');
const { FixedWindowLimiter } = require('../src/middleware/rate-limit');
const { createAiUsageLimiter } = require('../src/middleware/feature-limits');

const config = { prefix: '!', ownerId: '628111', adminIds: ['628222'] };

test('parsing prefix, nama, alias, dan argumen', () => {
  assert.deepEqual(parseCommand('!ping extra value', '!'), { name: 'ping', args: ['extra', 'value'] });
  assert.equal(parseCommand('ping', '!'), null);
  assert.equal(parseCommand('!   ', '!'), null);
  assert.equal(parseCommand('!'.repeat(4100), '!'), null);
});

test('registry help dinamis mencari nama dan alias', async () => {
  const registry = new CommandRegistry();
  assert.equal(registry.find('menu').name, 'help');
  assert.equal(registry.find('p').name, 'ping');
  const replies = [];
  const dispatch = createDispatcher({ config, registry, sendText: async (_to, text) => replies.push(text) });
  await dispatch({ senderId: '628333', text: '!help ping' });
  assert.match(replies[0], /Periksa bahwa bot menerima/);
  await dispatch({ senderId: '628333', text: '!menu' });
  assert.match(replies[1], /perintah tersedia/);
});

test('perintah tidak dikenal memberi arahan bantuan', async () => {
  const replies = [];
  const dispatch = createDispatcher({ config, registry: new CommandRegistry(), sendText: async (_to, text) => replies.push(text) });
  await dispatch({ senderId: '628333', text: '!doesnotexist' });
  assert.match(replies[0], /!help/);
});

test('owner/admin diperiksa dari daftar konfigurasi', () => {
  assert.equal(hasPermission('628111', 'owner', config), true);
  assert.equal(hasPermission('628222', 'owner', config), false);
  assert.equal(hasPermission('628222', 'admin', config), true);
  assert.equal(hasPermission('628333', 'admin', config), false);
});

test('kesalahan handler dibalas tanpa membocorkan detail', async () => {
  const registry = new CommandRegistry([{ name: 'broken', aliases: [], category: 'test', description: 'fault test', permissions: 'user', contexts: ['private'], handler: async () => { throw new Error('secret internals'); } }]);
  const replies = [];
  const logs = [];
  const dispatch = createDispatcher({ config, registry, sendText: async (_to, text) => replies.push(text), logger: { error: (...args) => logs.push(args) } });
  const result = await dispatch({ senderId: '628333', text: '!broken' });
  assert.equal(result.reason, 'error');
  assert.match(replies[0], /kendala/);
  assert.doesNotMatch(replies[0], /secret/);
  assert.equal(logs.length, 1);
});

test('pembatasan laju menolak pemakaian berlebih dan pulih setelah jendela', () => {
  let now = 0;
  const limiter = new FixedWindowLimiter({ limit: 2, windowMs: 1000, now: () => now });
  assert.equal(limiter.allow('user'), true);
  assert.equal(limiter.allow('user'), true);
  assert.equal(limiter.allow('user'), false);
  now = 1000;
  assert.equal(limiter.allow('user'), true);
});

test('batas AI per pengguna terpisah dan tidak mengaktifkan provider AI', () => {
  const limiter = createAiUsageLimiter({ limit: 2, windowMs: 1000 });
  assert.equal(limiter.allow('628111'), true);
  assert.equal(limiter.allow('628111'), true);
  assert.equal(limiter.allow('628111'), false);
  assert.equal(limiter.allow('628222'), true);
});
