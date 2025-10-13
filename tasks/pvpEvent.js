import { EmbedBuilder } from 'discord.js';
import { helper }  from '../utils/helper.js';
import config from '../config.js';
import log from '../utils/logger.js';

const setupPvpEvent = async (bot) => {
  const scheduleEvents = async () => {
    let events;
    try { events = await helper.pvpEvent('all');
    } catch (err) { return log(`[setupPvpEvent]: Failed to fetch PvP event schedule: ${err}.`, "error") }
    const now = new Date(Date.now());
    const upcoming = events.map(e => ({ date: new Date(e.date) })).filter(e => e.date > new Date());
    const channel = bot.channels.cache.get(config.PvpEventChannelID);
    for (const { date } of upcoming) {
      const startTime = date.getTime();
      const pingTime = (startTime - 30 * 60 * 1000) - now;
      if (pingTime <= 0) continue;
      setTimeout(async () => {
        const unix = Math.floor(startTime / 1000);
        const embed = new EmbedBuilder()
          .setTitle('PvP Event Starting Soon')
          .setDescription(`A PvP event is starting <t:${unix}:R>!\nStart time: <t:${unix}:F>`)
          .setColor(0xff5555)
          .setTimestamp();
        try {
          const pingMessage = await channel.send({
            content: `<@&${config.PvpEventPingRoleID}>`,
            embeds: [embed],
          });
          setTimeout(() => {
            pingMessage.delete().catch(err => { log(`[setupPvpEvent]: Failed to delete ping message: ${err.message}.`, "warn") });
          }, 2 * 60 * 1000);
        } catch (err) {
          log(`[setupPvpEvent]: Failed to send or delete ping message: ${err.message}.`, "error");
        }
      }, pingTime);
    }
    const embed = new EmbedBuilder().setTitle('PvP Event Schedule').setColor(0x00bfff).setTimestamp();
    for (const { date } of upcoming.slice(0, 5)) {
      const unix = Math.floor(new Date(date).getTime() / 1000);
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
      embed.addFields({ name: dayOfWeek, value: `<t:${unix}:F> - <t:${unix}:R>`, inline: false });
    }
    const formattedDate = now.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    embed.setFooter({
      text: `${bot.user.username} | ${formattedDate}`,
      iconURL: bot.user.displayAvatarURL()
    });
    const messages = await channel.messages.fetch({ limit: 10 });
    const existing = messages.find(m => m.author.id === bot.user.id);
    if (existing) await existing.edit({ embeds: [embed] });
    else await channel.send({ embeds: [embed] });
    setTimeout(scheduleEvents, 24 * 60 * 60 * 1000);
  };
  await scheduleEvents();
  log(`[pvpEvent.js] registered.`, "success");
}
export default setupPvpEvent;
