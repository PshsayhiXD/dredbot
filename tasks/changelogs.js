import fs from "fs";
import path from "path";
import paths from "../utils/path.js";
import config from "../config.js";
import log from "../utils/logger.js";

const changelogs = paths.database.changelogs;
const watching = paths.root;
const channelId = config.changelogsChannelID;
const ignore = (config.IGNORE_PATHS || []).map(p => path.resolve(watching, p));
const scanDir = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
  const p = path.resolve(d, e.name);
  if (ignore.some(i => p.startsWith(i))) return [];
  if (e.isDirectory()) return scanDir(p);
  const size = fs.statSync(p).size;
  return [[p, size]];
});
const loadData = () => fs.existsSync(changelogs) ? JSON.parse(fs.readFileSync(changelogs)) : {};
const saveData = d => fs.writeFileSync(changelogs, JSON.stringify(d, null, 2));
const formatSize = size => {
  if (size < 1024) return size + " B";
  if (size < 1024 * 1024) return (size / 1024).toFixed(2) + " KB";
  if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(2) + " MB";
  return (size / (1024 * 1024 * 1024)).toFixed(2) + " GB";
};
const sendChunks = async (ch, text) => {
  const maxLen = 2000;
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    const cut = remaining.lastIndexOf("\n", maxLen);
    chunks.push(remaining.slice(0, cut > 0 ? cut : maxLen));
    remaining = remaining.slice(cut > 0 ? cut + 1 : maxLen);
  }
  if (remaining) chunks.push(remaining);
  const sentMsgs = [];
  for (const chunk of chunks) sentMsgs.push(await ch.send(chunk));
  return sentMsgs;
};
const setupChangelogs = async bot => {
  const maxDay = config.MAX_CHANGELOG_AGE;
  const data = loadData();
  const snapshot = Object.fromEntries(scanDir(watching).map(([p, size]) => [p, { size }]));
  const nowDate = new Date().toISOString().split("T")[0];
  const tsNow = Math.floor(Date.now() / 1000);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxDay);
  for (const date of Object.keys(data)) {
    if (new Date(date) < cutoff) delete data[date];
  }
  if (!data[nowDate]) {
    data[nowDate] = { files: snapshot, msgIds: [], added: [], modified: [], deleted: [] };
    saveData(data);
    log("[changelogs.js] initialized today, skipping changelog.", "warn");
    return;
  }
  data[nowDate].added ||= [];
  data[nowDate].modified ||= [];
  data[nowDate].deleted ||= [];
  const oldSnap = data[nowDate].files;
  const added = Object.keys(snapshot).filter(k => !oldSnap[k]);
  const deleted = Object.keys(oldSnap).filter(k => !snapshot[k]);
  const modified = Object.keys(snapshot).filter(k => oldSnap[k] && oldSnap[k].size !== snapshot[k].size);
  if (!added.length && !deleted.length && !modified.length) return;
  const timeFmt = () => `<t:${Math.floor(Date.now() / 1000)}:T>`;
  for (const f of added) data[nowDate].added.push(`\`${path.relative(watching, f)}\` ${timeFmt()}`);
  for (const f of deleted) data[nowDate].deleted.push(`\`${path.relative(watching, f)}\` ${timeFmt()}`);
  for (const f of modified) {
    const rel = path.relative(watching, f);
    const oldSize = oldSnap[f].size;
    const newSize = snapshot[f].size;
    data[nowDate].modified.push(`\`${rel}\` (${formatSize(oldSize)} → **${formatSize(newSize)}**) ${timeFmt()}`);
  }
  const totalFiles = Object.keys(snapshot).length;
  const totalSize = formatSize(Object.values(snapshot).reduce((a, f) => a + (f.size || 0), 0));
  const addedLines = data[nowDate].added.length ? data[nowDate].added.join("\n") : "_no changes_";
  const modifiedLines = data[nowDate].modified.length ? data[nowDate].modified.join("\n") : "_no changes_";
  const deletedLines = data[nowDate].deleted.length ? data[nowDate].deleted.join("\n") : "_no changes_";
  const sections = [
    `🟢 **Added**:\n${addedLines}`,
    `🟡 **Modified**:\n${modifiedLines}`,
    `🔴 **Deleted**:\n${deletedLines}`,
    `# 📜 Summary\n- Added: **${data[nowDate].added.length}** | Deleted: **${data[nowDate].deleted.length}** | Modified: **${data[nowDate].modified.length}** | Total Files: **${totalFiles}** | Total Size: **${totalSize}**`
  ].join("\n\n");
  const header = `# <t:${tsNow}:R> **CHANGELOG**.`;
  const text = `${header}\n\n${sections}`;
  const ch = await bot.channels.fetch(channelId);
  if (data[nowDate].msgIds?.length) {
    try {
      const chunks = [];
      let remaining = text;
      while (remaining.length > 2000) {
        const cut = remaining.lastIndexOf("\n", 2000);
        chunks.push(remaining.slice(0, cut > 0 ? cut : 2000));
        remaining = remaining.slice(cut > 0 ? cut + 1 : 2000);
      }
      if (remaining) chunks.push(remaining);
      for (let i = 0; i < chunks.length; i++) {
        if (data[nowDate].msgIds[i]) {
          try {
            const msg = await ch.messages.fetch(data[nowDate].msgIds[i]);
            await msg.edit(chunks[i]);
          } catch {
            const sent = await ch.send(chunks[i]);
            data[nowDate].msgIds[i] = sent.id;
          }
        } else {
          const sent = await ch.send(chunks[i]);
          data[nowDate].msgIds.push(sent.id);
        }
      }
      if (data[nowDate].msgIds.length > chunks.length) {
        for (let i = chunks.length; i < data[nowDate].msgIds.length; i++) {
          try {
            const msg = await ch.messages.fetch(data[nowDate].msgIds[i]);
            await msg.delete();
          } catch {}
        }
        data[nowDate].msgIds = data[nowDate].msgIds.slice(0, chunks.length);
      }
    } catch {
      const sentMsgs = await sendChunks(ch, text);
      data[nowDate].msgIds = sentMsgs.map(m => m.id);
    }
  } else {
    const sentMsgs = await sendChunks(ch, text);
    data[nowDate].msgIds = sentMsgs.map(m => m.id);
  }
  for (const f of added.concat(modified)) oldSnap[f] = snapshot[f];
  for (const f of deleted) delete oldSnap[f];
  saveData(data);
  log("[changelogs.js] registered.", "success");
};

export default setupChangelogs;