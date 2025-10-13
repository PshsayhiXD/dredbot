import fs from "fs";
import crypto from "crypto";
import config from "./config.js";
const getPaths = async () => (await import("./utils/path.js")).default;
const readFileSafe = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const cleanContent = (txt) => txt.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, "");
const shouldIgnore = (p) => typeof p === "string" && config.IGNORE_PATHS.some(ig => p.includes(ig));
const hashFolder = (item) => {
  const hash = crypto.createHash("sha256");
  if (!item) return hash.digest("hex");
  if (typeof item === "string") {
    if (!fs.existsSync(item) || shouldIgnore(item)) return hash.digest("hex");
    const stat = fs.statSync(item);
    if (stat.isDirectory()) {
      for (const f of fs.readdirSync(item)) hash.update(hashFolder(`${item}/${f}`));
    } else if (stat.isFile()) hash.update(cleanContent(fs.readFileSync(item, "utf8")));
  } else if (typeof item === "object") {
    if (item.root && fs.existsSync(item.root) && !shouldIgnore(item.root)) hash.update(hashFolder(item.root));
    for (const k in item) if (k !== "root" && item[k]) hash.update(hashFolder(item[k]));
  }
  return hash.digest("hex");
};
export const version = async () => {
  const paths = await getPaths();
  const file = paths.database.version;
  const folders = [
    { obj: paths.commands, weight: 3 },
    { obj: paths.tasks, weight: 3 },
    { obj: paths.utils, weight: 3 },
    { obj: paths.middleware, weight: 3 },
    { obj: paths.routes, weight: 2 },
    { obj: paths.html, weight: 2 },
    { obj: paths.public, weight: 1 },
    { obj: paths.config, weight: 2 },
    { obj: paths.version, weight: 2 },
    { obj: paths.ui, weight: 1 },
    { obj: paths.wss, weight: 2 },
    { obj: paths.localhost, weight: 1 },
    { obj: paths.language, weight: 1 },
  ];
  let data;
  try {
    data = fs.existsSync(file) ? JSON.parse(readFileSafe(file)) : {};
  } catch {
    data = {};
  }
  data.major = Number.isFinite(data.major) ? data.major : 1;
  data.minor = Number.isFinite(data.minor) ? data.minor : 0;
  data.patch = Number.isFinite(data.patch) ? data.patch : 0;
  data.hashes = data.hashes || {};
  data.lastUpdate = data.lastUpdate || "";
  const newHashes = {};
  let totalWeight = 0;
  const changed = [];
  for (const { obj, weight } of folders) {
    if (!obj) continue;
    const hash = hashFolder(obj);
    const name = typeof obj === "string"
      ? obj.split(/[\\/]/).pop()
      : obj.root
        ? obj.root.split(/[\\/]/).pop()
        : "unknown";
    newHashes[name] = hash;
    if (hash !== data.hashes[name]) {
      changed.push(name);
      totalWeight += weight;
    }
  }
  if (!changed.length) return "No significant code changes.";
  const bump = totalWeight >= 5 ? "major" : totalWeight >= 3 ? "minor" : "patch";
  data[bump]++;
  if (bump === "major") data.minor = data.patch = 0;
  else if (bump === "minor") data.patch = 0;
  data.hashes = newHashes;
  data.lastUpdate = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return `(${bump})\nVersion: v${data.major}.${data.minor}.${data.patch}\nChanged: ${changed.join(", ")}\nUpdated: ${data.lastUpdate}`;
};