import { WebSocketServer } from 'ws';
import crypto from 'crypto';
import { helper } from './utils/helper.js';
import log from './utils/logger.js';
export const clients = new Map();
export let shipList = [];
const localIP = await helper.getLocalIP();

const setupWSS = async (server) => {
  const wss = new WebSocketServer({ server });
  server.on('listening', () => {
    log(`[WSS] listening on wss://${localIP}:${server.address().port}`, "success");
  });
  wss.on('connection', (ws) => {
    log('[WSS] New client connected', "success");
    const clientID = crypto.randomUUID();
    ws.id = clientID;
    clients.set(clientID, ws);
    helper.log(`client connected! ID: ${clientID}`, 'info');
    ws.send(JSON.stringify({ message: 'Welcome to Dredbot WSS!', clientID }));
    const intervalId = setInterval(() => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ message: '_0x63a1b7' }));
    }, 60000);
    ws.on('message', (message) => {
      const msgStr = message instanceof Buffer ? message.toString() : message;
      let parsed;
      try {parsed = JSON.parse(msgStr);
      } catch {return helper.log(`[-] Invalid JSON from client: ${msgStr}`, 'error')}
      const msg = parsed.message;
      if (!msg || typeof msg !== 'string') return;
      const codeMap = {
        '_0x71a2b6': 'ready',
        '_0x26a1b2': 'shiplist',
        '_0x63a1b7': 'request_shiplist',
      };
      const decoded = Object.keys(codeMap).find((key) => msg.startsWith(key)) || 'unknown';
      if (!msg.startsWith('_0x26a1b2:')) helper.log(`[+] Client (${ws.id}) says: ${decoded}`, 'info');
      if (msg === '_0x71a2b6') ws.send(JSON.stringify({ clientID: ws.id }));
    });
    ws.on('close', () => {
      helper.log(`[-] Client ${ws.id} disconnected.`, 'warn');
      clients.delete(ws.id);
      clearInterval(intervalId);
    });
  });
  return wss;
};

export default setupWSS;