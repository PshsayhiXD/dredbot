import { EmbedBuilder } from 'discord.js';
import { DateTime } from 'luxon';
import config from '../config.js';
import log from '../utils/logger.js';
const time = (tz) => {
  const dt = DateTime.now().setZone(tz);
  return {
    timeStr: dt.toFormat('HH:mm:ss'),
    timeStr12: dt.toFormat('hh:mma')
  };
};

const setupRegionTimer = async (bot) => {
  const channel = await bot.channels.fetch(config.RegionalTimerChannelID);
  if (!channel?.isTextBased()) return log('[-] regionTimer: Invalid channel.', 'warn');
  async function update() {
    const embed = new EmbedBuilder()
      .setTitle('🌏 Regional Timers')
      .setColor(0x808080)
      .setTimestamp()
      .setFooter({
        text: `Updates every ${config.REGIONAL_TIMER_INTERVAL}m`,
        iconURL: bot.user.displayAvatarURL()
      });
    for (const { name, tz } of config.REGIONAL_TIMER) {
      const { timeStr, timeStr12 } = time(tz);
      embed.addFields({
        name,
        value: `**\`${timeStr}\`** → \`${timeStr12}\``,
        inline: true
      });
    }
    try {
      const messages = await channel.messages.fetch({ limit: 10 });
      const exist = messages.find(m => m.author.id === bot.user.id && m.embeds.length > 0) || false;
      if (exist) await exist.edit({ embeds: [embed] });
      else await channel.send({ embeds: [embed] });
    } catch (err) {
      log(`[-] regionTimer: ${err.message}.`, 'error');
    }
  }
  await update();
  setInterval(update, config.REGIONAL_TIMER_INTERVAL * 60_000);
  log(`[regionTimer.js] registered.`, "success");
};

export default setupRegionTimer;
