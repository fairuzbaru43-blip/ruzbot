'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createWhatsAppClient } = require('./client');
const { createMessageService } = require('../services/message-service');

const MAX_ACCOUNTS = 5;

class WhatsAppSessionManager {
  constructor({ Client, LocalAuth, config, registry, accountStore, qrToDataUrl, logger = console, baseDir = process.cwd() }) {
    this.Client = Client;
    this.LocalAuth = LocalAuth;
    this.config = config;
    this.registry = registry;
    this.accountStore = accountStore;
    this.qrToDataUrl = qrToDataUrl;
    this.logger = logger;
    this.baseDir = baseDir;
    this.accounts = new Map();
    this.authPath = path.resolve(baseDir, config.sessionPath);
    this.operationQueue = Promise.resolve();
  }

  async restore() {
    const records = await this.accountStore.ensureDefaultAccount();
    for (const record of records) this.startAccount(record);
  }

  add(label) {
    return this.serialize(async () => {
      if (this.accounts.size >= MAX_ACCOUNTS) {
        throw new Error(`Maksimal ${MAX_ACCOUNTS} akun WhatsApp dapat ditautkan.`);
      }
      const record = {
        id: crypto.randomUUID(),
        label,
        createdAt: new Date().toISOString()
      };
      await this.accountStore.add(record);
      try {
        this.startAccount(record);
      } catch (error) {
        this.accounts.delete(record.id);
        await this.accountStore.remove(record.id);
        throw error;
      }
      return this.snapshot(record.id);
    });
  }

  serialize(operation) {
    const pending = this.operationQueue.then(operation);
    this.operationQueue = pending.catch(() => {});
    return pending;
  }

  startAccount(record) {
    const clientId = record.id === 'main' ? this.config.clientId : `${this.config.clientId}-${record.id}`;
    const client = createWhatsAppClient({
      Client: this.Client,
      LocalAuth: this.LocalAuth,
      config: { ...this.config, clientId },
      baseDir: this.baseDir
    });
    const account = {
      ...record,
      client,
      runtimeStatus: { whatsapp: 'menginisialisasi' },
      qr: null,
      error: null
    };
    this.accounts.set(record.id, account);

    client.on('qr', (value) => {
      account.runtimeStatus.whatsapp = 'menunggu QR dipindai';
      account.qr = null;
      account.error = null;
      this.qrToDataUrl(value)
        .then((qr) => {
          if (account.runtimeStatus.whatsapp === 'menunggu QR dipindai') account.qr = qr;
        })
        .catch((error) => {
          account.qr = null;
          account.error = 'QR tidak dapat dibuat. Muat ulang halaman atau periksa log server.';
          this.logger.error?.(`QR akun ${record.id} gagal dibuat:`, error.message);
        });
    });
    client.on('authenticated', () => {
      account.runtimeStatus.whatsapp = 'terautentikasi';
      account.qr = null;
      account.error = null;
    });
    client.on('ready', () => {
      account.runtimeStatus.whatsapp = 'terhubung';
      account.qr = null;
      account.error = null;
    });
    client.on('auth_failure', (message) => {
      account.runtimeStatus.whatsapp = 'gagal autentikasi';
      account.qr = null;
      account.error = String(message || 'Autentikasi WhatsApp gagal.');
      this.logger.error?.(`Autentikasi akun WhatsApp ${record.id} gagal:`, account.error);
    });
    client.on('disconnected', (reason) => {
      account.runtimeStatus.whatsapp = 'terputus';
      account.qr = null;
      account.error = reason ? String(reason) : null;
    });

    const messageService = createMessageService({
      config: this.config,
      registry: this.registry,
      runtimeStatus: account.runtimeStatus,
      sendText: (to, text) => client.sendMessage(to, text)
    });
    client.on('message', (message) => {
      messageService(message).catch((error) => this.logger.error?.('Pesan gagal diproses:', error.message));
    });

    client.initialize().catch((error) => {
      account.runtimeStatus.whatsapp = 'gagal memulai';
      account.qr = null;
      account.error = error.message;
      this.logger.error?.(`Akun WhatsApp ${record.id} gagal dimulai:`, error.message);
    });
  }

  list() {
    return [...this.accounts.keys()].map((id) => this.snapshot(id));
  }

  snapshot(accountId) {
    const account = this.accounts.get(accountId);
    if (!account) return null;
    return {
      id: account.id,
      label: account.label,
      createdAt: account.createdAt,
      status: account.runtimeStatus.whatsapp,
      qr: account.qr,
      error: account.error
    };
  }

  remove(accountId) {
    return this.serialize(async () => {
      const account = this.accounts.get(accountId);
      if (!account) throw new Error('Akun WhatsApp tidak ditemukan.');

      if (['terhubung', 'terautentikasi'].includes(account.runtimeStatus.whatsapp)) {
        await account.client.logout();
      }
      await account.client.destroy();
      const clientId = accountId === 'main' ? this.config.clientId : `${this.config.clientId}-${accountId}`;
      await fs.rm(path.join(this.authPath, `session-${clientId}`), { recursive: true, force: true });
      await this.accountStore.remove(accountId);
      this.accounts.delete(accountId);
    });
  }

  async destroy() {
    const results = await Promise.allSettled(
      [...this.accounts.values()].map((account) => account.client.destroy())
    );
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const account = [...this.accounts.values()][index];
        this.logger.error?.(`Gagal menutup browser akun ${account.id}:`, result.reason.message);
      }
    });
    this.accounts.clear();
  }
}

module.exports = { MAX_ACCOUNTS, WhatsAppSessionManager };
