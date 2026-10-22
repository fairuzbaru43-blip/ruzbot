'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

class JsonStore {
  constructor(filePath = path.resolve(process.cwd(), 'data', 'store.json')) {
    this.filePath = path.resolve(filePath);
    this.writeQueue = Promise.resolve();
  }

  async read() {
    try {
      const value = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      if (!value || typeof value !== 'object' || Array.isArray(value) || !value.profiles || !value.sessions) throw new Error('Format database tidak valid.');
      return value;
    } catch (error) {
      if (error.code === 'ENOENT') return { profiles: {}, sessions: {} };
      throw error;
    }
  }

  async update(mutator) {
    const operation = this.writeQueue.then(async () => {
      const data = await this.read();
      const next = await mutator(data) || data;
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.${crypto.randomUUID()}.tmp`;
      await fs.writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
      await fs.rename(temporary, this.filePath);
      return next;
    });
    this.writeQueue = operation.catch(() => {});
    return operation;
  }

  async getProfile(userId) {
    const data = await this.read();
    return data.profiles[String(userId)] || null;
  }

  async setProfile(userId, profile) {
    return this.update((data) => { data.profiles[String(userId)] = profile; });
  }

  async getSession(sessionId) {
    const data = await this.read();
    return data.sessions[String(sessionId)] || null;
  }

  async setSession(sessionId, session) {
    return this.update((data) => { data.sessions[String(sessionId)] = session; });
  }

  async deleteSession(sessionId) {
    return this.update((data) => { delete data.sessions[String(sessionId)]; });
  }
}

module.exports = { JsonStore };
