import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, StringSelectMenuBuilder } from "discord.js";
import Canvas, { loadImage } from "canvas";
import fs from "fs";
import path from "path";
import config from "../config.js";
import paths from "../utils/path.js";
import log from "../utils/logger.js";
import * as cheerio from 'cheerio';

const activeship = paths.database.active_ship;
export let submittedLinks = new Map();
export const loadSubmittedLinks = () => {
  try {
    if (!fs.existsSync(activeship)) return;
    const raw = fs.readFileSync(activeship, "utf-8");
    const json = JSON.parse(raw);
    submittedLinks = new Map(Object.entries(json));
    log(`[shipTracker.js] loaded ${submittedLinks.size} ship links from database.`, "success");
  } catch (err) {
    log(`[shipTracker.js] failed to load submitted links: ${err.message}`, "error");
  }
};
export const saveSubmittedLinks = () => {
  try {
    const obj = Object.fromEntries(submittedLinks);
    fs.mkdirSync(path.dirname(activeship), { recursive: true });
    fs.writeFileSync(activeship, JSON.stringify(obj, null, 2));
  } catch (err) {
    log(`[shipTracker.js] failed to save submitted links: ${err.message}`, "error");
  }
};
const fetchShipList = async () => {
  try {
    const res = await fetch("https://drednot.io/shiplist?server=0", {
      headers: {
        "Cookie": `anon_key=${config.DREDNOT_ANON_KEY}`,
        "User-Agent": "Mozilla/5.0"
      }
    });
    return await res.json();
  } catch (err) {
    log(`[fetchShipList]: fetch error: ${err.message}`, "error");
    return null;
  }
};
const fetchShipFromLink = async (link) => {
  try {
    const res = await fetch(link, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Cookie": `anon_key=${config.DREDNOT_ANON_KEY}`
      }
    });
    if (!res.ok) return {valid: false};
    const html = await res.text();
    const $ = cheerio.load(html);
    const ogTitle = $('meta[property="og:title"]').attr("content") || "";
    const ogImage = $('meta[property="og:image"]').attr("content") || null;
    const shipName = ogTitle
      .replace(/^(Invite:|Ship:)\s*/, "")
      .replace(/\s*[-|]\s*drednot\.io$/i, "")
      .trim();
    if (!shipName || shipName === "Deep Space Airships") return { valid: false };
    return {valid: true, shipName, shipImage: ogImage};
  } catch {
    return {valid: false};
  }
};
const drawShipsCard = async (ships, updateInterval, totalPlayers, maxPlayers) => {
  const width = 900;
  const padding = 20;
  const maxHeight = 2000;
  const defaultBoxHeight = 120;
  const totalContentHeight = ships.length * (defaultBoxHeight + padding) + 100;
  let boxHeight = defaultBoxHeight;
  if (totalContentHeight > maxHeight) boxHeight = Math.floor((maxHeight - 100 - ships.length * padding) / ships.length);
  const canvasHeight = Math.min(maxHeight, totalContentHeight);
  const canvas = Canvas.createCanvas(width, canvasHeight);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1e1e1e";
  ctx.fillRect(0, 0, width, canvasHeight);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("All Ships Online", width / 2, 50);
  if (updateInterval) {
    ctx.textAlign = "left";
    ctx.font = "18px sans-serif";
    ctx.fillStyle = "#cccccc";
    ctx.fillText(`Updates every ${updateInterval}s`, padding, 30);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const iconSize = Math.min(boxHeight * 0.75, 90);
  for (let i = 0; i < ships.length; i++) {
    const ship = ships[i];
    const y = 80 + i * (boxHeight + padding);
    const radius = Math.min(20, boxHeight / 2);
    const [r, g, b] = ship.color.match(/\d+/g).map(Number);
    const gradient = ctx.createLinearGradient(padding, y, width - padding, y + boxHeight);
    gradient.addColorStop(0, `rgba(${r},${g},${b},0.9)`);
    gradient.addColorStop(1, `rgba(${r},${g},${b},0.6)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(padding + radius, y);
    ctx.lineTo(width - padding - radius, y);
    ctx.quadraticCurveTo(width - padding, y, width - padding, y + radius);
    ctx.lineTo(width - padding, y + boxHeight - radius);
    ctx.quadraticCurveTo(width - padding, y + boxHeight, width - padding - radius, y + boxHeight);
    ctx.lineTo(padding + radius, y + boxHeight);
    ctx.quadraticCurveTo(padding, y + boxHeight, padding, y + boxHeight - radius);
    ctx.lineTo(padding, y + radius);
    ctx.quadraticCurveTo(padding, y, padding + radius, y);
    ctx.closePath();
    ctx.fill();
    const iconX = padding + iconSize / 2;
    const iconY = y + boxHeight / 2;
    ctx.fillStyle = "#2a2a2a";
    ctx.beginPath();
    ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    if (ship.icon_path) {
      try {
        const icon = await loadImage(ship.icon_path);
        ctx.save();
        ctx.beginPath();
        ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(icon, padding, y + (boxHeight - iconSize) / 2, iconSize, iconSize);
        ctx.restore();
      } catch {}
    }
    const textX = padding + iconSize + 30;
    const textWidth = width - textX - padding;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(textX - 10, y + 10, textWidth, boxHeight - 20);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.floor(boxHeight / 4)}px sans-serif`;
    ctx.fillText(`[${ship.ourId}] ${ship.team_name || ship.shipName || "Unknown"}`, textX, y + boxHeight / 3);
    if (ship.team_name) {
      ctx.font = `${Math.floor(boxHeight / 6)}px sans-serif`;
      ctx.fillText(`Players: ${ship.player_count}`, textX, y + (2 * boxHeight) / 3);
      ctx.font = `${Math.floor(boxHeight / 8)}px sans-serif`;
      ctx.fillStyle = "#cccccc";
      ctx.fillText(`Ship Index: ${ship.ship_id}`, textX, y + boxHeight - 20);
    }
  }
  return canvas;
};
const setupShipTracker = async bot => {
  loadSubmittedLinks();
  const channel = await bot.channels.fetch(config.ShipTrackerChannelID);
  if (!channel?.isTextBased()) return log('[setupShipTracker]: Invalid channel.', 'warn');
  async function update() {
    const data = await fetchShipList();
    if (!data) return;
    try {
      let fetched;
      do {
        fetched = await channel.messages.fetch({ limit: 2 });
        if (fetched.size > 0) await channel.bulkDelete(fetched, true);
      } while (fetched.size >= 2);
      if (!data.ships || Object.keys(data.ships).length === 0) return await channel.send('No ships online. _Empty skies_');
      const sortedShips = [
        ...Object.entries(data.ships).map(([id, ship], idx) => ({
          ...ship,
          ship_id: id,
          ourId: idx + 1,
        })),
        ...[...submittedLinks.entries()]
          .filter(([_, v]) => v.valid && v.data?.shipName)
          .map(([link, v], idx) => ({
            shipName: v.data.shipName,
            shipLink: link,
            ship_id: null,
            ourId: Object.keys(data.ships).length + idx + 1,
            color: 'rgb(100,100,100)',
          })),
      ].sort((a, b) => {
        if (a.player_count != null && b.player_count != null) return a.player_count - b.player_count;
        if (a.player_count != null) return -1;
        if (b.player_count != null) return 1;
        return 0;
      });
      const canvas = await drawShipsCard(sortedShips, config.SHIP_TRACKER_INTERVAL, data.max_player_count ? data.total_player_count : undefined, data.max_player_count ? data.max_player_count : undefined);
      const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'ships.png' });
      const ts = Math.floor(Date.now() / 1000);
      const submittedOptions = [...submittedLinks.entries()]
        .filter(([_, v]) => v.valid && v.data?.shipName)
        .map(([link, v]) => ({
          label: v.data.shipName,
          description: link,
          value: link,
        }));
      const components = [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('shiptracker_download_json').setLabel('⬇️ Download JSON').setStyle(2),
          new ButtonBuilder().setCustomId('shiptracker_search').setLabel('🔍 Search Ship').setStyle(1),
          new ButtonBuilder().setCustomId('shiptracker_submit').setLabel('🚀 Submit Ship Link').setStyle(1)
        ),
      ];
      if (submittedOptions.length > 0) {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('shiptracker_submitted_ships')
          .setPlaceholder('📜 Submitted Ships')
          .addOptions([
            {
              label: 'Last Refresh',
              description: new Date().toLocaleString(),
              value: 'last_refresh',
              default: true,
            },
            ...submittedOptions,
          ]);
        components.push(new ActionRowBuilder().addComponents(selectMenu));
      }
      await channel.send({
        content: `<t:${ts}:R>`,
        files: [attachment],
        components,
      });
    } catch (err) {
      log(`[shipTracker.js]: ${err.message}`, 'error');
    }
  }
  setInterval(async () => {
    for (const [link] of submittedLinks) {
      const data = await fetchShipFromLink(link);
      if (!data) submittedLinks.set(link, { valid: false, data: null });
      else submittedLinks.set(link, { valid: true, data });
    }
    saveSubmittedLinks();
  }, config.SHIP_LINK_REFRESH_INTERVAL * 1000);
  await update();
  setInterval(update, config.SHIP_TRACKER_INTERVAL * 1000);
  log(`[shipTracker] registered, updates every ${config.SHIP_TRACKER_INTERVAL}s.`, "success");
};

export default setupShipTracker;