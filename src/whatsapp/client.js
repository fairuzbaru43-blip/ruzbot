'use strict';

const fs = require('node:fs');
const path = require('node:path');

function resolveChromeExecutablePath(config, { platform = process.platform, env = process.env, existsSync = fs.existsSync } = {}) {
  const configuredPath = config.chromeExecutablePath?.trim();
  if (configuredPath) {
    if (!existsSync(configuredPath)) {
      throw new Error(`CHROME_EXECUTABLE_PATH tidak ditemukan: ${configuredPath}`);
    }
    return configuredPath;
  }

  if (platform !== 'win32') return '';

  const candidates = [
    path.win32.join(env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.win32.join(env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.win32.join(env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ];
  return candidates.find((candidate) => existsSync(candidate)) || '';
}

function createWhatsAppClient({ Client, LocalAuth, config, baseDir = process.cwd() }) {
  const authPath = path.resolve(baseDir, config.sessionPath);
  const puppeteer = { headless: true };
  const chromeExecutablePath = resolveChromeExecutablePath(config);
  if (chromeExecutablePath) puppeteer.executablePath = chromeExecutablePath;
  return new Client({
    authStrategy: new LocalAuth({ clientId: config.clientId, dataPath: authPath }),
    puppeteer
  });
}

function attachClientEvents({ client, qrRenderer, messageService, runtimeStatus, logger = console }) {
  client.on('qr', (qr) => {
    runtimeStatus.whatsapp = 'menunggu QR dipindai';
    console.log('Pindai QR ini melalui WhatsApp > Perangkat tertaut > Tautkan perangkat:');
    qrRenderer(qr);
  });
  client.on('authenticated', () => {
    runtimeStatus.whatsapp = 'terautentikasi';
    console.log('Sesi WhatsApp berhasil diautentikasi. Menunggu koneksi siap...');
  });
  client.on('ready', () => {
    runtimeStatus.whatsapp = 'terhubung';
    console.log('RuzBot terhubung ke WhatsApp Web.');
  });
  client.on('auth_failure', () => {
    runtimeStatus.whatsapp = 'gagal autentikasi';
    logger.error?.('Autentikasi WhatsApp gagal. Hapus sesi lokal jika perlu, lalu pindai QR baru.');
  });
  client.on('disconnected', () => {
    runtimeStatus.whatsapp = 'terputus';
    logger.error?.('Sesi WhatsApp terputus. Jalankan ulang bot dan tautkan perangkat kembali jika diminta.');
  });
  client.on('message', (message) => {
    messageService(message).catch((error) => logger.error?.('Pesan gagal diproses:', error.message));
  });
}

module.exports = { createWhatsAppClient, resolveChromeExecutablePath, attachClientEvents };
