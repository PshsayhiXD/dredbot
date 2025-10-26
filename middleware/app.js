import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import path from "path";
import helmet from "helmet";
import axios from "axios";
import paths from "./../utils/path.js";
import { fileURLToPath } from "url";
import { helper } from "../utils/helper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ipCache = new Map();
const TTL = 3600 * 1000;

const setCache = (key, value) => ipCache.set(key, { value, expires: Date.now() + TTL });
const getCache = (key) => {
  const item = ipCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    ipCache.delete(key);
    return null;
  }
  return item.value;
};
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of ipCache.entries()) if (v.expires < now) ipCache.delete(k);
}, 600000); // cleanup every 10 mins

const checkVPN = async (ip) => {
  const cached = getCache(ip);
  if (cached !== null) return cached;
  const Key = await helper.readEnv("PROXYCHECKIO_API_KEY");
  try {
    const { data } = await axios.get(`https://proxycheck.io/v2/${ip}`, {
      params: { key: Key, vpn: 1, risk: 1 }
    });
    const isVPN = data[ip]?.proxy === "yes";
    setCache(ip, isVPN);
    return isVPN;
  } catch {
    return false;
  }
};

export const Middleware = (app) => {
  app.use(cors());
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.static(paths.public.root));
  app.use("/language", express.static(path.join(__dirname, "../language")));
  app.use(helmet());
  app.set("trust proxy", "loopback");
  app.use(async (req, res, next) => {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
    if (!ip || ip === "::1" || ip.startsWith("127.")) return next();
    try {
      const isVPN = await checkVPN(ip);
      if (isVPN)
        return res.status(403).json({
          message: "Sorry! Access via VPN or proxy is not allowed. Please disable it and try again."
        });
    } catch {
      return res.status(500).json({ message: "Internal server error" });
    }
    next();
  });
  app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "script-src 'self' 'nonce-dredbot'; object-src 'none'");
    next();
  });
};