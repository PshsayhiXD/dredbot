import { EmbedBuilder } from "discord.js";
import { version } from "../version.js";
import config from "../config.js";
import log from "../utils/logger.js";
const setupCurrentVersion = async (bot) => {
  const channelId = config.CurrentVersionChannelID;
  if (!channelId) return log("[currentVersion.js] No CurrentVersionChannelID in config.", "warn");
  const guild = bot.guilds.cache.get(config.GUILD_ID);
  if (!guild) return log("[currentVersion.js] Guild not found.", "warn");
  const ch = guild.channels.cache.get(channelId);
  if (!ch?.isTextBased?.()) return log("[currentVersion.js] Channel not found or not text-based.", "warn");
  try {
    const summary = await version();
    log(`[currentVersion.js] ${summary}`, "success");
    const embed = new EmbedBuilder()
      .setTitle("📦 Current Version")
      .setDescription("```" + summary + "```")
      .setColor(0x57f287)
      .setTimestamp()
      .setFooter({ text: "Version Manager." });
    const msgs = await ch.messages.fetch({ limit: 5 });
    const last = msgs.find(m => m.author.id === bot.user.id && m.embeds.length);
    if (last) {
      await last.edit({ embeds: [embed] });
      log("[currentVersion.js] Updated existing version message.", "success");
    } else {
      await ch.send({ embeds: [embed] });
      log("[currentVersion.js] Sent new version message.", "success");
    }
  } catch (err) {
    log(`[currentVersion.js] Error: ${err.stack}`, "error");
  }
  log("[currentVersion.js] registered.", "success");
};
export default setupCurrentVersion;