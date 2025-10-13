import { readdir } from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import log from "../logger.js";

export const pets = {};

export const createPet = (id, options = {}, execute) => {
  if (!id || typeof execute !== "function") throw new Error(`[-] createPet: Missing ID or execute function for ${id}`);
  pets[id] = {
    id,
    ...options,
    execute
  };
  log(`[createPet] Registered pet: ${id}.`, "success");
};

export const getPetMetadata = (query) => {
  if (!query) return null;
  const isNumeric = !isNaN(query);
  const lower = query.toString().toLowerCase();
  if (pets[query]) return pets[query];
  return Object.values(pets).find(p =>
    (isNumeric && Number(p.id) === Number(query)) ||
    p.name?.toLowerCase() === lower
  ) || null;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const petsDirectory = path.join(__dirname);

export const loadAllPets = async (dir = petsDirectory, prefix = "") => {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) await loadAllPets(fullPath, prefix ? `${prefix}.${entry.name}` : entry.name);
    else if (entry.name.endsWith(".js") && entry.name !== "index.js") {
      const petId = prefix ? `${prefix}.${entry.name.slice(0, -3)}` : entry.name.slice(0, -3);
      try {
        const module = await import(pathToFileURL(fullPath).href);
        const petDef = module.default;
        if (typeof petDef === "function") createPet(petId, {}, petDef);
        else if (petDef?.execute && typeof petDef.execute === "function") createPet(petId, petDef, petDef.execute);
        else log(`[loadAllPets] Skipping ${petId}, invalid export.`, "warning");
      } catch (err) {
        log(`[loadAllPets] Failed to load ${petId}: ${err.message}`, "error");
      }
    }
  }
};