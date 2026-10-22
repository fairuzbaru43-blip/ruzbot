'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

class WhatsAppAccountStore {
  constructor(filePath = path.resolve(process.cwd(), 'data', 'whatsapp-accounts.json')) {
    this.filePath = path.resolve(filePath);
    this.writeQueue = Promise.resolve();
  }

  async read() {
    let value;
    try {
      value = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }

    if (!value || !Array.isArray(value.accounts)) {
      throw new Error('Format database akun WhatsApp tidak valid.');
    }
    for (const account of value.accounts) {
      if (
        !account ||
        typeof account.id !== 'string' ||
        !/^[a-zA-Z0-9-]{1,64}$/.test(account.id) ||
        typeof account.label !== 'string' ||
        typeof account.createdAt !== 'string'
      ) {
        throw new Error('Data akun WhatsApp tidak valid.');
      }
    }
    return value.accounts;
  }

  async write(accounts) {
    const operation = this.writeQueue.then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temporary = `${this.filePath}.${crypto.randomUUID()}.tmp`;
      await fs.writeFile(temporary, `${JSON.stringify({ accounts }, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600
      });
      await fs.rename(temporary, this.filePath);
    });
    this.writeQueue = operation.catch(() => {});
    return operation;
  }

  async ensureDefaultAccount() {
    const existing = await this.read();
    if (existing) return existing;
    const accounts = [{ id: 'main', label: 'RuzBot', createdAt: new Date().toISOString() }];
    await this.write(accounts);
    return accounts;
  }

  async list() {
    return (await this.read()) || [];
  }

  async add(account) {
    const accounts = await this.list();
    if (accounts.some((item) => item.id === account.id)) {
      throw new Error('ID akun WhatsApp sudah digunakan.');
    }
    accounts.push(account);
    await this.write(accounts);
  }

  async remove(accountId) {
    const accounts = await this.list();
    if (!accounts.some((account) => account.id === accountId)) {
      throw new Error('Akun WhatsApp tidak ditemukan.');
    }
    await this.write(accounts.filter((account) => account.id !== accountId));
  }
}

module.exports = { WhatsAppAccountStore };
