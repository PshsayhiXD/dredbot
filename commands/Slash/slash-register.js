import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { REST, Routes } from 'discord.js';
import { pathToFileURL, fileURLToPath } from 'url';
import paths from '../../utils/path.js';
import config from '../../config.js';
import log from '../../utils/logger.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
export default async function registerSlashCommands(bot, mode = 'guild') {
  const commands = [];
  bot.slashCommands = new Map();
  const commandFiles = fs.readdirSync(paths.commands.Slash.root).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(paths.commands.Slash.root, file);
    const { default: command } = await import(`file://${filePath}`);
    if (!command?.data || typeof command.execute !== 'function') {
      log(`[registerSlashCommands] Skipping invalid slash command: ${file}`, 'warn');
      continue;
    }
    bot.slashCommands.set(command.data.name, command);
    const json = command.data.toJSON();
    commands.push(json);
    log(`[registerSlashCommands] Loaded slash command: ${command.data.name}`);
  }
  const TOKEN = process.env.DISCORD_TOKEN;
  const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    log(`[registerSlashCommands] Registering ${commands.length} slash command(s)...`, 'warn');
    if (mode === 'n') return log('[registerSlashComands] aborting registerSlash (bot.slashcommands stay the same)')
    else if (mode === 'global') {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, config.GUILD_ID), { body: [] });
      log('[registerSlashCommands] Cleared guild commands.', 'warn');
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      log(`[registerSlashCommands] Slash commands registered globally.`, 'warn');
    } else {
      const guildId = mode === 'global' ? null : mode === 'guild' ? config.GUILD_ID : mode;
      if (!guildId) throw new Error('Guild ID not specified and config.GUILD_ID missing.');
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: commands });
      log(`[registerSlashCommands] Slash commands registered to guild: ${guildId}`, 'warn');
    }
  } catch (error) {
    log(`[registerSlashCommands] Failed to register slash commands: ${error}`, 'error');
  }
}
