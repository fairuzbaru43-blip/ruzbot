'use strict';

const { hasPermission } = require('../middleware/permissions');
const { FixedWindowLimiter } = require('../middleware/rate-limit');
const { validateUserText } = require('../utils/security');

function parseCommand(text, prefix) {
  const valid = validateUserText(text);
  if (!valid.ok || !valid.value.startsWith(prefix)) return null;
  const body = valid.value.slice(prefix.length).trim();
  if (!body) return null;
  const [name, ...args] = body.split(/\s+/);
  return { name: name.toLowerCase(), args };
}

function createDispatcher({ config, registry, sendText, logger = console, runtimeStatus = { whatsapp: 'disconnected' }, limiter = new FixedWindowLimiter({ limit: 20, windowMs: 60_000 }) }) {
  return async function dispatch({ senderId, text, context = 'private' }) {
    const parsed = parseCommand(text, config.prefix);
    if (!parsed) return { handled: false };
    const command = registry.find(parsed.name);
    if (!command) {
      await sendText(senderId, `Perintah tidak dikenal. Ketik ${config.prefix}help.`);
      return { handled: true, command: null };
    }
    if (!command.contexts.includes(context)) return { handled: true, command: command.name, reason: 'unsupported_context' };
    if (!hasPermission(senderId, command.permissions, config)) {
      await sendText(senderId, 'Kamu tidak memiliki izin untuk perintah ini.');
      return { handled: true, command: command.name, reason: 'forbidden' };
    }
    if (!limiter.allow(senderId)) {
      await sendText(senderId, 'Terlalu banyak perintah. Coba lagi sebentar.');
      return { handled: true, command: command.name, reason: 'rate_limited' };
    }
    try {
      const response = await command.handler({ args: parsed.args, config, registry, prefix: config.prefix, senderId, context, runtimeStatus });
      if (response) await sendText(senderId, response);
      return { handled: true, command: command.name };
    } catch (error) {
      logger.error?.('Command handler failed', { command: command.name, message: error.message });
      await sendText(senderId, 'Terjadi kendala saat menjalankan perintah. Coba lagi nanti.');
      return { handled: true, command: command.name, reason: 'error' };
    }
  };
}

module.exports = { parseCommand, createDispatcher };
