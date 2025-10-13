import { readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import log from '../logger.js';

export const skills = {};

export const createSkill = (id, options = {}, apply) => {
  if (!id) throw new Error(`[-] createSkill: Missing ID`);
  skills[id] = {
    id,
    ...options,
    apply: typeof apply === 'function' ? apply : undefined
  };
  log(`[createSkill] Registered skill: ${id}.`, "success");
};

export const getSkillMetadata = (query) => {
  if (!query) return null;
  const isNumeric = !isNaN(query);
  const lower = query.toString().toLowerCase();
  if (skills[query]) return skills[query];
  return Object.values(skills).find(i =>
    (isNumeric && Number(i.id) === Number(query)) ||
    i.name?.toLowerCase() === lower
  ) || null;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillsDirectory = path.join(__dirname);

export const loadAllSkills = async (dir = skillsDirectory, prefix = '') => {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) await loadAllSkills(fullPath, prefix ? `${prefix}.${entry.name}` : entry.name);
    else if (entry.name.endsWith('.js') && entry.name !== 'index.js') {
      const skillId = prefix ? `${prefix}.${entry.name.slice(0, -3)}` : entry.name.slice(0, -3);
      try {
        const module = await import(pathToFileURL(fullPath).href);
        const skillDef = module.default;
        if (typeof skillDef === 'function') createSkill(skillId, {}, skillDef);
        else if (skillDef?.apply && typeof skillDef.apply === 'function') createSkill(skillId, skillDef, skillDef.apply);
        else createSkill(skillId, skillDef || {});
      } catch (err) {
        log(`[loadAllSkills] Failed to load ${skillId}: ${err.message}`, 'error');
      }
    }
  }
};