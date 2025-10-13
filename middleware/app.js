import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import path from 'path';
import helmet from 'helmet';
import axios from 'axios';
import paths from './../utils/path.js';
import { fileURLToPath } from 'url';
import NodeCache from 'node-cache';
import config from '../config.js';
import { helper }  from '../utils/helper.js';
const ipCache = new NodeCache({ stdTTL: 3600 });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const checkVPN = async (ip) => {
  if (ipCache.has(ip)) return ipCache.get(ip);
  const Key = await helper.readEnv('PROXYCHECKIO_API_KEY');
  try {
    const { data } = await axios.get(`https://proxycheck.io/v2/${ip}`, {
      params: {
        key: Key,
        vpn: 1,
        risk: 1
      }
    });
    const isVPN = data[ip]?.proxy === 'yes';
    ipCache.set(ip, isVPN);
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
  app.use('/language', express.static(path.join(__dirname, '../language')));
  app.use(helmet());
  app.set('trust proxy', 'loopback');
  app.use(async (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    if (!ip || ip === '::1' || ip.startsWith('127.')) return next();
    try {
      const isVPN = await checkVPN(ip);
      if (isVPN) return res.status(403).json({ message: 'Sorry! Access via VPN or proxy is not allowed. Please disable it and try again.' });
    } catch (err) {
      return res.status(500).json({ message: 'Internal server error' });
    }
    next();
  });
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const status = res.statusCode;
      const methodColor = (() => {
        switch (req.method) {
          case 'GET': return 'green-fg';
          case 'POST': return 'yellow-fg';
          case 'PUT': return 'blue-fg';
          case 'DELETE': return 'red-fg';
          default: return 'cyan-fg';
        }
      })();
      const statusColor = status >= 500 ? 'red-fg' : status >= 400 ? 'yellow-fg' : 'green-fg';
      const log = `${new Date().toISOString()} - {${methodColor}}${req.method}{/${methodColor}} ${req.originalUrl} - {${statusColor}}${status}{/${statusColor}} from ${req.ip} (${Date.now() - start}ms)`;
      axios.post(`http://localhost:${config.LOG_PORT}/req_log`, { log }).catch(() => {});
    });
    next();
  });
  app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "script-src 'self' 'nonce-dredbot'; object-src 'none'"
    );
    next();
  });
};