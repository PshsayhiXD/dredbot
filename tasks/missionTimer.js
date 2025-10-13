import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import config from "../config.js";
import log from "../utils/logger.js";

const openDur = config.MISSION_CLOSE_DURATION;
const closeDur = config.MISSION_OPEN_DURATION;
const cycle = openDur + closeDur;

export let votes = { pits: 0, canary: 0, vulture: 0 };
export let voters = new Set();
export let lastState = null;

export const newMissionButtons = () => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId("vote_pits").setLabel(`Pits (${votes.pits})`).setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId("vote_canary").setLabel(`Canary (${votes.canary})`).setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId("vote_vulture").setLabel(`Vulture (${votes.vulture})`).setStyle(ButtonStyle.Danger)
);

const getMissionState = (firstOpenTs) => {
  const now = Math.floor(Date.now() / 1000);
  if (now < firstOpenTs) return { state: "CLOSED", timeLeft: firstOpenTs - now, nextChange: firstOpenTs };
  const elapsed = (now - firstOpenTs) % cycle;
  if (elapsed < openDur) return { state: "OPEN", timeLeft: openDur - elapsed, nextChange: now + (openDur - elapsed) };
  return { state: "CLOSED", timeLeft: cycle - elapsed, nextChange: now + (cycle - elapsed) };
};

const getFutureCycles = (firstOpenTs, count) => {
  const now = Math.floor(Date.now() / 1000);
  const cyclesPassed = Math.floor((now - firstOpenTs) / cycle);
  let t = firstOpenTs + cyclesPassed * cycle;
  if (t < now) t += cycle;
  const list = [];
  for (let i = 0; i < count; i++) {
    const o = t + i * cycle;
    const c = o + openDur;
    list.push({ open: o, close: c });
  }
  return list;
};

export const setupMissionTimer = async (bot) => {
  const channel = await bot.channels.fetch(config.MissionTimerChannelID);
  if (!channel?.isTextBased()) return log("[setupMissionTimer]: Invalid channel.", "error");
  const getWinningVote = () => {
    const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    if (sorted[0][1] === 0) return "No votes yet";
    return `${sorted[0][0][0].toUpperCase() + sorted[0][0].slice(1)} (${sorted[0][1]} votes)`;
  };
  async function update() {
    const { state, nextChange } = getMissionState(config.MISSION_START_TS);
    if (lastState !== state) {
      lastState = state;
      votes = { pits: 0, canary: 0, vulture: 0 };
      voters.clear();
    }
    const emoji = state === "OPEN" ? "✅" : "❌";
    const future = getFutureCycles(config.MISSION_START_TS, config.MISSION_SHOW_FUTURE || 3);
    let desc = `**State**: ${emoji} ${state}\n`;
    desc += state === "OPEN" ? `**Close in**: <t:${nextChange}:R>\n` : `**Open in**: <t:${nextChange}:R>\n`;
    desc += `**Current mission (based on votes)**: ${getWinningVote()}\n\n**Upcoming Missions:**\n`;
    for (const { open, close } of future) desc += `🟢 Open: <t:${open}:R> | 🔴 Close: <t:${close}:R>\n`;
    const embed = new EmbedBuilder()
      .setTitle("Mission Timer")
      .setColor(state === "OPEN" ? 0x00ff00 : 0xff0000)
      .setDescription(desc)
      .setTimestamp()
      .setFooter({ text: `Updates every ${config.MISSION_TIMER_INTERVAL}s`, iconURL: bot.user.displayAvatarURL() });
    try {
      const messages = await channel.messages.fetch({ limit: 10 });
      const exist = messages.find(m => m.author.id === bot.user.id && m.embeds.length > 0) || false;
      if (exist) await exist.edit({ embeds: [embed], components: [newMissionButtons()] });
      else await channel.send({ embeds: [embed], components: [newMissionButtons()] });
    } catch (err) {
      log(`[missionTimer]: ${err.message}`, "error");
    }
  }
  await update();
  setInterval(update, config.MISSION_TIMER_INTERVAL * 1000);
  log("[missionTimer.js] registered.", "success");
};

export default setupMissionTimer;