'use strict';

const { loadEnvFile } = require('./config/load-env');
const { readConfig } = require('./config/env');
const { CommandRegistry } = require('./commands/registry');
const { WhatsAppAccountStore } = require('./database/whatsapp-account-store');
const { WhatsAppSessionManager } = require('./whatsapp/session-manager');
const { createDashboardServer } = require('./web/server');

async function main() {
  loadEnvFile();
  const config = readConfig();
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('PORT harus berupa angka antara 1 sampai 65535.');
  }
  const { Client, LocalAuth } = require('whatsapp-web.js');
  const qrCode = require('qrcode');
  const registry = new CommandRegistry();
  const accountStore = new WhatsAppAccountStore();
  const manager = new WhatsAppSessionManager({
    Client,
    LocalAuth,
    config,
    registry,
    accountStore,
    qrToDataUrl: (qr) => qrCode.toDataURL(qr, { width: 240, margin: 2 })
  });
  const server = createDashboardServer({ config, manager });

  try {
    await manager.restore();
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.port, '0.0.0.0', resolve);
    });
  } catch (error) {
    await manager.destroy();
    throw error;
  }
  console.log(`RuzBot dashboard aktif di port ${config.port}.`);

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    console.log('\nMenutup dashboard dan sesi WhatsApp...');
    try {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
      await manager.destroy();
    } catch (error) {
      console.error('Gagal menutup layanan dengan bersih:', error.message);
      process.exitCode = 1;
    }
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  return { server, manager };
}

if (require.main === module) {
  main().catch((error) => {
    console.error('RuzBot gagal dijalankan:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { main };
