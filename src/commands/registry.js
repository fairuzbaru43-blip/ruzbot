'use strict';

const { commands: coreCommands } = require('./core');

class CommandRegistry {
  constructor(commands = coreCommands) {
    this.commands = commands.map((command) => ({ ...command, aliases: [...command.aliases], contexts: [...command.contexts] }));
    this.byName = new Map();
    for (const command of this.commands) {
      for (const key of [command.name, ...command.aliases]) {
        const normalized = key.toLowerCase();
        if (this.byName.has(normalized)) throw new Error(`Nama atau alias perintah duplikat: ${normalized}`);
        this.byName.set(normalized, command);
      }
    }
  }
  list() { return [...this.commands]; }
  find(name) { return this.byName.get(String(name || '').toLowerCase()); }
}

module.exports = { CommandRegistry };
