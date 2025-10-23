import express from 'express';
import { Middleware } from './middleware/internal.js';
import log from './utils/logger.js';
import { helper } from './utils/helper.js';
import config from './config.js';
import * as createRoute from './routes/internal/index.js';
if (!(await helper.isWifiConnected()).connected) throw new Error("[localhost.js] No WiFi connection.");
log(`[localhost.js] Wifi connected, Good.`);
const allRoutes = [],
  mounted = new Map(),
  m = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'all'];
const originalUse = express.application.use;
express.application.use = function (...args) {
  if (typeof args[0] === 'string' && args[1] && typeof args[1] === 'function' && args[1].stack && Array.isArray(args[1].stack)) mounted.set(args[1], args[0]);
  return originalUse.apply(this, args);
};
m.forEach(method => {
  const proto = express.Router.prototype;
  const orig = proto[method];
  proto[method] = function (path, ...handlers) {
    if (!handlers.length || typeof handlers[0] !== 'function') return orig.call(this, path, ...handlers);
    const base = mounted.get(this) || '';
    allRoutes.push({ method: method.toUpperCase(), path: (base + path).replace(/\/+/g, '/') });
    return orig.call(this, path, ...handlers);
  };
});
const logAllRoutes = (baseURL = '') => {
  log('\n[localhost.js] Localhost available Routes:', "title");
  if (!allRoutes.length) return log('  (no routes found)');
  allRoutes.forEach(r => {
    log(`  [${r.method}] ${r.path} → ${baseURL}${r.path}`, "success");
  });
};

const app = express();
await Middleware(app);
await createRoute.default(app, helper);
logAllRoutes(`http://localhost:${config.LOCALHOST_PORT}`);
app
  .listen(config.LOCALHOST_PORT, () => {
    log(`[localhost.js] localhost on http://localhost:${config.LOCALHOST_PORT}`, "success");
  })
  .on('error', err => {
    log(`[localhost.js] ${err}`, 'error');
  });
log('[localhost.js] ready.', "success");
