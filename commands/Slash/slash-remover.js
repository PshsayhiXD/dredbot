import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import paths from '../../utils/path.js'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const { default: config } = await import(pathToFileURL(paths.config).href);
const { log } = await import(pathToFileURL(paths.utils.helper).href);
/**
 * Remove all slash commands (global or guild)
 * @param {'global' | string} mode - 'global' or a guild ID (or use config.GUILD_ID)
 */
export default async function removeSlashCommands(mode = 'guild') {
  const TOKEN = process.env.DISCORD_TOKEN;
  const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    if (mode === 'global') {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
      log(`[+] All global slash commands removed.`);
    } else {
      const guildId = mode === 'guild' ? config.GUILD_ID : mode;
      if (!guildId) throw new Error('Guild ID not specified and config.GUILD_ID missing.');
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: [] });
      log(`[+] All slash commands removed from guild: ${guildId}`);
    }
  } catch (error) {
    log(`[-] Failed to remove slash commands: ${error}`, 'error');
  }
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const modeArg = process.argv[2] || 'guild';
  (async function() {
    await removeSlashCommands(modeArg);
  })();
}

