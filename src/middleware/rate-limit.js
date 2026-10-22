'use strict';

class FixedWindowLimiter {
  constructor({ limit, windowMs, now = Date.now }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.windows = new Map();
  }

  allow(key) {
    const now = this.now();
    const current = this.windows.get(key);
    if (!current || now >= current.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (current.count >= this.limit) return false;
    current.count += 1;
    return true;
  }
}

module.exports = { FixedWindowLimiter };
