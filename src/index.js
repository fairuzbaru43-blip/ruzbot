'use strict';

const { loadEnvFile } = require('./config/load-env');
const { readConfig } = require('./config/env');
const { CommandRegistry } = require('./commands/registry');
const { createMessageService } = require('./services/message-service');
const { createWhatsAppClient, attachClientEvents } = require('./whatsapp/client');

async function main() {
  loadEnvFile();
  const config = readConfig();
  const { Client, LocalAuth } = require('whatsapp-web.js');
  const qrCode = require('qrcode-terminal');
  const runtimeStatus = { whatsapp: 'menginisialisasi' };
  const registry = new CommandRegistry();
  const client = createWhatsAppClient({ Client, LocalAuth, config });
  const messageService = createMessageService({
    config,
    registry,
    runtimeStatus,
    sendText: (to, text) => client.sendMessage(to, text)
  });

  attachClientEvents({
    client,
    runtimeStatus,
    messageService,
    qrRenderer: (qr) => qrCode.generate(qr, { small: true })
  });

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    console.log('\nMenutup koneksi WhatsApp...');
    try { await client.destroy(); }
    catch (error) { console.error('Gagal menutup browser WhatsApp:', error.message); }
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  await client.initialize();
  return client;
}

if (require.main === module) {
  main().catch((error) => {
    console.error('RuzBot gagal dijalankan:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { main };
