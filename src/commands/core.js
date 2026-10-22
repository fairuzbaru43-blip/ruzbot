'use strict';

const commands = [
  {
    name: 'help', aliases: ['menu', 'bantuan'], category: 'bot',
    description: 'Cari perintah atau tampilkan daftar perintah yang tersedia.',
    permissions: 'user', contexts: ['private'], implementationStatus: 'active', apiDependency: 'Sesi WhatsApp Web tertaut',
    handler: async ({ args, registry, prefix }) => {
      const query = args.join(' ').trim().toLowerCase();
      if (query) {
        const command = registry.find(query);
        return command ? `${prefix}${command.name} — ${command.description}\nKategori: ${command.category}\nAlias: ${command.aliases.length ? command.aliases.join(', ') : '—'}` : `Perintah "${query}" tidak ditemukan. Ketik ${prefix}help untuk daftar.`;
      }
      const grouped = new Map();
      for (const command of registry.list()) {
        const group = grouped.get(command.category) || [];
        group.push(`${prefix}${command.name}${command.aliases.length ? ` (${command.aliases.join(', ')})` : ''}`);
        grouped.set(command.category, group);
      }
      return ['RuzBot — perintah tersedia:', ...[...grouped].map(([category, entries]) => `${category}: ${entries.join(', ')}`), `Ketik ${prefix}help <nama> untuk deskripsi.`].join('\n');
    }
  },
  {
    name: 'ping', aliases: ['p'], category: 'bot',
    description: 'Periksa bahwa bot menerima dan memproses pesan.',
    permissions: 'user', contexts: ['private'], implementationStatus: 'active', apiDependency: 'Sesi WhatsApp Web tertaut',
    handler: async () => 'Pong! RuzBot sedang berjalan.'
  },
  {
    name: 'status', aliases: [], category: 'bot',
    description: 'Lihat status konfigurasi koneksi dan integrasi.',
    permissions: 'user', contexts: ['private'], implementationStatus: 'active', apiDependency: 'Sesi WhatsApp Web tertaut',
    handler: async ({ runtimeStatus }) => {
      return [
        `Status koneksi WhatsApp Web: ${runtimeStatus.whatsapp}.`,
        'AI, downloader, anime, pencarian, dan musik: belum dikonfigurasi; perintahnya tidak diaktifkan.'
      ].join('\n');
    }
  }
];

module.exports = { commands };
