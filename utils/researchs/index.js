import { readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import log from '../logger.js';

export const researchs = {};

export const createResearch = (id, options = {}) => {
  if (!id) throw new Error(`[-] createResearch: Missing ID`);
  researchs[id] = {
    id,
    ...options
  };
  log(`[createResearch] Registered research: ${id}.`, "success");
};

export const getResearchMetadata = (query) => {
  if (!query) return null;
  const isNumeric = !isNaN(query);
  const lower = query.toString().toLowerCase();
  if (researchs[query]) return researchs[query];
  return Object.values(researchs).find(i =>
    (isNumeric && Number(i.id) === Number(query)) ||
    i.name?.toLowerCase() === lower
  ) || null;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const researchDirectory = path.join(__dirname);

export const loadAllResearchs = async (dir = researchDirectory, prefix = '') => {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) await loadAllResearchs(fullPath, prefix ? `${prefix}.${entry.name}` : entry.name);
    else if (entry.name.endsWith('.js') && entry.name !== 'index.js') {
      const researchId = prefix ? `${prefix}.${entry.name.slice(0, -3)}` : entry.name.slice(0, -3);
      try {
        const module = await import(pathToFileURL(fullPath).href);
        const def = module.default;
        if (typeof def === 'function') createResearch(researchId, {});
        else createResearch(researchId, def || {});
      } catch (err) {
        log(`[loadAllResearch] Failed to load ${researchId}: ${err.message}`, 'error');
      }
    }
  }
  for (const [id, node] of Object.entries(researchs)) {
    if (node.requires && Array.isArray(node.requires)) {
      for (const req of node.requires) {
        if (!researchs[req]) log(`[loadAllResearch] Invalid require "${req}" in "${id}" - does not exist.`, 'warn');
      }
    }
  }
};