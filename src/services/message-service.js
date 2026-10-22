'use strict';

const { FixedWindowLimiter } = require('../middleware/rate-limit');
const { createDispatcher } = require('../handlers/dispatch');

function messageContext(message) {
  return message?.isGroupMsg || String(message?.from || '').endsWith('@g.us') ? 'group' : 'private';
}

function createMessageService({ config, registry, sendText, logger = console, runtimeStatus = { whatsapp: 'disconnected' }, limiter }) {
  const dispatch = createDispatcher({ config, registry, sendText, logger, runtimeStatus, limiter: limiter || new FixedWindowLimiter({ limit: 20, windowMs: 60_000 }) });
  const seen = new Map();

  return async function handleMessage(message) {
    if (!message || message.fromMe || message.from === 'status@broadcast' || typeof message.body !== 'string') return { handled: false };
    const senderId = message.author || message.from;
    if (!senderId) return { handled: false };
    const id = message.id?._serialized || (typeof message.id === 'string' ? message.id : '');
    if (id && seen.has(id)) {
      const previous = seen.get(id);
      if (!previous.promise) return { handled: false, duplicate: true };
      try { await previous.promise; return { handled: false, duplicate: true }; }
      catch { if (seen.get(id) === previous) seen.delete(id); }
    }

    const pending = dispatch({ senderId, text: message.body, context: messageContext(message) });
    if (id) seen.set(id, { promise: pending });
    try {
      const result = await pending;
      if (id) seen.set(id, { handled: true });
      if (seen.size > 1000) {
        for (const [seenId, item] of seen) {
          if (!item.promise) { seen.delete(seenId); break; }
        }
      }
      return result;
    } catch (error) {
      if (id) seen.delete(id);
      throw error;
    }
  };
}

module.exports = { messageContext, createMessageService };
