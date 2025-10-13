import fs from 'fs';
import path from 'path';
import paths from '../utils/path.js';
import { Collection } from 'discord.js';
import { pathToFileURL } from 'url';
import log from '../utils/logger.js';

function getCommandFiles(dir) {
  let files = [];
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) files = files.concat(getCommandFiles(fullPath));
    else if (file.endsWith('.js')) files.push(fullPath);
  }
  return files;
}

async function registerPrefixCommands(bot, selected = 'all') {
  bot.commands = new Collection();
  const commandFiles = getCommandFiles(paths.commands.root);
  for (const filePath of commandFiles) {
    try {
      const { default: command } = await import(pathToFileURL(filePath).href);
      if (!command?.name || typeof command.execute !== 'function') {
        log(`[registerPrefixCommands] Skipping invalid prefix command: ${filePath}`, 'warn');
        continue;
      }
      if (Array.isArray(selected) && !selected.includes(command.name)) {
        log(`[registerPrefixCommands] Skipping command not in specified list: ${command.name}`, 'warn');
        continue;
      }
      bot.commands.set(command.name, command);
      log(`[registerPrefixCommands] Loaded prefix command: ${command.name} (${command.id} [${command.aliases?.join(', ') || 'no aliases'}])`);
    } catch (err) {
      log(`[registerPrefixCommands] Failed to load ${filePath}: ${err}`, 'error');
    }
  }
  log(`[registerPrefixCommands] Loaded ${bot.commands.size} command(s).`);
}
export default registerPrefixCommands;
