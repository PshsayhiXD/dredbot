import { readdir } from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import log from "../logger.js";

export const jobs = {};

export const createJob = (id, options = {}, work) => {
  if (!id || typeof work !== "function") throw new Error(`[-] createJob: Missing ID or work function for ${id}`);
  jobs[id] = { id, ...options, work };
  log(`[createJob] Registered job: ${id}.`, "success");
};

export const getJobMetadata = (query) => {
  if (!query) return null;
  const isNumeric = !isNaN(query);
  const lower = query.toString().toLowerCase();
  if (jobs[query]) return jobs[query];
  return Object.values(jobs).find(j =>
    (isNumeric && Number(j.id) === Number(query)) ||
    j.name?.toLowerCase() === lower
  ) || null;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jobsDirectory = path.join(__dirname);

export const loadAllJobs = async (dir = jobsDirectory, prefix = "") => {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) await loadAllJobs(fullPath, prefix ? `${prefix}.${entry.name}` : entry.name);
    else if (entry.name.endsWith(".js") && entry.name !== "index.js") {
      const jobId = prefix ? `${prefix}.${entry.name.slice(0, -3)}` : entry.name.slice(0, -3);
      try {
        const module = await import(pathToFileURL(fullPath).href);
        const jobDef = module.default;
        if (typeof jobDef === "function") createJob(jobId, {}, jobDef);
        else if (jobDef?.execute && typeof jobDef.execute === "function") createJob(jobId, jobDef, jobDef.execute);
        else log(`[loadAllJobs] Skipping ${jobId}, invalid export.`, "warning");
      } catch (err) {
        log(`[loadAllJobs] Failed to load ${jobId}: ${err.message}`, "error");
      }
    }
  }
};