'use strict';

const { FixedWindowLimiter } = require('./rate-limit');

function createAiUsageLimiter(options = {}) {
  return new FixedWindowLimiter({ limit: options.limit ?? 5, windowMs: options.windowMs ?? 60 * 60 * 1000, now: options.now ?? Date.now });
}

function createDownloadLimiter(options = {}) {
  return new FixedWindowLimiter({ limit: options.limit ?? 3, windowMs: options.windowMs ?? 60 * 60 * 1000, now: options.now ?? Date.now });
}

module.exports = { createAiUsageLimiter, createDownloadLimiter };
