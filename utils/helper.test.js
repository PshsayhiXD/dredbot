import fs from 'fs/promises';
import dns from 'dns';
import os from 'os';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env'});
import { decode, encode, BuildCmd, Item } from 'dsabp-js';
import crypto from 'crypto';
import { evaluate } from 'mathjs';
import sharp from 'sharp';
import Color from 'color';
import chalkLib from 'chalk';
import * as cheerio from 'cheerio';
import { createCanvas, loadImage } from 'canvas';

import paths from './path.js';
import config from '../../config.js';
import * as commandUsage from '../commands/command-usage.js';
import * as getcommand from './getcommand.js';
import log from './logger.js';

import { scheduleDelete, removeDelete, rescheduleAll, deleteDmWithUser, deleteAllDms } from './deleteScheduler.js';

import {
  readData,
  writeData,
  readText,
  writeText,
  loadData,
  loadAllData,
  loadDataByAccountId,
  loadUsernameByAccountId,
  saveData,
  isValidUser,
  writeEnv,
  readEnv,
  envAll,
  quickSaveUserIdData,
  loadDataByAccountCookie,
  loadUsernameByAccountCookie,
} from './db.js';
import {
  getClanMemberCount,
  getClanMemberLimit,
  isClanPrivate,
  getClanRequestCount,
  createClan,
  getClan,
  getClanByOwner,
  getUserClan,
  getAllClans,
  deleteClan,
  updateClanData,
  isValidClan,
  setClanPassword,
  customizeClanColor,
  setClanBanner,
  setUpClanSettings,
  viewPendingClanRequests,
  renameClan,
  getClanSettings,
  setClanIcon,
} from './clan.js';
import { 
  getAllListings, 
  getListing, 
  saveListing, 
  deleteListing 
} from './marketplace.js';
import { 
  saveTrade, 
  getTrade, 
  getAllTrades, 
  getUserTrades, 
  deleteTrade, 
  cleanUpExpiredTrades 
} from './trade.js';

export const clan = {
  getClanMemberCount,
  getClanMemberLimit,
  isClanPrivate,
  getClanRequestCount,
  createClan,
  getClan,
  getClanByOwner,
  getUserClan,
  getAllClans,
  deleteClan,
  updateClanData,
  isValidClan,
  setClanPassword,
  customizeClanColor,
  setClanBanner,
  setUpClanSettings,
  viewPendingClanRequests,
  renameClan,
  getClanSettings,
  setClanIcon,
};
export const marketplace = {
  getAllListings,
  getListing,
  saveListing,
  deleteListing,
};
export const deleteSchedule = {
  scheduleDelete,
  removeDelete,
  rescheduleAll,
  deleteDmWithUser,
  deleteAllDms,
};
export const trade = {
  saveTrade,
  getTrade,
  getAllTrades,
  getUserTrades,
  deleteTrade,
  cleanUpExpiredTrades,
};

import clanDB from './clan.js';
import DB from './db.js';
import marketplaceDB from './marketplace.js';
import tradeDB from './trade.js';

import { items } from './items/index.js';
import { skills } from './skills/index.js';
import { researchs } from './researchs/index.js';
import { achievements } from './achievements/index.js';
import { quests } from './quests/index.js';
import { enchants } from './enchants/index.js';
import { recipes } from './recipes/index.js';
import { jobs } from './jobs/index.js';
import { pets } from './pets/index.js';
const originalLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  options = Object.assign({}, options, { family: 4 });
  return originalLookup.call(this, hostname, options, callback);
};

let cooldowns = {};
let schedule;

export const encryptAccount = async account => {
  const mk = crypto.randomBytes(32);
  const p1 = mk.slice(0, 16);
  const p2 = mk.slice(16, 24);
  const p3 = mk.slice(24, 32);

  const e1iv = crypto.randomBytes(12);
  const e1c = crypto.createCipheriv('aes-256-gcm', crypto.createHash('sha256').update(Buffer.concat(p2)).digest(), e1iv);
  const e1d = Buffer.concat([e1c.update(p1), e1c.final()]);
  const e1t = e1c.getAuthTag();

  const e2iv = crypto.randomBytes(12);
  const e2c = crypto.createCipheriv('aes-256-gcm', crypto.createHash('sha256').update(Buffer.concat(p3)).digest(), e2iv);
  const e2d = Buffer.concat([e2c.update(p2), e2c.final()]);
  const e2t = e2c.getAuthTag();

  const e3iv = crypto.randomBytes(12);
  const e3c = crypto.createCipheriv('aes-256-gcm', crypto.createHash('sha256').update(Buffer.concat(p1)).digest(), e3iv);
  const e3d = Buffer.concat([e3c.update(p3), e3c.final()]);
  const e3t = e3c.getAuthTag();

  const aiv = crypto.randomBytes(12);
  const ac = crypto.createCipheriv('aes-256-gcm', mk, aiv);
  const aj = JSON.stringify(account);
  const ad = Buffer.concat([ac.update(aj, 'utf8'), ac.final()]);
  const at = ac.getAuthTag();
  const metaA = Buffer.concat([e1iv, e1d, e1t, crypto.randomBytes(5)]).toString('hex');
  const metaB = Buffer.concat([crypto.randomBytes(3), e2iv, e2d, e2t, crypto.randomBytes(2)]).toString('hex');
  const ivField = Buffer.concat([aiv, e3iv, e3d, e3t, crypto.randomBytes(4)]).toString('hex');
  const map = JSON.stringify({
    a: [0, 12, 12, 12 + e1d.length, 12 + e1d.length, 12 + e1d.length + 16],
    b: [3, 15, 15, 15 + e2d.length, 15 + e2d.length, 15 + e2d.length + 16],
    i: [12, 24, 24, 24 + e3d.length, 24 + e3d.length, 24 + e3d.length + 16],
  });
  const mk2 = crypto.randomBytes(32);
  const miv = crypto.randomBytes(12);
  const mc = crypto.createCipheriv('aes-256-gcm', mk2, miv);
  const md = Buffer.concat([mc.update(map), mc.final()]);
  const mt = mc.getAuthTag();
  const tagField = Buffer.concat([at, miv, mk2, mt]).toString('hex');

  return { iv: ivField, dta: ad.toString('hex'), tag: tagField, metaA, metaB, map: md.toString('hex') };
};
export const decryptAccount = async payload => {
  const { iv, data, tag, metaA, metaB, map } = typeof payload === 'string' ? JSON.parse(payload) : payload;
  const ivb = Buffer.from(iv, 'hex');
  const tb = Buffer.from(tag, 'hex');
  const mA = Buffer.from(metaA, 'hex');
  const mB = Buffer.from(metaB, 'hex');
  const mapData = Buffer.from(map, 'hex');

  const at = tb.slice(0, 16);
  const miv = tb.slice(16, 28);
  const mk2 = tb.slice(28, 60);
  const mt = tb.slice(60, 76);
  const md = mapData;

  const mdc = crypto.createDecipheriv('aes-256-gcm', mk2, miv);
  mdc.setAuthTag(mt);
  const mp = JSON.parse(Buffer.concat([mdc.update(md), mdc.final()]).toString('utf8'));

  const g1 = mA.slice(mp.a[0], mp.a[1]);
  const e1d = mA.slice(mp.a[2], mp.a[3]);
  const e1t = mA.slice(mp.a[4], mp.a[5]);

  const g2 = mB.slice(mp.b[0], mp.b[1]);
  const e2d = mB.slice(mp.b[2], mp.b[3]);
  const e2t = mB.slice(mp.b[4], mp.b[5]);

  const g3 = ivb.slice(mp.i[0], mp.i[1]);
  const e3d = ivb.slice(mp.i[2], mp.i[3]);
  const e3t = ivb.slice(mp.i[4], mp.i[5]);

  const d1c = crypto.createDecipheriv('aes-256-gcm', crypto.createHash('sha256').update(Buffer.concat(g2)).digest(), g1);
  d1c.setAuthTag(e1t);
  const p1 = Buffer.concat([d1c.update(e1d), d1c.final()]);

  const d2c = crypto.createDecipheriv('aes-256-gcm', crypto.createHash('sha256').update(Buffer.concat(g3)).digest(), g2);
  d2c.setAuthTag(e2t);
  const p2 = Buffer.concat([d2c.update(e2d), d2c.final()]);

  const d3c = crypto.createDecipheriv('aes-256-gcm', crypto.createHash('sha256').update(Buffer.concat(p1)).digest(), g3);
  d3c.setAuthTag(e3t);
  const p3 = Buffer.concat([d3c.update(e3d), d3c.final()]);

  const mk = Buffer.concat([p1, p2, p3]);
  const aiv = ivb.slice(0, 12);
  const adc = crypto.createDecipheriv('aes-256-gcm', mk, aiv);
  adc.setAuthTag(at);
  const dec = Buffer.concat([adc.update(Buffer.from(data, 'hex')), adc.final()]);
  return JSON.parse(dec.toString('utf8'));
};

export const randomNumber = (min = 0, max = 1) => {
  if (max < min) [min, max] = [max, min];
  const range = max - min;
  const bytes = crypto.randomBytes(6);
  const num = parseInt(bytes.toString('hex'), 16);
  const fraction = num / 0xffffffffffff;
  return min + fraction * range;
};
export const gambleRandomNumber = (min = 0, max = 1, multiplier = 1) => {
  if (max < min) [min, max] = [max, min];
  const range = max - min;
  const bytes = crypto.randomBytes(6);
  const num = parseInt(bytes.toString('hex'), 16);
  const fraction = num / 0xffffffffffff;
  const result = min + fraction * range;
  return result * multiplier;
};

export const key = () => ({ ...process.env });
export const fileexists = async p => {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
};
export const getFileContent = async filePath => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    if (lines.length <= 1000) return null;
    const timestamp = Date.now();
    const fileName = `getfilecontent-${timestamp}.txt`;
    const outPath = path.join(paths.temp, fileName);
    await fs.promises.writeFile(outPath, content, 'utf-8');
    return outPath;
  } catch {
    return null;
  }
};
export const clearGetFileContentFiles = (intervalMs = 10000, maxAgeMs = 30000) => {
  setInterval(async () => {
    try {
      const files = await fs.promises.readdir(paths.temp);
      const now = Date.now();
      const oldFiles = files
        .filter(f => f.startsWith('getfilecontent-') && f.endsWith('.txt'))
        .filter(f => {
          const timestamp = Number(f.match(/getfilecontent-(\d+)\.txt/)?.[1] || 0);
          return now - timestamp > maxAgeMs;
        });
      await Promise.all(oldFiles.map(f => fs.promises.unlink(path.join(paths.temp, f))));
    } catch {}
  }, intervalMs);
};

const errorMsg = (func, reason, code = 0o0, rest = {}) => {
  const r = reason.replace(/\.$/gm, "");
  return {
    success: false,
    valid: false,
    msg: `[-] ${func}: ${r}`,
    error: `[-] ${func}: ${r}`,
    code,
    ...rest
  };
};
const throwError = (func, reason) => {
  if (!reason && func.startsWith("[-]")) {
    const m = func.match(/\[-\]\s*([^:]+):\s*(.*)/);
    if (m) return new Error(`[-] ${m[1]}: ${m[2]}`);
  }
  throw new Error(`[-] ${func}: ${reason}`);
};
const successMsg = (func, msg, code = 0o0, rest = {}) => {
  const m = msg.replace(/\.$/gm, "");
  return {
    success: true,
    valid: true,
    msg: `[+] ${func}: ${m}`,
    code,
    ...rest
  };
};
export const parseAmount = input => {
  if (typeof input !== 'string') return NaN;
  const multipliers = {
    k: 1e3,
    thousand: 1e3,
    m: 1e6,
    mil: 1e6,
    million: 1e6,
    b: 1e9,
    bil: 1e9,
    billion: 1e9,
    t: 1e12,
    tril: 1e12,
    trillion: 1e12,
    q: 1e15,
    qd: 1e15,
    quadrillion: 1e15,
    qi: 1e18,
    quintillion: 1e18,
    sx: 1e21,
    sextillion: 1e21,
    sp: 1e24,
    septillion: 1e24,
    o: 1e27,
    oc: 1e27,
    octillion: 1e27,
    n: 1e30,
    no: 1e30,
    nonillion: 1e30,
    de: 1e33,
    decillion: 1e33,
    ude: 1e36,
    undecillion: 1e36,
    duo: 1e39,
    duodecillion: 1e39,
    td: 1e42,
    tredecillion: 1e42,
    qt: 1e45,
    quattuordecillion: 1e45,
    qd: 1e48,
    quindecillion: 1e48,
    sd: 1e51,
    sexdecillion: 1e51,
    sd: 1e54,
    septendecillion: 1e54,
    od: 1e57,
    octodecillion: 1e57,
    nd: 1e60,
    novemdecillion: 1e60,
    vd: 1e63,
    vigintillion: 1e63,
  };
  try {
    input = input.toLowerCase().replace(/,/g, '').replace(/\s+/g, '');
    input = input.replace(/(\d+(\.\d+)?)([a-z]+)/gi, (_, num, __, suffix) => {
      return multipliers[suffix] ? parseFloat(num) * multipliers[suffix] : _;
    });
    const result = evaluate(input);
    return isNaN(result) ? NaN : Math.floor(result);
  } catch {
    return NaN;
  }
};
export const parseBet = async (input, bal) => {
  if (!input) return { bet: 0, err: '?' };
  const suffixMap = {
    k: 1e3,
    m: 1e6,
    b: 1e9,
    t: 1e12,
    qd: 1e15,
    qi: 1e18,
    sx: 1e21,
    sp: 1e24,
    o: 1e27,
    n: 1e30,
    de: 1e33,
    ude: 1e36,
    duo: 1e39,
    td: 1e42,
    qt: 1e45,
    qd2: 1e48,
    sd: 1e51,
    sd2: 1e54,
    od: 1e57,
    nd: 1e60,
    vd: 1e63,
  };
  input = input.toLowerCase().trim();
  if (input === 'all') return { bet: bal };
  if (input === 'half') return { bet: Math.floor(bal / 2) };
  input = input.replace(/(\d+(?:\.\d+)?)([a-z]+)/gi, (_, num, suf) => {
    const mul = suffixMap[suf] || 1;
    return `(${num}*${mul})`;
  });
  let bet;
  try {
    bet = evaluate(input);
  } catch {
    return { bet: 0, err: '[-] parseBet: Invalid bet expression (or cant parse).' };
  }
  if (typeof bet !== 'number' || isNaN(bet) || bet <= 0) return { bet: 0, err: '[-] parseBet: Invalid bet amount' };
  if (bet > bal) return { bet: 0, err: '[-] parseBet: Insufficient balance' };
  return { bet: Math.floor(bet) };
};
export const formatAmount = (num, options = {}) => {
  if (typeof num !== 'number' || isNaN(num)) return 'NaN';
  const {
    decimals = 2, // How many decimal places to keep (1.00 or 1)
    useLong = false, // Whether to use full words (million) instead of short (M)
    padZeros = false, // Whether to keep trailing zeroes like "1.00M"
    prefix = '', // Optional prefix, like "$"
    parentheses = false, // Wrap negatives like (1.5M)
    useLocale = false, // Use locale separators (1,000 vs 1.000)
    minAbbrev = 1000, // Minimum number to abbreviate (else show raw)
    bold = false, // Whether to bold the number
  } = options;
  const suffixes = [
    { value: 1e63, short: 'vd', long: 'vigintillion' },
    { value: 1e60, short: 'nd', long: 'novemdecillion' },
    { value: 1e57, short: 'od', long: 'octodecillion' },
    { value: 1e54, short: 'sd', long: 'septendecillion' },
    { value: 1e51, short: 'sd', long: 'sexdecillion' },
    { value: 1e48, short: 'qd', long: 'quindecillion' },
    { value: 1e45, short: 'qt', long: 'quattuordecillion' },
    { value: 1e42, short: 'td', long: 'tredecillion' },
    { value: 1e39, short: 'duo', long: 'duodecillion' },
    { value: 1e36, short: 'ude', long: 'undecillion' },
    { value: 1e33, short: 'de', long: 'decillion' },
    { value: 1e30, short: 'n', long: 'nonillion' },
    { value: 1e27, short: 'o', long: 'octillion' },
    { value: 1e24, short: 'sp', long: 'septillion' },
    { value: 1e21, short: 'sx', long: 'sextillion' },
    { value: 1e18, short: 'qi', long: 'quintillion' },
    { value: 1e15, short: 'qd', long: 'quadrillion' },
    { value: 1e12, short: 'T', long: 'trillion' },
    { value: 1e9, short: 'B', long: 'billion' },
    { value: 1e6, short: 'M', long: 'million' },
    { value: 1e3, short: 'K', long: 'thousand' },
  ];
  const isNegative = num < 0;
  const abs = Math.abs(num);
  for (let { value, short, long } of suffixes) {
    if (abs >= value && abs >= minAbbrev) {
      let formatted = (abs / value).toFixed(decimals);
      if (!padZeros) formatted = formatted.replace(/\.00$/, '');
      const unit = useLong ? ` ${long}` : short;
      const final = `${prefix}${formatted}${unit}`;
      return isNegative ? (bold ? `(**-${final}**)` : parentheses ? `(${final})` : `-${final}`) : bold ? `(**${final}**)` : final;
    }
  }
  let base = useLocale ? abs.toLocaleString() : abs.toFixed(decimals);
  if (!padZeros) base = base.replace(/\.00$/, '');
  const final = `${prefix}${base}`;
  return isNegative ? (bold ? `(**-${final}**)` : parentheses ? `(${final})` : `-${final}`) : bold ? `(**${final}**)` : final;
};
export const isInteger = num => {
  return Number.isInteger(num);
};
export const formatTime = ms => {
  const suffixes = [
    { unit: 3600, label: 'h' },
    { unit: 60, label: 'm' },
    { unit: 1, label: 's' },
  ];
  let seconds = Math.floor(ms / 1000);
  const parts = [];
  for (const { unit, label } of suffixes) {
    const value = Math.floor(seconds / unit);
    if (value > 0 || (label === 's' && parts.length === 0)) parts.push(`${value}${label}`);
    seconds %= unit;
  }
  return parts.join(' ');
};
export const formatDate = async date => {
  return date.toISOString().slice(0, 10);
};
export const parseDate = async str => {
  const [year, month, day] = str.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};
export const testEnv = async (envName = 'all') => {
  return `Test already done. function is deprecated`;
  if (envName === 'all') {
    const envs = await envAll();
    const results = [];
    for (const [key, value] of Object.entries(envs)) {
      try {
        const result = await readEnv(key);
        results.push({ key, value: result, ok: true });
      } catch (err) {
        results.push({ key, value: null, ok: false, error: err.message });
      }
    }
    return results;
  } else {
    try {
      const value = await readEnv(envName);
      return { key: envName, value, ok: true };
    } catch (err) {
      return { key: envName, value: null, ok: false, error: err.message };
    }
  }
};
export const isSameDay = async (dateA, dateB) => {
  return formatDate(dateA) === formatDate(dateB);
};
export const newToken = (length = 16) => {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
};
export const toBase64 = async string => Buffer.from(string, 'utf-8').toString('base64');
export const fromBase64 = async string => Buffer.from(string, 'base64').toString('utf-8');
export const toBinary = async number => number.toString(2);
export const fromBinary = async string => parseInt(string, 2);
export const toRoman = async number => {
  if (typeof number !== 'number' || number <= 0) return '';
  const romanMap = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let s = '';
  for (const [value, numeral] of romanMap) {
    while (number >= value) {
      s += numeral;
      number -= value;
    }
  }
  return s;
};
export const fromRoman = async roman => {
  if (typeof roman !== 'string' || roman.length === 0) return 0;
  const romanMap = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };
  let total = 0,
    prev = 0;
  for (let i = roman.length - 1; i >= 0; i--) {
    const curr = romanMap[roman[i].toUpperCase()] || 0;
    if (curr < prev) total -= curr;
    else total += curr;
    prev = curr;
  }
  return total;
};
export const toSlug = async string => {
  const result = string
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return result;
};
export const findAllObjectByValue = (obj, value) => {
  return Object.keys(obj).filter(k => obj[k] === value);
};
export const findAllArrayByValue = (arr, key, value) => {
  if (!Array.isArray(arr)) throwError('[-] First argument must be an array.');
  return arr.filter(item => item?.[key] === value);
};
export const deepFindAllObjectKeyPaths = (obj, targetKey) => {
  const results = [];
  const search = (current, path = []) => {
    if (typeof current !== 'object' || current === null) return;
    for (const key in current) {
      const newPath = [...path, key];
      if (key === targetKey) {
        results.push({
          path: newPath.join('.'),
          value: current[key],
        });
      }
      search(current[key], newPath);
    }
  };
  search(obj);
  return results;
};
export const unicode = str => {
  return [...str].map(char => `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')} (${char})`).join('\n');
};
export const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
export const convertImageToBase64 = async url => {
  if (!url) return { base64: null, error: '[-] convertImageToBase64: No URL provided.' };
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const sizeLimit = 10 * 1024 * 1024;
  const contentLength = Number(res.headers.get('content-length')) || buf.length;
  if (contentLength > sizeLimit) return { base64: null, warn: '**Image too large**. Max 10MB.' };
  const resized = await sharp(buf).resize({ width: 512, height: 512, fit: 'inside' }).png().toBuffer();
  const base64 = resized.toString('base64');
  return { base64: `data:image/png;base64,${base64}` };
};
export const convertColorToHex = input => {
  try {
    return Color(input).hex().toLowerCase();
  } catch {
    return '#000000';
  }
};
export const isSafeNumber = n => {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) && n > 0 && n <= Number.MAX_SAFE_INTEGER;
};
export const chalk = (text, color = 'white') => {
  if (!chalkLib[color]) color = 'white';
  return chalkLib[color](text);
};

export const waitForMessages = async (channel, userId, options = {}) => {
  const { steps, timeout = 30000, stepTimeout = 15000, prompt = [], validate = [], ephemeral = true, interaction = null, boldError = true } = options;
  if (!channel || !userId) throwError('[-] waitForMessages: missing channel or userId.');
  if (!Array.isArray(steps) || steps.length === 0) throwError("[-] waitForMessages: 'steps' must be a non-empty array.");
  const user = await channel.client.users.fetch(userId);
  const res = [],
    start = Date.now();
  for (let i = 0; i < steps.length; i++) {
    if (Date.now() - start > timeout) throwError(`[-] waitForMessages: total timeout (${timeout}ms) at step ${i + 1}.`);
    if (prompt[i]) {
      const p = prompt[i];
      channel.type === 1 || channel.type === 'DM' ? await user.send(p) : await channel.send(p);
    }
    const msg = await new Promise((resolve, reject) => {
      const f = m => m.author.id === userId;
      const c = channel.createMessageCollector({ filter: f, time: stepTimeout });
      c.on('collect', async m => {
        const match = steps[i] === '*' || m.content === steps[i];
        const valid = typeof validate[i] === 'function' ? validate[i](m.content) : true;
        if (!match || !valid) {
          const reason = !match ? 'unexpected content' : 'validation failed';
          const msg = boldError ? `❌ **Invalid input** for step **${i + 1}**.` : `❌ Invalid input at step ${i + 1}.`;
          interaction?.followUp?.({ content: msg, ephemeral }).catch(() => {});
          channel.send?.(msg).catch(() => {});
          c.stop();
          reject(new Error(`[-] waitForMessages: step ${i + 1} failed - ${reason}.`));
        } else {
          c.stop();
          resolve(m);
        }
      });
      c.on('end', (_, r) => r !== 'user' && reject(new Error(`[-] waitForMessages: step ${i + 1} timed out after ${stepTimeout}ms.`)));
    });
    res.push(msg);
  }
  return res;
};
export const flagMap = {
  crossposted: 1 << 0,
  isCrosspost: 1 << 1,
  suppressEmbeds: 1 << 2,
  sourceMessageDeleted: 1 << 3,
  urgent: 1 << 4,
  hasThread: 1 << 5,
  ephemeral: 1 << 6,
  loading: 1 << 7,
  failedToMentionSomeRolesInThread: 1 << 8,
  suppressNotifications: 1 << 12,
  isVoiceMessage: 1 << 13,
};
export const parseFlags = opts => {
  let flags = 0;
  for (const k in opts) if (opts[k] && flagMap[k]) flags |= flagMap[k];
  return flags;
};
export const formatFlags = bitfield => {
  const out = {};
  for (const k in flagMap) out[k] = (bitfield & flagMap[k]) !== 0;
  return out;
};
export const runCommand = async (bot, message, content) => {
  if (message.author.bot) return;
  if (!bot) throwError(`[-] runCommand: Expected bot parameter (${bot}).`);
  bot.emit('messageCreate', {
    ...message,
    content,
    author: message.author,
  });
};

export const Schedule = async () => {
  try {
    const response = await fetch('https://drednot.io/pvp-events', {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throwError('Network response was not ok ' + response.statusText);
    const body = await response.text();
    const scriptTag = body.match(/<script[^>]*>(.*?)<\/script>/g).find(script => script.includes('SCHEDULE='));
    schedule = JSON.parse(
      scriptTag
        .replace(/<script[^>]*>|<\/script>/g, '')
        .trim()
        .replace('SCHEDULE=', '')
    );
  } catch (error) {
    throwError('[Schedule] Error fetching schedule:', error.message);
  }
};
Schedule();
export const pvpEvent = async type => {
  await Schedule();
  await wait(2555);
  if (typeof type === 'object') type = JSON.stringify(type);
  else if (Array.isArray(type)) type = type.join(' ');
  if (typeof type === 'string') type = type.toLowerCase();
  const now = new Date();
  const Week = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  if (type === 'all') return schedule.map(({ date }) => ({ date }));
  if (type === 'today') {
    const today = new Date().setHours(0, 0, 0, 0);
    const todayEvents = schedule.filter(({ date }) => {
      const eventDate = new Date(date).setHours(0, 0, 0, 0);
      return eventDate === today;
    });
    return todayEvents.length ? todayEvents.map(({ date }) => date) : Error('No events for today.');
  }
  if (['next', 'second', 'third', 'four'].includes(type)) {
    const upcoming = schedule.filter(({ date }) => new Date(date) > now).sort((a, b) => new Date(a.date) - new Date(b.date));
    const index = type === 'next' ? 0 : type === 'second' ? 1 : type === 'third' ? 2 : 3;
    return upcoming[index] ? upcoming[index].date : Error('No upcoming events.');
  }
  if (Week.includes(type)) {
    const dayEvents = schedule.filter(({ date }) => new Date(date).getDay() === Week.indexOf(type));
    return dayEvents.length ? dayEvents.map(({ date }) => date) : Error(`No events found for ${type}`);
  }
  const dayEvents = schedule.filter(({ date }) => date === type);
  dayEvents.length ? dayEvents.map(({ date }) => date) : Error(`No events found for ${type}`);
};

export const newTab = async shipId => {
  if (!shipId) throwError(`[-] newTab: unexpected shipId "${shipId}".`);
  const data = await readData(paths.database.active_ship);
  if (!Array.isArray(data)) throwError('active_ship data is not an array!');
  if (data.includes(shipId)) throwError(`Ship "${shipId}" already exists.`);
  data.push(shipId);
  await writeData(paths.database.active_ship, data);
};
export const removeTab = async shipId => {
  if (!shipId) throwError(`[-] removeTab: unexpected shipId "${shipId}".`);
  const data = await readData(paths.database.active_ship);
  if (!Array.isArray(data)) throwError('active_ship data is not an array!');
  const index = data.indexOf(shipId);
  if (index === -1) throwError(`Ship "${shipId}" does not exist.`);
  data.splice(index, 1);
  await writeData(paths.database.active_ship, data);
};
export const findTab = async shipId => {
  if (!shipId) throwError(`[-] findTab: unexpected shipId "${shipId}".`);
  const data = await readData(paths.database.active_ship);
  if (!Array.isArray(data)) throwError('active_ship data is not an array!');
  return data.includes(shipId);
};
export const fetchShipList = async () => {
  try {
    const res = await fetch('https://drednot.io/shiplist?server=0', {
      headers: {
        Cookie: `anon_key=${config.DREDNOT_ANON_KEY}`,
        'User-Agent': 'Mozilla/5.0',
      },
    });
    if (!res.ok) {
      log(`[fetchShipList]: HTTP ${res.status}`, 'error');
      return null;
    }
    const json = await res.json();
    if (!json.ships) {
      log('[fetchShipList]: No ships key in response', 'error');
      return null;
    }
    return json;
  } catch (err) {
    log(`[fetchShipList]: fetch error: ${err.message}`, 'error');
    return null;
  }
};
export const fetchShipFromLink = async link => {
  try {
    const res = await fetch(link, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Cookie: `anon_key=${config.DREDNOT_ANON_KEY}`,
      },
    });
    if (!res.ok) return { valid: false };
    const html = await res.text();
    const $ = cheerio.load(html);
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogImage = $('meta[property="og:image"]').attr('content') || null;
    const shipName = ogTitle
      .replace(/^(Invite:|Ship:)\s*/, '')
      .replace(/\s*[-|]\s*drednot\.io$/i, '')
      .trim();
    if (!shipName || shipName === 'Deep Space Airships') return { valid: false };
    return { valid: true, shipName, shipImage: ogImage };
  } catch {
    return { valid: false };
  }
};
export const drawShipsCard = async (ships, updateInterval, totalPlayers, maxPlayers) => {
  const width = 900;
  const padding = 20;
  const maxHeight = 2000;
  const defaultBoxHeight = 120;
  const totalContentHeight = ships.length * (defaultBoxHeight + padding) + 100;
  let boxHeight = defaultBoxHeight;
  if (totalContentHeight > maxHeight) boxHeight = Math.floor((maxHeight - 100 - ships.length * padding) / ships.length);
  const canvasHeight = Math.min(maxHeight, totalContentHeight);
  const canvas = Canvas.createCanvas(width, canvasHeight);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1e1e1e';
  ctx.fillRect(0, 0, width, canvasHeight);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('All Ships Online', width / 2, 50);
  if (updateInterval) {
    ctx.textAlign = 'left';
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#cccccc';
    ctx.fillText(`Updates every ${updateInterval}s`, padding, 30);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const iconSize = Math.min(boxHeight * 0.75, 90);
  for (let i = 0; i < ships.length; i++) {
    const ship = ships[i];
    const y = 80 + i * (boxHeight + padding);
    const radius = Math.min(20, boxHeight / 2);
    const [r, g, b] = ship.color.match(/\d+/g).map(Number);
    const gradient = ctx.createLinearGradient(padding, y, width - padding, y + boxHeight);
    gradient.addColorStop(0, `rgba(${r},${g},${b},0.9)`);
    gradient.addColorStop(1, `rgba(${r},${g},${b},0.6)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(padding + radius, y);
    ctx.lineTo(width - padding - radius, y);
    ctx.quadraticCurveTo(width - padding, y, width - padding, y + radius);
    ctx.lineTo(width - padding, y + boxHeight - radius);
    ctx.quadraticCurveTo(width - padding, y + boxHeight, width - padding - radius, y + boxHeight);
    ctx.lineTo(padding + radius, y + boxHeight);
    ctx.quadraticCurveTo(padding, y + boxHeight, padding, y + boxHeight - radius);
    ctx.lineTo(padding, y + radius);
    ctx.quadraticCurveTo(padding, y, padding + radius, y);
    ctx.closePath();
    ctx.fill();
    const iconX = padding + iconSize / 2;
    const iconY = y + boxHeight / 2;
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    if (ship.icon_path) {
      try {
        const icon = await loadImage(ship.icon_path);
        ctx.save();
        ctx.beginPath();
        ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(icon, padding, y + (boxHeight - iconSize) / 2, iconSize, iconSize);
        ctx.restore();
      } catch {}
    }
    const textX = padding + iconSize + 30;
    const textWidth = width - textX - padding;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(textX - 10, y + 10, textWidth, boxHeight - 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(boxHeight / 4)}px sans-serif`;
    ctx.fillText(`[${ship.ourId}] ${ship.team_name}`, textX, y + boxHeight / 3);
    ctx.font = `${Math.floor(boxHeight / 6)}px sans-serif`;
    ctx.fillText(`Players: ${ship.player_count}`, textX, y + (2 * boxHeight) / 3);
    ctx.font = `${Math.floor(boxHeight / 8)}px sans-serif`;
    ctx.fillStyle = '#cccccc';
    ctx.fillText(`ShipID: ${ship.ship_id}`, textX, y + boxHeight - 20);
  }
  return canvas;
};

export const getMissionState = () => {
  const openDur = config.MISSION_CLOSE_DURATION;
  const closeDur = config.MISSION_OPEN_DURATION;
  const cycle = openDur + closeDur;
  const firstOpenTs = config.MISSION_START_TS;
  const now = Math.floor(Date.now() / 1000);

  if (now < firstOpenTs) return { state: 'CLOSED', timeLeft: firstOpenTs - now, nextChange: firstOpenTs };

  const elapsed = (now - firstOpenTs) % cycle;
  if (elapsed < openDur) return { state: 'OPEN', timeLeft: openDur - elapsed, nextChange: now + (openDur - elapsed) };
  return { state: 'CLOSED', timeLeft: cycle - elapsed, nextChange: now + (cycle - elapsed) };
};
export const getFutureMission = (count = 3) => {
  const openDur = config.MISSION_CLOSE_DURATION;
  const closeDur = config.MISSION_OPEN_DURATION;
  const cycle = openDur + closeDur;
  const firstOpenTs = config.MISSION_START_TS;
  const now = Math.floor(Date.now() / 1000);
  const cyclesPassed = Math.floor((now - firstOpenTs) / cycle);
  let t = firstOpenTs + cyclesPassed * cycle;
  if (t < now) t += cycle;
  const list = [];
  for (let i = 0; i < count; i++) {
    const o = t + i * cycle;
    const c = o + openDur;
    list.push({ open: o, close: c });
  }
  return list;
};

export const getDrednotLeaderboard = async (category, by = 'pilot', page = 1, formatter = 'formatDrednotLeaderboard') => {
  const Map = {
    archives: 'archive',
    archived: 'archive',
    'archived categories ⇒': 'archive',
    'old categories': 'archive',
    'past categories': 'archive',
    history: 'archive',
    bots: 'bots',
    bot: 'bots',
    'bot kills': 'bots',
    'regular pve bots': 'bots',
    'regular bot kills': 'bots',
    'pve bots': 'bots',
    coward: 'boss_coward',
    'coward kills': 'boss_coward',
    'coward pve': 'boss_coward',
    'coward boss': 'boss_coward',
    lazer: 'boss_lazer',
    'lazer kills': 'boss_lazer',
    'lazer pve': 'boss_lazer',
    laser: 'boss_lazer',
    'laser kills': 'boss_lazer',
    shield: 'boss_shield',
    'shield kills': 'boss_shield',
    'shield pve': 'boss_shield',
    'shield boss': 'boss_shield',
    'pvp wins': 'pvp_elimination_wins',
    'pvp win': 'pvp_elimination_wins',
    'pvp elim wins': 'pvp_elimination_wins',
    'pvp: elimination wins': 'pvp_elimination_wins',
    'pvp elimination': 'pvp_elimination_wins',
    'pvp loot': 'pvp_elimination_loot',
    'pvp loot elim': 'pvp_elimination_loot',
    'pvp: elimination loot': 'pvp_elimination_loot',
    'pvp elim loot': 'pvp_elimination_loot',
    loot: 'pvp_elimination_loot',
    'loot wins': 'pvp_elimination_loot',
  };
  const cat = Map[category?.toLowerCase()];
  if (!cat) return { ok: false, err: '[-] getDrednotLeaderboard: Invalid category.' };
  const statusPath = paths.database.scrapedo;
  const cachePath = paths.database.leaderboardCache;
  const cacheKey = `${cat}_${by}_${page}`;
  let state,
    cache = {};
  try {
    state = JSON.parse(await fs.readFile(statusPath, 'utf-8'));
  } catch {
    state = { started: Date.now(), resetAt: Date.now() + 32 * 24 * 60 * 60 * 1000, used: 0, limit: 1000, fetch: 0, success: 0, errors: 0, lastFetch: null, next: null, avgIntervalMs: null };
  }
  try {
    cache = JSON.parse(await fs.readFile(cachePath, 'utf-8'));
  } catch {
    cache = {};
  }
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < 24 * 60 * 60 * 1000) return cache[cacheKey].data;
  if (Date.now() > state.resetAt) {
    state.started = Date.now();
    state.resetAt = Date.now() + 32 * 24 * 60 * 60 * 1000;
    state.used = 0;
    state.fetch = 0;
    state.success = 0;
    state.errors = 0;
    state.lastFetch = null;
    state.next = null;
    state.avgIntervalMs = null;
  }
  if (state.next && Date.now() < state.next) return { ok: false, err: `[-] getDrednotLeaderboard: Rate limited. Try again in ${formatTime(state.next - Date.now())}.` };
  if (state.used + 5 > state.limit) return { ok: false, err: '[-] getDrednotLeaderboard: API credit limit reached.' };
  const proxy = 'https://api.scrape.do/?' + `token=${readEnv('SCRAPE_DO_API_KEY')}` + '&url=' + encodeURIComponent(`https://drednot.io/leaderboard?cat=${cat}&by=${by}&p=${page}`) + '&render=true';
  const checkFetchLimits = (fetchPerMin, fetchPerDay, maxPerMin = 60, maxPerDay = state.limit) => {
    if (fetchPerMin > maxPerMin) return { ok: false, err: `Rate limit per minute exceeded (${fetchPerMin}/${maxPerMin})` };
    if (fetchPerDay > maxPerDay) return { ok: false, err: `Rate limit per day exceeded (${fetchPerDay}/${maxPerDay})` };
    return { ok: true };
  };
  try {
    const res = await fetch(proxy);
    const html = await res.text();
    state.fetch++;
    state.used += 5;
    state.success++;
    state.lastFetch = Date.now();
    const elapsed = state.lastFetch - state.started || 1;
    const now = new Date();
    const elapsedMin = (now - (state.lastFetch || now)) / 60000 || 1;
    const maxPerDay = state.limit - state.used;
    const remainingDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
    const maxPerMin = maxPerDay / (remainingDays * 24 * 60);
    state.avgIntervalMs = Math.round(elapsed / state.fetch);
    state.next = now + (fetchPerMin > maxPerMin ? 60000 : 0);
    state.remaining = state.limit - state.used;
    const fetchPerMin = state.fetch / elapsedMin;
    const fetchPerDay = fetchPerMin * 1440;
    const limitCheck = checkFetchLimits(fetchPerMin, fetchPerDay);
    if (!limitCheck.ok) return limitCheck;
    const out = { ok: true, ts: Date.now(), page, category: cat, by, cred: `${state.used}/${state.limit}`, remaining: state.remaining, fetchPerMin, fetchPerDay, nextAt: state.next, html };
    cache[cacheKey] = { ts: Date.now(), data: out };
    await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
    await fs.writeFile(statusPath, JSON.stringify(state, null, 2));
    if (formatter === 'formatDrednotLeaderboard') return formatDrednotLeaderboard(out, by);
    else if (typeof formatter === 'function') return formatter(out, by);
    return out;
  } catch (e) {
    state.errors++;
    await fs.writeFile(statusPath, JSON.stringify(state, null, 2));
    return { ok: false, err: e.message };
  }
};
export const formatDrednotLeaderboard = (data, by = 'pilot') => {
  if (!data.ok) return { ok: false, err: data.err };
  const $ = cheerio.load(data.html);
  const rows = $('table.leaderboard tr');
  const leaderboard = {};
  rows.each((i, row) => {
    const cells = $(row).find('td');
    if (!cells.length) return;
    const rank = $(cells[0]).text().trim();
    const entry = {
      rank,
      name: $(cells[1]).text().trim(),
      score: $(cells[2]).text().trim(),
    };
    if (by.toLowerCase() === 'ship') entry.shipScore = $(cells[3])?.text().trim() || null;
    leaderboard[rank] = entry;
  });
  return {
    ok: true,
    meta: {
      timestamp: new Date(data.ts).toLocaleString(),
      page: data.page,
      category: data.category,
      by: data.by,
      credsUsed: data.cred,
      remainingCreds: data.remaining,
      fetchPerMinute: data.fetchPerMin,
      fetchPerDay: data.fetchPerDay,
      nextFetchAt: new Date(data.nextAt).toLocaleString(),
    },
    leaderboard,
  };
};

export const getSpotifyToken = async () => {
  const accessToken = await readEnv('SPOTIFY_ACCESS_TOKEN');
  const expiresIn = Number(await readEnv('SPOTIFY_EXPIRES_IN'));
  const obtainedAt = Number(await readEnv('SPOTIFY_OBTAINED_AT'));
  if (!accessToken || !expiresIn || !obtainedAt || Date.now() > obtainedAt + (expiresIn - 60) * 1000) return await refreshSpotifyToken();
  return accessToken;
};
export const refreshSpotifyToken = async () => {
  const refreshToken = await readEnv('SPOTIFY_REFRESH_TOKEN');
  const clientId = await readEnv('SPOTIFY_CLIENT_ID');
  const clientSecret = await readEnv('SPOTIFY_CLIENT_ID_SECRET');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json();
  if (!data.access_token) throwError('[-] Failed to refresh Spotify token');
  await writeEnv('SPOTIFY_ACCESS_TOKEN', data.access_token);
  await writeEnv('SPOTIFY_EXPIRES_IN', String(data.expires_in));
  await writeEnv('SPOTIFY_OBTAINED_AT', String(Date.now()));
  return data.access_token;
};
export const searchSpotify = async (songName, artistName = '', limit = 1) => {
  const token = await getSpotifyToken();
  let q = songName;
  if (!q) throwError('[-] songName is required.');
  if (artistName) q += ` artist:${artistName}`;
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=${limit}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data.tracks || !data.tracks.items.length) return [];
  return data.tracks.items;
};
export const resolveDependencies = async (depStr, message) => {
  const dep = {};
  if (typeof depStr !== 'string' || !depStr.trim()) return dep;
  const deps = depStr.trim().split(/\s+/);
  for (const name of deps) {
    if (name === 'helper') dep.helper = helper;
    else if (name === 'config') dep.config = config;
    else if (name === 'message') dep.message = message;
    else if (name === 'commandUsage') dep.commandUsage = commandUsage;
    else if (name === 'clan') dep.clan = clan;
    else if (name === 'marketplace') dep.marketplace = marketplace;
    else if (name === 'paths') dep.paths = paths;
    else if (name === 'deleteSchedule') dep.deleteSchedule = deleteSchedule;
    else if (name === 'trade') dep.trade = trade;
    else if (config?.[name] && (name.startsWith('config.') || name.startsWith('c.') || name.startsWith('.'))) dep[name] = config[name];
    else if (helper?.[name]) dep[name] = helper[name];
    else if (clan?.[name]) dep[name] = clan[name];
    else if (marketplace?.[name]) dep[name] = marketplace[name];
    else if (commandUsage?.[name]) dep[name] = commandUsage[name];
    else if (getcommand?.[name]) dep[name] = getcommand[name];
    else if (deleteSchedule?.[name]) dep[name] = deleteSchedule[name];
    else if (trade?.[name]) dep[name] = trade[name];
    else throwError(`[-] resolveDependencies: Unknown dependency '${name}'`);
  }
  return dep;
};

export const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    if (interfaces.hasOwnProperty(interfaceName)) {
      const addresses = interfaces[interfaceName];
      for (const address of addresses) {
        if (address.family === 'IPv4' && !address.internal) return address.address;
      }
    }
  }
  return null;
};
export const getProxyUrl = () => {
  return config.PROXY_URL || null;
};
export const getNgrokUrl = async () => {
  try {
    const res = await fetch('http://127.0.0.1:4040/api/tunnels');
    if (!res.ok) throwError('Failed to fetch ngrok tunnel info.');
    const data = await res.json();
    const tunnel = data.tunnels.find(t => t.proto === 'https') || data.tunnels[0];
    return tunnel?.public_url || null;
  } catch (err) {
    log(`[-] getNgrokUrl: ${err}`);
    return 'No data.';
  }
};

export const getTax = async (amount = 0, user) => {
  if (config.TAX === false) return 0;
  let rate = typeof config.TAX === 'number' ? config.TAX : 15;
  if (user) {
    const boost = await listSkillBoost(user, 'tax');
    if (boost.ignoreTax) return 0;
    if (typeof boost.ignoreTaxPercent === 'number') rate = rate * (1 - boost.ignoreTaxPercent);
  }
  return Math.floor(amount * (rate / 100));
};

export const initUserObject = async user => {
  let data = await loadData(user);
  if (typeof data !== 'object' || data === null) data = {};
  const added = [];
  const repaired = [];
  const ensure = (obj, key, defaultValue = {}) => {
    if (typeof obj[key] !== 'object' || obj[key] === null) {
      obj[key] = defaultValue;
      added.push(key);
    }
    return obj[key];
  };
  const setDefault = (obj, key, defaultValue) => {
    if (obj[key] === undefined) {
      obj[key] = defaultValue;
      added.push(key);
    } else if (obj[key] === null) {
      obj[key] = defaultValue;
      repaired.push(key);
    }
  };

  const balance = ensure(data, 'balance');
  setDefault(balance, 'dredcoin', 0);

  setDefault(data, 'username', user);

  const exp = ensure(data, 'exp');
  setDefault(exp, 'exp', 0);
  setDefault(exp, 'lv', 1);
  setDefault(exp, 'expNeeded', getExpNeeded(exp.lv));

  setDefault(data, 'command_executed', 1);
  setDefault(data, 'Permission', '');
  setDefault(data, 'blackjack', false);
  setDefault(data, 'multibet', false);
  setDefault(data, 'hilo', false);
  setDefault(data, 'onlyup', false);
  setDefault(data, 'dice', false);

  const onlyupHistory = ensure(data, 'onlyupHistory');
  setDefault(onlyupHistory, 'count', 0);
  setDefault(onlyupHistory, 'lastReset', Date.now());

  const account = ensure(data, 'account');
  setDefault(account, 'status', 'N-Logged-in');

  const streak = ensure(data, 'streak');
  const daily = ensure(streak, 'daily');
  setDefault(daily, 'streak', 0);
  setDefault(daily, 'lastClaimed', 0);
  const weekly = ensure(streak, 'weekly');
  setDefault(weekly, 'streak', 0);
  setDefault(weekly, 'lastClaimed', 0);

  setDefault(data, 'dailyQuests', {});
  setDefault(data, 'weeklyQuests', {});
  setDefault(data, 'monthlyQuests', {});
  setDefault(data, 'yearlyQuests', {});

  setDefault(data, 'equipment', {});

  const bank = ensure(data, 'bank');
  setDefault(bank, 'balance', 0);

  const passiveIncome = ensure(data, 'passiveIncome');
  setDefault(passiveIncome, 'lastClaimed', Date.now());

  const multiplier = ensure(data, 'multiplier');
  setDefault(multiplier, 'exp', 1);
  setDefault(multiplier, 'dredcoin', 1);

  setDefault(data, 'prestige', 0);
  setDefault(data, 'inventory', {});

  const boost = ensure(data, 'boost');
  ensure(boost, 'cooldown');
  ensure(boost, 'passiveIncome');
  setDefault(boost, 'dredcoin', []);

  const skills = ensure(data, 'skills');
  setDefault(skills, 'skills', {});
  setDefault(skills, 'rerollable', false);

  const researchs = ensure(data, 'research');
  setDefault(researchs, 'complete', []);
  setDefault(researchs, 'queue', []);
  setDefault(researchs, 'unlock', false);

  setDefault(data, 'achievement', {});

  const quests = ensure(data, 'quests');
  setDefault(quests, 'active', []);
  setDefault(quests, 'complete', []);

  setDefault(data, 'globalCooldown', {});

  setDefault(data, 'stat', {});

  setDefault(data, 'craftingTask', {});
  setDefault(data, 'cookingTask', {});
  setDefault(data, 'meltingTask', {});

  setDefault(data, 'hatching', {});
  await saveData(user, data);

  return { user, added, repaired };
};

export const isValidBlueprint = async bpStr => {
  try {
    const bp = await decode(bpStr);
    if (!bp.commands || !bp.commands.length)
      return {
        valid: false,
        reason: 'No commands',
      };
    for (const cmd of bp.commands) {
      if (cmd instanceof BuildCmd && Item[cmd.item] === undefined)
        return {
          valid: false,
          reason: `Invalid item: ${cmd.item}`,
        };
    }
    return {
      valid: true,
      reason: 'OK',
    };
  } catch (err) {
    return {
      valid: false,
      reason: 'Decode error',
    };
  }
};
export const bluePrintCountMaterials = async bpStr => {
  const isValid = (await isValidBlueprint(bpStr)).valid;
  if (!isValid) return `[-] bluePrintCountMaterials: Invalid blueprint.`;
  const bp = await decode(bpStr);
  const counts = {};
  for (const cmd of bp.commands) {
    if (cmd instanceof BuildCmd) {
      const k = Item[cmd.item];
      counts[k] = (counts[k] || 0) + 1;
    }
  }
  return { counts };
};
export const bluePrintReplaceMaterial = async (bpStr, fromItem, toItem) => {
  const isValid = (await isValidBlueprint(bpStr)).valid;
  if (!isValid) return `[-] bluePrintReplaceMaterial: Invalid blueprint.`;
  const bp = await decode(bpStr);
  for (const cmd of bp.commands) {
    if (cmd instanceof BuildCmd && cmd.item === fromItem) {
      cmd.item = toItem;
    }
  }
  const encoded = await encode(bp);
  return `DSA:${encoded}`;
};
export const blueprintListMaterials = async bpStr => {
  const isValid = (await isValidBlueprint(bpStr)).valid;
  if (!isValid) return `[-] listMaterials: Invalid blueprint.`;
  const bp = await decode(bpStr);
  const set = new Set();
  for (const cmd of bp.commands) {
    if (cmd instanceof BuildCmd) {
      set.add(Item[cmd.item]);
    }
  }
  return [...set];
};
export const bluePrintRemoveMaterial = async (bpStr, targetItem) => {
  const isValid = (await isValidBlueprint(bpStr)).valid;
  if (!isValid) return `[-] bluePrintRemoveMaterial: Invalid blueprint.`;
  const bp = await decode(bpStr);
  bp.commands = bp.commands.filter(cmd => !(cmd instanceof BuildCmd && cmd.item === targetItem));
  return 'DSA:' + (await encode(bp));
};
export const blueprintMostUsedMaterial = async bpStr => {
  const isValid = (await isValidBlueprint(bpStr)).valid;
  if (!isValid) return `[-] blueprintMostUsedMaterial: Invalid blueprint.`;
  const bp = await decode(bpStr);
  const counts = {};
  for (const cmd of bp.commands) {
    if (cmd instanceof BuildCmd) {
      const key = Item[cmd.item];
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  let maxMat = null,
    maxCount = 0;
  for (const [mat, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      maxMat = mat;
    }
  }
  return {
    material: maxMat,
    count: maxCount,
  };
};
export const blueprintPreview = async (bpStr, y = 0) => {
  const isValid = (await isValidBlueprint(bpStr)).valid;
  if (!isValid) return `[-] blueprintPreview: Invalid blueprint.`;
  const bp = await decode(bpStr);
  const grid = {};
  for (const cmd of bp.commands) {
    if (cmd instanceof BuildCmd && cmd.pos.y === y) {
      const full = Item[cmd.item];
      const abbr = full
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase();
      const key = `${cmd.pos.x},${cmd.pos.z}`;
      grid[key] = abbr;
    }
  }
  const xs = [...new Set(Object.keys(grid).map(k => parseInt(k.split(',')[0])))];
  const zs = [...new Set(Object.keys(grid).map(k => parseInt(k.split(',')[1])))];
  xs.sort((a, b) => a - b);
  zs.sort((a, b) => a - b);
  let out = '';
  for (const z of zs) {
    let row = '';
    for (const x of xs) row += (grid[`${x},${z}`] || '..').padEnd(3, ' ');
    out += row + '\n';
  }
  return out.trim();
};
export const blueprintCountCmdTypes = async bpStr => {
  const isValid = (await isValidBlueprint(bpStr)).valid;
  if (!isValid) return `[-] blueprintCountCmdTypes: Invalid blueprint.`;
  const bp = await decode(bpStr);
  const out = { build: 0, erase: 0, message: 0, other: 0 };
  for (const cmd of bp.commands) {
    if (cmd instanceof BuildCmd) out.build++;
    else if (cmd instanceof EraseCmd) out.erase++;
    else if (cmd instanceof MsgCmd) out.message++;
    else out.other++;
  }
  return out;
};
export const blueprintResourceCost = async bpStr => {
  const isValid = (await isValidBlueprint(bpStr)).valid;
  if (!isValid) return `[-] blueprintResourceCost: Invalid blueprint.`;
  const bp = await decode(bpStr);
  const map = {};
  for (const cmd of bp.commands) {
    if (cmd instanceof BuildCmd) map[Item[cmd.item]] = (map[Item[cmd.item]] || 0) + 1;
  }
  return map;
};
export const bluePrintRandomizeItems = async bpStr => {
  const isValid = (await isValidBlueprint(bpStr)).valid;
  if (!isValid) return `[-] bluePrintRandomizeItems: Invalid blueprint.`;
  const bp = await decode(bpStr);
  const itemList = Object.keys(Item).filter(k => !isNaN(Item[k]));
  for (const cmd of bp.commands) {
    if (cmd instanceof BuildCmd) {
      const rand = itemList[Math.floor(randomNumber(0, itemList.length))];
      cmd.item = Item[rand];
    }
  }
  return 'DSA:' + (await encode(bp));
};
export const blueprintCompare = async (bpStr1, bpStr2) => {
  const isValid1 = (await isValidBlueprint(bpStr1)).valid;
  const isValid2 = (await isValidBlueprint(bpStr2)).valid;
  if (!isValid1) return `[-] compareBlueprints: First blueprint is invalid.`;
  if (!isValid2) return `[-] compareBlueprints: Second blueprint is invalid.`;
  if (bpStr1 === bpStr2) return { added: [], removed: [], changed: [] };
  const bp1 = await decode(bpStr1);
  const bp2 = await decode(bpStr2);
  const map1 = new Map();
  const map2 = new Map();
  const key = cmd => `${cmd.pos.x},${cmd.pos.y},${cmd.pos.z}`;
  for (const cmd of bp1.commands) {
    if (cmd instanceof BuildCmd) map1.set(key(cmd), cmd.item);
  }
  for (const cmd of bp2.commands) {
    if (cmd instanceof BuildCmd) map2.set(key(cmd), cmd.item);
  }
  const added = [];
  const removed = [];
  const changed = [];
  for (const [k, item2] of map2) {
    if (!map1.has(k)) added.push({ pos: k, item: Item[item2] });
    else if (map1.get(k) !== item2) changed.push({ pos: k, from: Item[map1.get(k)], to: Item[item2] });
  }
  for (const [k, item1] of map1) {
    if (!map2.has(k)) removed.push({ pos: k, item: Item[item1] });
  }
  return {
    added,
    removed,
    changed,
  };
};

export const givePermanentBoost = async (user, { dredcoin = 0, exp = 0 }) => {
  if (!(await isValidUser(user))) throwError(`[-] applyPermanentBoost: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  if (dredcoin !== 0) data.multiplier.dredcoin += dredcoin;
  if (exp !== 0) data.multiplier.exp += exp;
  await saveData(user, data);
};
export const giveDredcoinBoost = async (user, multiplier, duration) => {
  if (!(await isValidUser(user))) throwError(`[-] giveDredcoinBoost: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const expiresAt = Date.now() + duration;
  data.boost.dredcoin.push({
    multiplier,
    expiresAt,
  });
  await saveData(user, data);
  return {
    user,
    multiplier,
    expiresAt,
  };
};
// with boosts / dredcoin multipliers
export const giveDredcoin = async (user, amount) => {
  if (!(await isValidUser(user))) throwError(`[-] giveDredcoin: User ${user} not found.`);
  await initUserObject(user);
  amount = Number(amount);
  if (!isInteger(amount)) throwError(`[-] giveDredcoin: ${amount} is not a valid number.`);
  const tax = await getTax(amount, user);
  const taxedAmount = amount - tax;
  const { totalMultiplier: boostMultiplier } = await getActiveBoosts(user, 'dredcoin');
  const skillMultiplierObj = await listSkillBoost(user, 'dredcoin');
  const skillMultiplier = skillMultiplierObj?.total ?? 1;
  const combinedMultiplier = boostMultiplier * skillMultiplier;
  const boostedAmount = Math.floor(taxedAmount * combinedMultiplier);
  let data = await loadData(user);
  if (typeof data.balance.dredcoin !== 'number') data.balance.dredcoin = 0;
  const { max } = await isMaxCoin(user);
  data.balance.dredcoin = Math.min(data.balance.dredcoin + boostedAmount, max || Infinity);
  await saveData(user, data);
  return {
    gave: taxedAmount,
    to: user,
    tax,
    bonus: boostedAmount,
    skillMultiplier,
    boostMultiplier,
    combinedMultiplier,
    newBalance: data.balance.dredcoin,
  };
};
// without boosts / dredcoin multiplier
export const addDredcoin = async (user, amount) => {
  if (!(await isValidUser(user))) throwError(`[-] addDredcoin: User ${user} not found.`);
  await initUserObject(user);
  amount = Number(amount);
  if (!isInteger(amount) || amount < 0) throwError(`[-] addDredcoin: Invalid amount '${amount}'.`);
  let data = await loadData(user);
  if (typeof data.balance.dredcoin !== 'number') data.balance.dredcoin = 0;
  const { max } = await isMaxCoin(user);
  data.balance.dredcoin = Math.min(data.balance.dredcoin + amount, max || Infinity);
  await saveData(user, data);
  return { user, added: amount, newBalance: data.balance.dredcoin };
};
export const removeDredcoin = async (user, amount) => {
  if (!(await isValidUser(user))) throwError(`[-] removeDredcoin: User ${user} not found.`);
  await initUserObject(user);
  amount = Number(amount);
  if (!isInteger(amount)) return false;
  const data = await loadData(user);
  const balance = data.balance;
  const current = balance.dredcoin;
  if (current < amount) return false;
  balance.dredcoin = current - amount;
  await saveData(user, data);
  return {
    removed: amount,
    remaining: balance.dredcoin,
    newBalance: balance.dredcoin,
    user,
  };
};
export const setDredcoin = async (user, amount) => {
  if (!(await isValidUser(user))) throwError(`[-] setDredcoin: User ${user} not found.`);
  await initUserObject(user);
  amount = Number(amount);
  if (!isInteger(amount)) throwError(`[-] setDredcoin: ${amount} is not a valid number.`);
  const { max } = await isMaxCoin(user);
  const clamped = Math.max(0, Math.min(amount, max));
  const data = await loadData(user);
  const balance = data.balance;
  balance.dredcoin = clamped;
  await saveData(user, data);
  return {
    setTo: clamped,
    max,
    user,
  };
};

export const getDredcoin = async user => {
  if (!(await isValidUser(user))) throwError(`[-] getDredcoin: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  return data.balance.dredcoin;
};
export const getBankBalance = async user => {
  if (!(await isValidUser(user))) throwError(`[-] getBankBalance: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  return data.bank.balance;
};

export const applyDredcoinMultiplier = async (user, amount) => {
  if (!(await isValidUser(user))) throwError(`[-] applyDredcoinMultipler: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const applied = amount * data.multiplier.dredcoin * data.prestige;
  return applied;
};
export const applyExpMultiplier = async (user, amount) => {
  if (!(await isValidUser(user))) throwError(`[-] applyExpMultipler: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const applied = amount * data.multiplier.exp * data.prestige;
  return applied;
};

export const isMaxCoin = async user => {
  if (!(await isValidUser(user))) throwError(`[-] isMaxCoin: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  if (config.MAX_DREDCOIN === false) {
    return {
      isMax: false,
      current: data.balance.dredcoin,
      max: Number.MAX_SAFE_INTEGER,
    };
  }
  let maxAmount = config.MAX_DREDCOIN;
  if (typeof maxAmount === 'string') {
    try {
      maxAmount = parseAmount(maxAmount);
    } catch (err) {
      throwError(`[-] isMaxCoin: Failed to parse MAX_DREDCOIN string: ${config.MAX_DREDCOIN}`);
    }
  }
  return {
    isMax: data.balance.dredcoin >= maxAmount,
    current: data.balance.dredcoin,
    max: maxAmount,
  };
};
export const isMaxBank = async user => {
  if (!(await isValidUser(user))) throwError(`[-] isMaxBank: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  let maxAmount = config.MAX_BANK;
  if (maxAmount === false) maxAmount = Number.MAX_SAFE_INTEGER;
  else if (typeof maxAmount === 'string') {
    try {
      maxAmount = parseAmount(maxAmount);
    } catch (err) {
      throwError(`[-] isMaxBank: Failed to parse MAX_BANK string: ${config.MAX_BANK}`);
    }
  }
  return {
    isMax: data.bank.balance >= maxAmount,
    current: data.bank.balance,
    max: maxAmount,
  };
};
export const isMaxLevel = async user => {
  if (!(await isValidUser(user))) throwError(`[-] isMaxLevel: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const lv = data?.exp?.lv ?? 0;
  let maxAmount = config.MAX_LEVEL;
  if (maxAmount === false) maxAmount = Number.MAX_SAFE_INTEGER;
  return {
    isMax: lv >= maxAmount,
    current: lv,
    max: maxAmount,
  };
};

export const getExpNeeded = async (level, user) => {
  let base = config.EXPNEEDED_BASE || 100;
  let multiplier = 1;
  if (config.EXPNEEDED_MULTIPLIER_AFTER_LEVEL) {
    const levelbase = Object.keys(config.EXPNEEDED_MULTIPLIER_AFTER_LEVEL)
      .map(Number)
      .sort((a, b) => a - b);
    for (const threshold of levelbase) {
      if (level >= threshold) multiplier = config.EXPNEEDED_MULTIPLIER_AFTER_LEVEL[threshold];
    }
  }
  base *= multiplier;
  if (user) {
    const prestige = await getPrestige(user);
    const prestigeScale = 1 + prestige * (config.PRESTIGE_DIFFICULTY_PERCENT / 100);
    const debuff = await listSkillBoost(user, 'expNeededDebuffPercent').total;
    return Math.floor((base * prestigeScale) / debuff);
  }
  return Math.floor(base);
};
export const getUserExpData = async user => {
  if (!(await isValidUser(user))) throwError(`[-] getUserExpData: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  if (!data.exp || typeof data.exp !== 'object') data.exp = { lv: 1, exp: 0 };
  if (typeof data.exp.lv !== 'number' || isInteger(data.exp.lv)) data.exp.lv = 1;
  if (typeof data.exp.exp !== 'number' || isInteger(data.exp.exp)) data.exp.exp = 0;
  const level = data.exp.lv;
  const exp = data.exp.exp;
  const prestige = Number.isFinite(data?.prestige) ? data.prestige : 0;
  const Needed = getExpNeeded(level, user);
  const needed = typeof data.exp.expNeeded === 'number' ? data.exp.expNeeded : Needed;
  return { data, current: exp, Needed, level, expNeeded: needed };
};
export const canLevelUp = async user => {
  if (!(await isValidUser(user))) throwError(`[-] canLevelUp: User ${user} not found.`);
  await initUserObject(user);
  const { current, level } = await getUserExpData(user);
  let tempLevel = level,
    tempExp = current;
  let count = 0;
  while (tempExp >= getExpNeeded(tempLevel)) {
    if (await isMaxLevel(user).isMax) break;
    tempExp -= getExpNeeded(tempLevel++);
    count++;
  }
  return count > 0 ? count : false;
};
export const forceLevelUp = async (user, amount = 1) => {
  if (!(await isValidUser(user))) throwError(`[-] forceLevelUp: User ${user} not found.`);
  await initUserObject(user);
  amount = Number(amount);
  if (!Number.isFinite(amount) || amount <= 0) throwError('[-] forceLevelUp: Invalid amount.');
  const { data, current, level: oldLevel, expNeeded: oldExpNeeded } = await getUserExpData(user);
  let level = typeof oldLevel === 'number' && !isInteger(oldLevel) ? oldLevel : 1;
  let exp = typeof current === 'number' && !isInteger(current) ? current : 0;
  const isMax = (await isMaxLevel(user)).isMax;
  const max = (await isMaxLevel(user)).max;
  if (isMax !== Infinity && isMax === true) return `[!] forceLevelUp: ${user} already has the maximum level.`;
  let leveledUp = 0;
  while (amount > 0) {
    if (await isMaxLevel(user).isMax) break;
    level++;
    leveledUp++;
    amount--;
  }
  const bonusLevel = (await listSkillBoost(user, 'bonusLevel').total) || 0;
  if (bonusLevel > 0) {
    level += bonusLevel;
    leveledUp += bonusLevel;
  }
  const bonusLevelPercent = (await listSkillBoost(user, 'bonusLevelPercent').total) || 0;
  if (bonusLevelPercent > 0) {
    const bonusLevels = Math.floor(level * bonusLevelPercent);
    level += bonusLevels;
    leveledUp += bonusLevels;
  }
  if (isMax) level = max;
  const newExpNeeded = await getExpNeeded(level, user);
  data.exp.lv = level;
  data.exp.exp = exp;
  await saveData(user, data);
  return {
    type: 'forceLevelUp',
    leveledUp,
    oldLevel,
    oldExp: current,
    oldExpNeeded,
    newLevel: level,
    newExp: exp,
    newExpNeeded,
    exp,
    expNeeded: newExpNeeded,
    reachedMaxLevel: (await isMaxLevel(user)).isMax,
  };
};
export const levelUpIfCan = async user => {
  if (!(await isValidUser(user))) throwError(`[-] levelUpIfCan: User ${user} not found.`);
  await initUserObject(user);
  const levelUps = await canLevelUp(user);
  if (!levelUps)
    return {
      type: 'levelUpIfCan',
      leveledUp: 0,
    };
  const result = await forceLevelUp(user, levelUps);
  return {
    type: 'levelUpIfCan',
    ...result,
  };
};
export const giveExp = async (user, amount) => {
  if (!(await isValidUser(user))) throwError(`[-] giveExp: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  if (!data.exp || typeof data.exp !== 'object') data.exp = { lv: 1, exp: 0 };
  const oldLevel = data.exp.lv;
  const oldExp = data.exp.exp;
  const isMax = (await isMaxLevel(user)).isMax;
  const { totalMultiplier } = await getActiveBoosts(user, 'exp');
  let appliedAmount = Math.floor(amount * totalMultiplier);
  const bonusExp = await listSkillBoost(user, 'expBonus').total;
  appliedAmount += bonusExp;
  let level = oldLevel;
  let exp = oldExp + appliedAmount;
  let reachedMaxLevel = false;
  while (exp >= (await getExpNeeded(level, user)) && isMax === Infinity) {
    exp -= await getExpNeeded(level, user);
    level++;
  }
  if (isMax !== Infinity && level >= config.MAX_LEVEL) {
    level = config.MAX_LEVEL;
    exp = 0;
    reachedMaxLevel = true;
  }
  data.exp.lv = level;
  data.exp.exp = exp;
  await saveData(user, data);
  let bonusLevelChance = (await listSkillBoost(user, 'bonusLevelChance').total) || 0;
  let bonusLevels = 0;
  while (bonusLevelChance > 0 && randomNumber() < bonusLevelChance) {
    level++;
    bonusLevels++;
    data.exp.lv = level;
    data.exp.exp = 0;
    bonusLevelChance -= 100;
  }
  if (bonusLevels > 0) await saveData(user, data);
  return {
    type: 'gain',
    gained: appliedAmount,
    oldLevel,
    oldExp,
    oldExpNeeded: await getExpNeeded(oldLevel, user),
    newLevel: level,
    newExp: exp,
    newExpNeeded: await getExpNeeded(level, user),
    bonusExp,
    reachedMaxLevel,
    bonusLevels,
  };
};
export const removeExp = async (user, amount) => {
  if (!(await isValidUser(user))) throwError(`[-] removeExp: User ${user} not found.`);
  await initUserObject(user);
  amount = Number(amount);
  if (!isInteger(amount) || amount <= 0) throwError(`[-] removeExp: Invalid amount.`);
  const { data, current, needed, level: oldLevel } = await getUserExpData(user);
  let level = oldLevel;
  let exp = current - amount;
  while (exp < 0 && level > 1) {
    level--;
    exp += await getExpNeeded(level, user);
  }
  if (level <= 1 && exp < 0) {
    level = 1;
    exp = 0;
  }
  data.exp.lv = level;
  data.exp.exp = exp;
  await saveData(user, data);
  return {
    type: 'remove',
    removed: amount,
    oldLevel,
    oldExp: current,
    oldExpNeeded: needed,
    newLevel: level,
    newExp: exp,
    newExpNeeded: await getExpNeeded(level, user),
  };
};
export const giveExpBoost = async (user, multiplier, duration) => {
  if (!(await isValidUser(user))) throwError(`[-] giveXpBoost: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const expiresAt = Date.now() + duration;
  data.boost.exp.push({
    multiplier,
    expiresAt,
  });
  await saveData(user, data);
  return {
    user,
    multiplier,
    expiresAt,
  };
};
export const getExp = async user => {
  if (!(await isValidUser(user))) throwError(`[-] getExp: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const current = (data.exp.xp ??= 0);
  const level = (data.exp.lv ??= 1);
  const needed = (data.exp.expNeeded ??= getExpNeeded(level));
  return {
    current: current,
    needed: needed,
    level: level,
  };
};

export const prestigeIfCan = async user => {
  if (!(await isValidUser(user))) throwError(`[-] prestigeIfCan: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const oldPrestige = Number.isFinite(data?.prestige) ? data.prestige : 0;
  const levels = config.PRESTIGE_LEVELS ?? [];
  const currentLevel = data.exp.lv ?? 0;
  let canPrestige = false;
  if (levels.length > 0)
    if (oldPrestige < levels.length && currentLevel >= levels[oldPrestige]) canPrestige = true;
    else {
      const maxData = await isMaxLevel(user);
      if (currentLevel >= maxData.max) canPrestige = true;
    }
  if (!canPrestige) return `[!] prestigeIfCan: ${user} cannot prestige at level ${currentLevel}.`;
  const bonus = await listSkillBoost(user, 'prestigeBonus');
  const newPrestige = oldPrestige + 1 + bonus;
  const newExpNeeded = getExpNeeded(1, user);
  data.exp.lv = 1;
  data.exp.exp = 0;
  data.exp.expNeeded = newExpNeeded;
  data.prestige = newPrestige > levels.length ? levels.length : newPrestige;
  await saveData(user, data);
  return {
    type: 'prestigeIfCan',
    user,
    newPrestige: data.prestige,
    newLevel: 1,
    newExp: 0,
    newExpNeeded,
  };
};
export const prestige = async user => {
  if (!(await isValidUser(user))) throwError(`[-] prestige: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const oldPrestige = Number.isFinite(data.prestige) ? data.prestige : 0;
  const bonus = await getSkillBonuses(user, 'prestigeBonus');
  const newPrestige = oldPrestige + 1 + bonus;
  const newExpNeeded = getExpNeeded(1, user);
  data.exp.lv = 1;
  data.exp.exp = 0;
  data.exp.expNeeded = newExpNeeded;
  data.prestige = newPrestige;
  await saveData(user, data);
  return {
    type: 'prestige',
    user,
    newPrestige,
    newExp: 0,
    newLevel: 1,
    newExpNeeded,
  };
};
export const getPrestige = async user => {
  if (!(await isValidUser(user))) throwError(`[-] getPrestige: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const prestige = data?.prestige;
  return Number.isFinite(prestige) && prestige >= 0 ? prestige : 0;
};

export const isExpired = boost => {
  const now = Date.now();
  const expired = typeof boost.expiresAt !== 'number' || boost.expiresAt <= now;
  return expired;
};
export const deleteAllExpiredBoosts = async user => {
  if (!(await isValidUser(user))) throwError(`[-] deleteAllExpiredBoosts: Invalid user ${user}`);
  await initUserObject(user);
  const data = await loadData(user);
  let summary = {};
  for (const [boostType, boosts] of Object.entries(data.boost)) {
    if (!Array.isArray(boosts)) continue;
    const length = boosts.length;
    const booosts = boosts.filter(boost => !isExpired(boost));
    const removed = length - booosts.length;
    if (removed > 0) {
      summary[boostType] = removed;
      data.boost[boostType] = booosts;
    }
  }
  await saveData(user, data);
  return {
    user,
    deleted: summary,
  };
};
export const deleteExpiredBoosts = async (user, boostType) => {
  if (!(await isValidUser(user))) throwError(`[-] deleteExpiredBoosts: Invalid user ${user}`);
  await initUserObject(user);
  const data = await loadData(user);
  if (!data.boost || !Array.isArray(data.boost[boostType])) return;
  data.boost[boostType] = data.boost[boostType].filter(boost => !isExpired(boost));
  await saveData(user, data);
  return {
    user,
    deleted: boostType,
  };
};
export const getActiveBoosts = async (user, boostType) => {
  if (!(await isValidUser(user))) throwError(`[-] getActiveBoosts: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  if (!data.boost) data.boost = {};
  if (!Array.isArray(data.boost[boostType])) data.boost[boostType] = [];
  const now = Date.now();
  const all = data.boost[boostType];
  const activeBoosts = all.filter(boost => !isExpired(boost));
  data.boost[boostType] = activeBoosts;
  await saveData(user, data);
  const totalMultiplier = activeBoosts.reduce((acc, b) => acc * b.multiplier, 1);
  const timeLeft = activeBoosts.length > 0 ? Math.max(...activeBoosts.map(b => b.expiresAt - now)) : 0;
  return {
    user,
    active: activeBoosts.length > 0,
    boosts: activeBoosts,
    totalMultiplier,
    timeLeft,
  };
};
export const giveBoost = async (user, type, multiplier, duration) => {
  if (!(await isValidUser(user))) throwError(`[-] giveBoost: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const expiresAt = Date.now() + duration;
  data.boost[type].push({
    multiplier,
    expiresAt,
  });
  await saveData(user, data);
  return {
    user,
    type,
    multiplier,
    expiresAt,
  };
};

export const giveLuck = async (user, category, multiplier, durationMs) => {
  if (!(await isValidUser(user))) throwError(`[-] giveLuck: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  if (!data.boost) data.boost = {};
  if (!data.boost.luck) data.boost.luck = {};
  if (!Array.isArray(data.boost.luck[category])) data.boost.luck[category] = [];
  const bonus = (await listSkillBoost(user, 'luck').total) || 0;
  const bonusPercent = (await listSkillBoost(user, 'luckPercent').total) || 0;
  const boostedMultiplier = multiplier * (1 + bonusPercent) + bonus;
  const expiresAt = Date.now() + durationMs;
  data.boost.luck[category].push({ multiplier: boostedMultiplier, expiresAt });
  await saveData(user, data);
  return {
    user,
    category,
    baseMultiplier: multiplier,
    boostedMultiplier,
    flatBonus,
    percentBonus,
    expiresAt,
  };
};
export const getLuck = async user => {
  if (!(await isValidUser(user))) throwError(`[-] getLuck: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const now = Date.now();
  const luckData = {};
  if (data?.boost?.luck) {
    for (const [category, boosts] of Object.entries(data.boost.luck)) {
      const active = boosts.filter(b => b.expiresAt > now);
      if (active.length > 0) luckData[category] = active.reduce((acc, b) => acc * b.multiplier, 1);
    }
  }
  return luckData;
};

export const giveLuckBoost = async (user, multiplier, durationMs) => {
  if (!(await isValidUser(user))) throwError(`[-] giveLuckBoost: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  if (!Array.isArray(data.boost.luck_global)) data.boost.luck_global = [];
  const expiresAt = Date.now() + durationMs;
  data.boost.luck_global.push({ multiplier, expiresAt });
  await saveData(user, data);
  return { user, multiplier, expiresAt };
};
export const applyLuckBoost = async user => {
  if (!(await isValidUser(user))) throwError(`[-] applyLuckBoost: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const now = Date.now();
  const globalBoosts = (data?.boost?.luck_global || []).filter(b => b.expiresAt > now);
  const globalMultiplier = globalBoosts.reduce((acc, b) => acc * b.multiplier, 1);
  const categoryMultipliers = {};
  if (data?.boost?.luck) {
    for (const [category, boosts] of Object.entries(data.boost.luck)) {
      const active = boosts.filter(b => b.expiresAt > now);
      if (active.length > 0) {
        const categoryMultiplier = active.reduce((acc, b) => acc * b.multiplier, 1);
        categoryMultipliers[category] = categoryMultiplier * globalMultiplier;
      }
    }
  }
  return {
    user,
    globalMultiplier,
    categoryMultipliers,
    get: category => categoryMultipliers[category] || globalMultiplier || 1,
  };
};

export const givePassiveIncomeBoost = async (user, multiplier, duration) => {
  if (!(await isValidUser(user))) throwError(`[-] applyPassiveIncomeBoost: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  data.boost.passiveIncome.push({
    multiplier,
    expiresAt: Date.now() + duration,
  });
  await saveData(user, data);
  return {
    user,
    multiplier,
    expiresAt: Date.now() + duration,
  };
};
export const earnPassiveIncome = async user => {
  if (!(await isValidUser(user))) throwError(`[-] earnPassiveIncome: User ${user} not found.`);
  await initUserObject(user);
  const now = Date.now();
  const data = await loadData(user);
  const last = data.passiveIncome.lastClaimed;
  const seconds = Math.floor((now - last) / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return `[-] earnPassiveIncome: Not enough time has passed.`;
  const prestige = Number.isFinite(data.prestige) ? data.prestige : 1;
  const coinBase = config.PASSIVE_INCOME.BASE_PER_MINUTE || 10;
  const expBase = config.PASSIVE_INCOME.EXP_BASE_PER_MINUTE || 5;
  const prestigeMultiplier = 1 + prestige * (config.PASSIVE_INCOME.MULTIPLIER_PER_PRESTIGE || 0.05);
  let totalMultiplier = prestigeMultiplier;
  const boosts = data.boost?.passiveIncome || [];
  for (const boost of boosts) {
    if (!isExpired(boost)) totalMultiplier *= boost.multiplier;
  }
  data.boost.passiveIncome = boosts.filter(boost => !isExpired(boost));
  const perSec = (await listSkillBoost(user, 'bonusPassiveIncomePerSecond').total) || 0;
  const perMin = (await listSkillBoost(user, 'bonusPassiveIncomePerMinute').total) || 0;
  const perHour = (await listSkillBoost(user, 'bonusPassiveIncomePerHour').total) || 0;
  const rawCoin = minutes * coinBase * totalMultiplier + seconds * perSec + minutes * perMin + (seconds / 3600) * perHour;
  const rawExp = minutes * expBase * totalMultiplier + seconds * perSec * 0.5 + minutes * perMin * 0.5 + (seconds / 3600) * perHour * 0.5;
  const earnedCoins = Math.floor(await applyDredcoinMultiplier(user, rawCoin));
  const earnedExp = Math.floor(await applyExpMultiplier(user, rawExp));
  data.balance.dredcoin += earnedCoins;
  data.exp.exp += earnedExp;
  data.passiveIncome.lastClaimed = now;
  await saveData(user, data);
  const leveledUp = await levelUpIfCan(user);
  return {
    user,
    seconds,
    minutes,
    prestige,
    dredcoin: earnedCoins,
    exp: earnedExp,
    multiplier: totalMultiplier,
    skillBonuses: { perSec, perMin, perHour },
    leveledUp,
    income: [perSec, perMin, perHour],
  };
};
export const getPassiveIncome = async user => {
  if (!(await isValidUser(user))) throwError(`[-] getPassiveIncome: User ${user} not found.`);
  await initUserObject(user);
  const now = Date.now();
  const data = await loadData(user);
  const last = data.passiveIncome.lastClaimed ?? now;
  const seconds = Math.floor((now - last) / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) {
    return {
      user,
      seconds,
      minutes,
      dredcoin: 0,
      exp: 0,
      prestige: data.prestige || 0,
      multiplier: 1,
      skillBonuses: {},
    };
  }
  const prestige = Number.isFinite(data.prestige) ? data.prestige : 0;
  const dredBase = config.PASSIVE_INCOME.BASE_PER_MINUTE_DREDCOIN || 10;
  const expBase = config.PASSIVE_INCOME.BASE_PER_MINUTE_EXP || 5;
  const baseMult = 1 + prestige * (config.PASSIVE_INCOME.MULTIPLIER_PER_PRESTIGE || 0.05);
  let totalMultiplier = baseMult;
  const boosts = data.boost?.passiveIncome || [];
  for (const boost of boosts) {
    if (!isExpired(boost)) totalMultiplier *= boost.multiplier;
  }
  const skillBonuses = await applySkillBoosts(user);
  const perSec = skillBonuses?.bonusPassiveIncomePerSecond || 0;
  const perMin = skillBonuses?.bonusPassiveIncomePerMinute || 0;
  const perHour = skillBonuses?.bonusPassiveIncomePerHour || 0;
  const rawDred = minutes * dredBase * totalMultiplier + seconds * perSec + minutes * perMin + (seconds / 3600) * perHour;
  const rawExp = minutes * expBase * totalMultiplier + seconds * perSec * 0.5 + minutes * perMin * 0.5 + (seconds / 3600) * perHour * 0.5;
  const dredcoin = Math.floor(await applyDredcoinMultiplier(user, rawDred));
  const exp = Math.floor(await applyExpMultiplier(user, rawExp));
  return {
    user,
    seconds,
    minutes,
    dredcoin,
    exp,
    prestige,
    multiplier: totalMultiplier,
    skillBonuses: { perSec, perMin, perHour },
  };
};

export const giveCooldownBoost = async (user, multiplier, durationMs) => {
  if (!(await isValidUser(user))) throwError(`[-] giveCooldownBoost: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  if (!Array.isArray(data.boost.cooldown)) data.boost.cooldown = [];
  data.boost.cooldown.push({
    multiplier,
    expiresAt: Date.now() + durationMs,
  });
  await saveData(user, data);
  return {
    user,
    multiplier,
    expiresAt: Date.now() + durationMs,
  };
};
export const getCooldownBoost = async user => {
  if (!(await isValidUser(user))) throwError(`[-] getCooldownBoost: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  if (!Array.isArray(data.boost.cooldown)) data.boost.cooldown = [];
  const now = Date.now();
  const boosts = data.boost.cooldown;
  const activeBoosts = boosts.filter(boost => !isExpired(boost));
  if (activeBoosts.length === 0) {
    return {
      user,
      active: false,
      multiplier: 1,
      timeLeft: 0,
      boosts: [],
    };
  }
  const multiplier = activeBoosts.reduce((acc, b) => acc * b.multiplier, 1);
  const timeLeft = Math.max(...activeBoosts.map(b => b.expiresAt - now));
  return {
    user,
    active: true,
    multiplier,
    timeLeft,
    boosts: activeBoosts,
  };
};
export const newCooldown = async (user, command, seconds) => {
  if (!command || isNaN(seconds)) throwError(`[-] newCooldown: Invalid arguments.`);
  if (!(await isValidUser(user))) throwError(`[-] newCooldown: User ${user} not found.`);
  await initUserObject(user);
  const now = Date.now();
  if (seconds <= 0)
    return {
      setAt: now,
      duration: 0,
      expires: now,
    };
  cooldowns = cooldowns || {};
  if (!cooldowns[user]) cooldowns[user] = {};
  const baseDuration = seconds * 1000;
  let duration = baseDuration;
  const skillBoosts = await applySkillBoosts(user);
  const extraCooldown = skillBoosts?.bonusCooldown ?? 0;
  const reducedCooldown = skillBoosts?.debuffCooldown ?? 0;
  duration = baseDuration + extraCooldown - reducedCooldown;
  if (duration < 500) duration = 500;
  cooldowns[user][command] = {
    setAt: now,
    duration,
    expires: now + duration,
  };
  return {
    user,
    command,
    baseDuration,
    finalDuration: duration,
    expire: now + duration,
    extraCooldown,
    reducedCooldown,
  };
};
export const newGlobalCooldown = async (user, command, seconds) => {
  if (!(await isValidUser(user))) throwError(`[-] newGlobalCooldown: User ${user} not found.`);
  await initUserObject(user);
  if (isNaN(seconds)) throwError(`[-] newGlobalCooldown: seconds (${seconds}) Not a number.`);
  const now = Date.now();
  if (seconds <= 0)
    return {
      user,
      expires: now,
      setAt: now,
    };
  let data = await loadData(user);
  if (!data) data = {};
  if (!data.globalCooldown) data.globalCooldown = {};
  data.globalCooldown[command] = {
    expires: now + seconds * 1000,
    setAt: now,
  };
  await saveData(user, data);
  return {
    user,
    expires: now + seconds * 1000,
    setAt: now,
  };
};
export const Cooldown = async (user, command) => {
  if (!(await isValidUser(user))) return false;
  await initUserObject(user);
  const cd = cooldowns?.[user]?.[command];
  if (!cd || typeof cd.expires !== 'number') return false;
  const now = Date.now();
  const { active, multiplier } = await getCooldownBoost(user);
  if (active && cd.setAt && cd.duration) {
    const adjustedDuration = cd.duration / multiplier;
    const endTime = cd.setAt + adjustedDuration;
    const remaining = Math.max(0, endTime - now);
    if (remaining <= 0) {
      delete cooldowns[user][command];
      return false;
    }
    return {
      user,
      command,
      remaining,
      expires: endTime,
      claimableAt: new Date(endTime),
    };
  }
  const remaining = cd.expires - now;
  if (remaining <= 0) {
    delete cooldowns[user][command];
    return false;
  }
  return {
    user,
    command,
    remaining,
    expires: cd.expires,
    claimableAt: new Date(cd.expires),
  };
};
export const GlobalCooldown = async (user, command) => {
  if (!(await isValidUser(user))) throwError(`[-] GlobalCooldown: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const cd = data?.globalCooldown?.[command];
  if (!cd) return false;
  const now = Date.now();
  const { active, multiplier, start, duration } = await getCooldownBoost(user);
  if (active && cd.setAt) {
    const elapsed = now - cd.setAt;
    const boosted = elapsed * multiplier;
    const remaining = Math.max(0, cd.expires - (cd.setAt + boosted));
    if (remaining <= 0) {
      delete data.globalCooldown[command];
      await saveData(user, data);
      return false;
    }
    return {
      user,
      command,
      remaining,
      expires: now + remaining,
      claimableAt: new Date(now + remaining),
    };
  }
  const remaining = cd.expires - now;
  if (remaining <= 0) {
    delete data.globalCooldown[command];
    await saveData(user, data);
    return false;
  }
  return {
    user,
    command,
    remaining,
    expires: cd.expires,
    claimableAt: new Date(cd.expires),
  };
};
export const resetAllCooldowns = async user => {
  if (!cooldowns[user]) throwError(`[-] resetAllCooldowns: User ${user} not found.`);
  delete cooldowns[user];
  return {
    user,
    deleted: cooldowns[user],
  };
};
export const resetRandomCooldown = async user => {
  if (!cooldowns[user]) throwError(`[-] resetRandomCooldown: User ${user} not found.`);
  const cds = cooldowns[user];
  const keys = Object.keys(cds);
  if (keys.length === 0) return null;
  const chosen = keys[Math.floor(randomNumber(0, keys.length))];
  delete cds[chosen];
  return {
    user,
    name: chosen,
  };
};
export const doubleAllCooldowns = async user => {
  if (!cooldowns[user]) throwError(`[-] resetAllCooldowns: User ${user} not found.`);
  const now = Date.now();
  for (const cmd in cooldowns[user]) {
    const cd = cooldowns[user][cmd];
    const timeLeft = cd.expires - now;
    cd.expires = now + timeLeft * 2;
  }
  return cooldowns[user];
};

export const gambleStreak = async (user, streak) => {
  if (!(await isValidUser(user))) throwError(`[-] gambleStreak: User ${user} not found.`);
  await initUserObject(user);
  streak = Number(streak);
  if (!isInteger(streak) || streak < 0) throwError(`[-] gambleStreak: Invalid streak.`);
  const data = await loadData(user);
  data.streak.gamble = streak;
  await saveData(user, data);
  return { streak };
};
export const getGambleStreak = async user => {
  if (!(await isValidUser(user))) throwError(`[-] getGambleStreak: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  return data.streak.gamble ?? 0;
};
export const dailyStreak = async (user, streak, lastClaim) => {
  if (!(await isValidUser(user))) throwError(`[-] dailyStreak: User ${user} not found.`);
  await initUserObject(user);
  streak = Number(streak);
  if (!isInteger(streak) || streak < 0) throwError(`[-] dailyStreak: Invalid streak.`);
  const data = await loadData(user);
  if (!data.streak.daily) data.streak.daily = {};
  data.streak.daily.streak = streak;
  data.streak.daily.lastClaim = lastClaim || Date.now();
  await saveData(user, data);
  return { streak, lastClaim: data.streak.daily.lastClaim };
};
export const getDailyStreak = async user => {
  if (!(await isValidUser(user))) throwError(`[-] getDailyStreak: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  return { streak: data.streak?.daily?.streak ?? 0, lastClaim: data.streak?.daily?.lastClaim ?? 0 };
};
export const weeklyStreak = async (user, streak, lastClaim) => {
  if (!(await isValidUser(user))) throwError(`[-] weeklyStreak: User ${user} not found.`);
  await initUserObject(user);
  streak = Number(streak);
  if (!isInteger(streak) || streak < 0) throwError(`[-] weeklyStreak: Invalid streak.`);
  const data = await loadData(user);
  if (!data.streak.weekly) data.streak.weekly = {};
  data.streak.weekly.streak = streak;
  data.streak.weekly.lastClaim = lastClaim || Date.now();
  await saveData(user, data);
  return { streak, lastClaim: data.streak.weekly.lastClaim };
};
export const getWeeklyStreak = async user => {
  if (!(await isValidUser(user))) throwError(`[-] getWeeklyStreak: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  return { streak: data.streak?.weekly?.streak ?? 0, lastClaim: data.streak?.weekly?.lastClaim ?? 0 };
};

export const depositDredcoin = async (user, amount) => {
  if (!(await isValidUser(user))) throwError(`[-] depositDredcoin: User ${user} not found.`);
  if (await isMaxBank(user).isMax) throwError(`[!] depositDredcoin: ${user} already has the maximum allowed bank balance.`);
  await initUserObject(user);
  amount = Number(amount);
  if (!isInteger(amount) || amount <= 0) throwError(`[-] Invalid amount.`);
  const data = await loadData(user);
  data.balance ||= {};
  data.balance.dredcoin ??= 0;
  data.bank ||= {};
  data.bank.balance ??= 0;
  if (data.balance.dredcoin < amount) return `[-] depositDredcoin: ${user} doesn't have enough Dredcoin (needs ${amount}).`;
  const tax = await getTax(amount, user);
  const netDeposit = amount - tax;
  data.balance.dredcoin -= amount;
  data.bank.balance += netDeposit;
  await saveData(user, data);
  return {
    user,
    taxed: tax,
    deposited: netDeposit,
    walletRemaining: data.balance.dredcoin,
    bankNow: data.bank.balance,
  };
};
export const withdrawDredcoin = async (user, amount) => {
  if (!(await isValidUser(user))) throwError(`[-] withdrawDredcoin: User ${user} not found.`);
  await initUserObject(user);
  amount = Number(amount);
  if (!isInteger(amount) || amount <= 0) throwError(`[-] withdrawDredcoin: Invalid amount.`);
  const data = await loadData(user);
  data.balance ||= {};
  data.balance.dredcoin ??= 0;
  data.bank ||= {};
  data.bank.balance ??= 0;
  if (data.bank.balance < amount) return `[-] withdrawDredcoin: ${user} doesn't have enough in bank (needs ${amount}).`;
  const tax = await getTax(amount, user);
  const netWithdraw = amount - tax;
  if (await isMaxCoin(user).isMax) return `[!] withdrawDredcoin: {user} already has the maximum allowed Dredcoin.`;
  const projectedTotal = data.balance.dredcoin + netWithdraw;
  if (config.MAX_DREDCOIN !== false && projectedTotal > config.MAX_DREDCOIN) {
    const allowedAmount = config.MAX_DREDCOIN - data.balance.dredcoin;
    return `[!] withdrawDredcoin: Cannot withdraw. Limit exceeded. Max allowed: ${allowedAmount}`;
  }
  data.bank.balance -= amount;
  data.balance.dredcoin += netWithdraw;
  await saveData(user, data);
  return {
    user,
    taxed: tax,
    withdrawn: netWithdraw,
    bankRemaining: data.bank.balance,
    walletNow: data.balance.dredcoin,
  };
};
export const transferDredcoin = async (userA, userB, amount) => {
  if (!(await isValidUser(userA))) throwError(`[-] transferDredcoin: Sender '${userA}' not found.`);
  if (!(await isValidUser(userB))) throwError(`[-] transferDredcoin: Receiver '${userB}' not found.`);
  await initUserObject(user);
  amount = Number(amount);
  if (!isInteger(amount) || amount <= 0) throwError(`[-] transferDredcoin: Invalid amount '${amount}'.`);
  const dataA = await loadData(userA);
  const dataB = await loadData(userB);
  dataA.balance ||= {};
  dataA.balance.dredcoin ??= 0;
  dataB.balance ||= {};
  dataB.balance.dredcoin ??= 0;
  if (dataA.balance.dredcoin < amount) return `[-] transferDredcoin: '${userA}' doesn't have enough Dredcoin (needs ${amount}, has ${dataA.balance.dredcoin}).`;
  const tax = await getTax(amount, userA);
  const afterTax = amount - tax;
  const { isMax } = await isMaxCoin(userB);
  if (isMax) return `[!] transferDredcoin: '${userB}' already has the maximum allowed Dredcoin.`;
  const projected = dataB.balance.dredcoin + afterTax;
  if (config.MAX_TRANSFER !== false && projected > config.MAX_TRANSFER) {
    const allowed = config.MAX_TRANSFER - dataB.balance.dredcoin;
    return `[!] transferDredcoin: '${userB}' can only receive ${allowed} more Dredcoin (MAX_TRANSFER).`;
  }
  if (config.MAX_DREDCOIN !== false && projected > config.MAX_DREDCOIN) {
    const allowed = config.MAX_DREDCOIN - dataB.balance.dredcoin;
    return `[!] transferDredcoin: '${userB}' can only receive ${allowed} more Dredcoin (MAX_DREDCOIN).`;
  }
  dataA.balance.dredcoin -= amount;
  dataB.balance.dredcoin += afterTax;
  await saveData(userA, dataA);
  await saveData(userB, dataB);
  return {
    from: userA,
    to: userB,
    sent: amount,
    taxed: tax,
    received: afterTax,
    senderRemaining: dataA.balance.dredcoin,
    receiverTotal: dataB.balance.dredcoin,
  };
};

export const searchItemByIdOrName = (inventory, query) => {
  const q = query.toLowerCase();
  const stack = [[inventory, []]];
  while (stack.length) {
    const [node, path] = stack.pop();
    for (const key in node) {
      const value = node[key];
      if (typeof value === 'object' && value !== null) {
        const idMatch = (typeof value.id === 'string' && value.id.toLowerCase() === q) || (typeof value.id === 'number' && value.id.toString() === q);
        const nameMatch = typeof value.name === 'string' && value.name.toLowerCase() === q;
        if (idMatch || nameMatch) return { item: value, pathArray: [...path, key] };
        else stack.push([value, [...path, key]]);
      }
    }
  }
  return { item: null };
};
export const isItemExistByIdOrName = query => {
  if (!query) return false;
  const q = query.toString().toLowerCase();
  for (const def of Object.values(items)) {
    if (!def) continue;
    const idMatch = (typeof def.id === 'string' && def.id.toLowerCase() === q) || (typeof def.id === 'number' && def.id.toString() === q);
    const nameMatch = typeof def.name === 'string' && def.name.toLowerCase() === q;
    if (idMatch || nameMatch) return true;
  }
  return false;
};
export const getItemDefByIdOrName = async query => {
  if (query == null) return null;
  const q = query.toString().toLowerCase();
  for (const def of Object.values(items)) {
    if (!def) continue;
    const idMatch = (typeof def.id === 'number' && def.id.toString() === q) || (typeof def.id === 'string' && def.id.toLowerCase() === q);
    const nameMatch = typeof def.name === 'string' && def.name.toLowerCase() === q;
    if (idMatch || nameMatch) return def;
  }
  return null;
};
export const resolveItem = (inventory, itemPathOrObj) => {
  if (typeof itemPathOrObj === 'object') return { item: itemPathOrObj };
  const pathArray = itemPathOrObj.split('.');
  let current = inventory;
  for (const key of pathArray) {
    if (!current[key]) return searchItemByIdOrName(inventory, itemPathOrObj);
    current = current[key];
  }
  return { item: current, pathArray };
};
export const resolveContainer = (inventory, pathArray) => {
  let current = inventory;
  for (let i = 0; i < pathArray.length - 1; i++) {
    if (!current[pathArray[i]]) current[pathArray[i]] = {};
    current = current[pathArray[i]];
  }
  return { container: current, key: pathArray[pathArray.length - 1] };
};
export const giveItem = async (user, itemPath, count = 1) => {
  if (!(await isValidUser(user))) throwError(`[-] giveItem: User ${user} not found.`);
  if (typeof itemPath !== 'string') throwError('[-] giveItem: Item path must be a string.');
  await initUserObject(user);
  const skillBonuses = await applySkillBoosts(user);
  const bonusChance = Math.min(skillBonuses?.bonusItemChance || 0, 1);
  let bonusCount = 0;
  for (let i = 0; i < count; i++) {
    if (randomNumber() < bonusChance) bonusCount++;
  }
  const finalCount = count + bonusCount;
  const data = await loadData(user);
  const inventory = (data.inventory ||= {});
  const pathArray = itemPath.split('.');
  const { container, key } = resolveContainer(inventory, pathArray);
  let meta = items[itemPath] || items[`${pathArray[0]}.${key}`];
  if (!meta) {
    const match = Object.entries(items).find(([k, v]) => v.id?.toLowerCase() === key.toLowerCase() || v.name?.toLowerCase() === key.toLowerCase());
    if (match) meta = match[1];
  }
  if (!meta) throwError(`[-] giveItem: Metadata for item '${itemPath}' not found.`);
  const stackable = !!meta?.defaultEnchants;
  if (!container[key] || stackable) {
    const uniqueKey = stackable ? `${key}_${Date.now()}_${Math.floor(randomNumber(0, 1000))}` : key;
    container[uniqueKey] = {
      id: key,
      count: finalCount,
    };
    for (const prop of ['name', 'description', 'rarity', 'icon', 'type', 'obtainable', 'id', 'value']) {
      if (meta[prop] !== undefined) container[uniqueKey][prop] = meta[prop];
    }
    if (meta.defaultEnchants) {
      container[uniqueKey].enchants = { ...meta.defaultEnchants };
      const enchantNames = Object.values(meta.defaultEnchants)
        .map(e => e.name)
        .join(', ');
      container[uniqueKey].name = `${meta.name} ${enchantNames}`;
    }
  } else {
    if (typeof container[key].count !== 'number') container[key].count = 0;
    container[key].count += finalCount;
    for (const prop of ['name', 'description', 'rarity', 'icon', 'type', 'obtainable', 'id', 'value']) {
      if (meta[prop] !== undefined) container[key][prop] = meta[prop];
    }
  }
  await saveData(user, data);
  return {
    user,
    item: itemPath,
    baseCount: count,
    bonusCount,
    totalGiven: finalCount,
    data: container[key],
    bonusChance,
  };
};
export const removeItem = async (user, itemPath, count = 1, removeIfZero = true) => {
  if (!(await isValidUser(user))) throwError(`[-] removeItem: User '${user}' not found.`);
  if (typeof itemPath !== 'string') throwError(`[-] removeItem: Item path must be a string.`);
  if (count <= 0) throwError(`[-] removeItem: Count must be positive.`);
  await initUserObject(user);
  const data = await loadData(user);
  const inventory = (data.inventory ||= {});
  const pathArray = itemPath.split('.');
  const { container, key } = resolveContainer(inventory, pathArray);
  const target = container[key];
  if (!target || typeof target.count !== 'number' || target.count < count) return false;
  target.count -= count;
  if (removeIfZero && target.count <= 0) delete container[key];
  await saveData(user, data);
  return {
    user,
    item: itemPath,
    count,
    removed: removeIfZero,
  };
};
export const consumeItem = async (user, item, count = 1, options = {}) => {
  if (!(await isValidUser(user))) throwError(`[-] consumeItem: User ${user} not found.`);
  if (!item.consumable) throwError(`[-] consumeItem: Item ${item.id || 'unknown'} is not consumable.`);
  if (typeof item.count !== 'number') throwError('[-] consumeItem: Invalid item count.');
  await initUserObject(user);
  const preserveAble = item.type === 'consumable' && options.preserveable !== false;
  const boost = await listSkillBoost(user, 'consumableDuplicateChance');
  const preserveChance = boost.total || 0;
  const isPreserved = randomNumber() < preserveChance && preserveAble;
  const consumed = isPreserved ? count - 1 : count;
  item.count -= consumed;
  if (item.count <= 0 && options.removeIfEmpty !== false && options.pathArray) {
    const { container, key } = resolveContainer(options.inventory, options.pathArray);
    delete container[key];
    if (typeof options.onDeplete === 'function') await options.onDeplete(user, item.id);
  }
  return { consumed, isPreserved };
};
export const useItem = async (user, itemPathOrObj, count = 1, options = {}, message) => {
  if (!(await isValidUser(user))) throwError(`[-] useItem: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const inventory = data?.inventory;
  if (!inventory) throwError(`[-] useItem: User ${user} has no inventory`);
  const { item, pathArray } = resolveItem(inventory, itemPathOrObj);
  if (!item) return `[-] useItem: ${user} Item not found: ${itemPathOrObj}`;
  const availableCount = typeof item.count === 'number' ? item.count : 1;
  if (availableCount < count) return `[-] useItem: ${user} Not enough items. Available: ${availableCount}, required: ${count}`;
  if (!item.id || !item.name || !item.description || !item.rarity || !item.icon || !item.type) throwError(`[-] useItem: ${user} Item missing required fields: ${item.id}`);
  let itemLogic = items[item.id];
  if (!itemLogic) {
    const fallbackKey = Object.keys(items).find(k => k.toLowerCase() === item.id.toLowerCase() || k.toLowerCase().endsWith(`.${item.id.toLowerCase()}`));
    if (fallbackKey) itemLogic = items[fallbackKey];
  }
  if (!itemLogic?.execute) throwError(`[-] useItem: No logic found for item ${item.id}`);
  const dep = await resolveDependencies(itemLogic.dependencies, message);
  if (Array.isArray(item.enchants)) {
    for (const e of item.enchants) {
      const base = enchants[e.id];
      if (!base?.levelFactory) continue;
      const enchant = base.levelFactory(e.level || 1);
      if (typeof enchant.execute === 'function') await enchant.execute(user, item, enchant, dep);
    }
  }
  if (item.consumable) {
    await consumeItem(user, item, count, {
      ...options,
      inventory,
      pathArray,
    });
  }
  if (typeof item.durability === 'number') {
    item.durability--;
    if (item.durability <= 0 && options.removeIfBroken !== false && pathArray) {
      const { container, key } = resolveContainer(inventory, pathArray);
      delete container[key];
      if (typeof options.onBreak === 'function') await options.onBreak(user, item.id);
    }
  }
  if (!data.stat) data.stat = {};
  data.stat.lastItemUsed = new Date();
  await saveData(user, data);
  const result = await itemLogic.execute(user, itemLogic, dep, count);
  return options.returnValue ? result : undefined;
};
export const hasItem = async (user, itemPathOrObj, minCount = 1) => {
  if (!(await isValidUser(user))) throwError(`[-] hasItem: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const inventory = data?.inventory;
  if (!inventory) return false;
  const { item } = resolveItem(inventory, itemPathOrObj);
  if (!item || typeof item.count !== 'number') return false;
  return item.count >= minCount;
};
export const equipItem = async (user, itemPath) => {
  if (!(await isValidUser(user))) throwError('[-] equipItem: User not found.');
  if (typeof itemPath !== 'string') throwError('[-] equipItem: Item path must be a string.');
  await initUserObject(user);
  const data = await loadData(user);
  const inventory = data?.inventory;
  if (!inventory) throwError('[-] equipItem: User has no inventory.');
  const { item } = resolveItem(inventory, itemPath);
  if (!item) return `[-] equipItem: Item '${itemPath}' not found.`;
  if (!item.count || item.count < 1) return `[-] equipItem: You have no '${itemPath}' to equip.`;
  const meta = items[item.id];
  if (!meta || (!meta.type && !meta.equipSlot)) throwError("[-] equipItem: Item can't be equipped (missing type).");
  const slot = meta.equipSlot || meta.type;
  if (!slot) throwError('[-] equipItem: No valid equipment slot.');
  const equipment = (data.equipment ||= {});
  const old = equipment[slot];
  equipment[slot] = { id: item.id, name: item.name, icon: item.icon };
  await saveData(user, data);
  return {
    success: true,
    user,
    equipped: equipment[slot],
    slot,
    replaced: old || null,
  };
};
export const listItems = async (user, options = {}) => {
  if (!(await isValidUser(user))) throwError(`[-] listItems: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const inventory = data?.inventory;
  if (!inventory) return [];
  const result = [];
  const walk = (obj, path = []) => {
    for (const key in obj) {
      const val = obj[key];
      if (val && typeof val === 'object' && 'id' in val && 'count' in val) {
        const fullPath = path.concat(key);
        if (options.filter && !options.filter(val, fullPath)) continue;
        const item = { ...val, path: fullPath.join('.') };
        if (options.Metadata && typeof items === 'object' && val.id in items) item.meta = items[val.id];
        result.push(item);
      } else if (val && typeof val === 'object') walk(val, path.concat(key));
    }
  };
  walk(inventory);
  return result;
};
const item = () => {
  return items;
};
export const repairAllItemObject = async user => {
  if (!(await isValidUser(user))) throwError(`[-] repairAllItemObject: Invalid user: ${user}`);
  await initUserObject(user);
  const data = await loadData(user);
  const inventory = data?.inventory;
  if (!inventory) throwError(`[-] repairAllItemObject: No inventory found for user ${user}`);
  const repairedDetails = [];
  const walk = (obj, path = []) => {
    for (const key in obj) {
      const val = obj[key];
      const currentPath = path.concat(key);
      if (val && typeof val === 'object') {
        if ('id' in val && 'count' in val) {
          let meta = items[val.id];
          if (!meta) {
            const fallbackKey = Object.keys(items).find(k => k.toLowerCase() === val.id.toLowerCase() || k.toLowerCase().endsWith(`.${val.id.toLowerCase()}`));
            if (fallbackKey) meta = items[fallbackKey];
          }
          if (meta) {
            const fixed = [];

            for (const prop of ['name', 'description', 'rarity', 'icon', 'type', 'obtainable', 'id', 'value']) {
              if (meta[prop] !== undefined && val[prop] !== meta[prop]) {
                val[prop] = meta[prop];
                fixed.push(prop);
              }
            }

            if (val.quality === undefined && meta.type === 'tool') {
              val.quality = 100;
              fixed.push('quality');
            }

            for (const prop of ['maxEnchantSlot', 'maxEnchantTime']) {
              if (meta[prop] !== undefined && val[prop] !== meta[prop]) {
                val[prop] = meta[prop];
                fixed.push(prop);
              }
            }

            const hasEnchant = Array.isArray(val.enchants) && val.enchants.length > 0;
            if (!hasEnchant) {
              for (const key of ['enchants', 'enchantedTime', 'effects', 'enchantCount']) {
                if (key in val) {
                  delete val[key];
                  fixed.push(`removed:${key}`);
                }
              }
            }

            if (fixed.length > 0) {
              repairedDetails.push({
                path: currentPath.join('.'),
                id: val.id,
                fixed,
              });
            }
          }
        } else walk(val, currentPath);
      }
    }
  };
  walk(inventory);
  await saveData(user, data);
  return {
    user,
    repairedCount: repairedDetails.length,
    details: repairedDetails,
  };
};
export const getRandomItemByChance = async (user, category, range = [1, 1], options = {}) => {
  const { Metadata = false, all = false } = options;
  const baseTable = config.ITEM_RARITY_CHANCE[category] || config.ITEM_RARITY_CHANCE.default;
  const luck = await getLuck(user, category);
  const rarityTable = {};
  for (const [rarity, chance] of Object.entries(baseTable)) {
    rarityTable[rarity] = chance * luck.multiplier;
  }
  const results = [];
  if (all) {
    for (const [rarity, chance] of Object.entries(rarityTable)) {
      if (randomNumber(0, 100) <= chance) {
        const pool = Object.entries(items).filter(([id, meta]) => (category === 'all' || id.startsWith(`${category}.`)) && meta.rarity === rarity && meta.obtainable !== false);
        if (pool.length === 0) continue;
        const [min, max] = range;
        const count = Math.min(pool.length, Math.floor(randomNumber(0, max - min + 1)) + min);
        const selected = pool.sort(() => 0.5 - randomNumber()).slice(0, count);
        results.push(...selected.map(([id, meta]) => (Metadata ? meta : id)));
      }
    }
    return results;
  }
  const totalWeight = Object.values(rarityTable).reduce((a, b) => a + b, 0);
  const roll = randomNumber(0, totalWeight);
  let cumulative = 0;
  let Rarity = null;
  for (const [rarity, weight] of Object.entries(rarityTable)) {
    cumulative += weight;
    if (roll < cumulative) {
      Rarity = rarity;
      break;
    }
  }
  if (!Rarity) return [];
  const pool = Object.entries(items).filter(([id, meta]) => (category === 'all' || id.startsWith(`${category}.`)) && meta.rarity === Rarity && meta.obtainable !== false);
  if (pool.length === 0) return [];
  const [min, max] = range;
  const count = Math.min(pool.length, Math.floor(randomNumber(0, max - min + 1)) + min);
  const selected = pool.sort(() => 0.5 - randomNumber()).slice(0, count);
  return selected.map(([id, meta]) => (Metadata ? meta : id));
};
export const getRandomItem = async (user, category, range = [1, 1], options = {}) => {
  const { Metadata = false, includeAmount = false, filter = () => true } = options;
  const luck = await getLuck(user, category);
  const categoryItems = Object.entries(items).filter(([id, meta]) => (category === 'all' || id.startsWith(`${category}.`)) && filter(meta) && meta.obtainable !== false);
  if (categoryItems.length === 0) return [];
  const [min, max] = range;
  const count = Math.min(categoryItems.length, Math.floor(randomNumber(0, max - min + 1)) + min);
  const shuffled = categoryItems.sort(() => 0.5 - randomNumber()).slice(0, count);
  return shuffled.map(([id, meta]) => {
    const amount = includeAmount ? Math.ceil(randomNumber(0, 3 + 1) * luck.multiplier) : 1;
    if (Metadata && includeAmount) return { ...meta, id, amount };
    if (Metadata) return meta;
    if (includeAmount) return { id, amount };
    return id;
  });
};
export const getItemsByRarity = (category, rarity, options = {}) => {
  const { returnMetadata = false, filter = () => true } = options;
  const pool = Object.entries(items).filter(([id, meta]) => (category === 'all' || id.startsWith(`${category}.`)) && meta.rarity === rarity && filter(meta) && meta.obtainable !== false);
  return returnMetadata ? pool.map(([_, meta]) => meta) : pool.map(([id]) => id);
};
export const reduceDurability = async (user, itemPath, amount = 1, removeIfBroken = true) => {
  if (!(await isValidUser(user))) throwError(`[-] reduceDurability: User ${user} not found.`);
  if (typeof itemPath !== 'string') throwError(`[-] reduceDurability: itemPath must be a string.`);
  if (amount <= 0) throwError(`[-] reduceDurability: Amount can't be negative.`);
  await initUserObject(user);
  const data = await loadData(user);
  const isEquip = itemPath.startsWith('equipment.');
  const root = isEquip ? (data.equipment ||= {}) : (data.inventory ||= {});
  const pathArray = itemPath
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  const { container, key } = resolveContainer(root, pathArray);
  const item = container?.[key];
  if (!item || typeof item.durability !== 'number') return false;
  item.durability -= amount;
  if (item.durability <= 0) {
    if (removeIfBroken) delete container[key];
    else item.durability = 0;
  }
  await saveData(user, data);
  return {
    user,
    itemPath,
    newDurability: item.durability,
    broken: item.durability <= 0,
  };
};

export const enchantItem = async (user, itemPath, enchantId, level = 1) => {
  if (!(await isValidUser(user))) throwError(`[-] enchantItem: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const inv = (data.inventory ||= {});
  const { item, pathArray } = resolveItem(inv, itemPath);
  if (!item) return `[-] enchantItem: Item not found at '${itemPath}'.`;
  if (!enchantId || typeof enchantId !== 'string' || !enchants[enchantId]) throwError(`[-] enchantItem: Enchant ID '${enchantId}' is invalid or not registered.`);
  const base = enchants[enchantId];
  if (typeof base.levelFactory !== 'function') throwError(`[-] enchantItem: Enchant '${enchantId}' is missing levelFactory.`);
  const maxSlot = item.maxEnchantSlot ?? 1;
  const willReplace = item.enchants?.length >= maxSlot;
  const cost = config.ENCHANT_COST(user, item, enchantId);
  if (cost.dredcoin) {
    const coins = await getDredcoin(user);
    if (coins < cost.dredcoin) return `[-] enchantItem: Not enough Dredcoin (${coins}/${cost.dredcoin}) to enchant '${itemPath}'.`;
    await removeDredcoin(user, cost.dredcoin);
  }
  if (cost.item) await removeItem(user, cost.item, cost.count || 1);
  const timestamp = Date.now();
  const newEnchant = { id: enchantId, level };
  const { container, key: originalKey } = resolveContainer(inv, pathArray);
  if (item.count > 1) {
    item.count -= 1;
    const shortUuid = crypto.randomUUID().replace(/\D/g, '').slice(0, 4);
    const suffix = `${level}_${enchantId.split('.').pop()}.${timestamp}-${shortUuid}`;
    const newKey = `${originalKey}_e_${suffix}`;
    const newItem = {
      ...structuredClone(item),
      count: 1,
      enchants: willReplace ? [newEnchant] : (item.enchants || []).concat(newEnchant),
      effects: {},
      enchantedTime: timestamp,
      enchantCount: (item.enchantCount || 0) + 1,
    };
    container[newKey] = newItem;
    await saveData(user, data);
    return {
      success: true,
      user,
      split: true,
      replaced: willReplace,
      enchantId,
      level,
      newItem,
      key: newKey,
    };
  } else {
    item.enchants ||= [];
    if (willReplace) item.enchants = [newEnchant];
    else item.enchants.push(newEnchant);
    item.effects = {};
    item.enchantedTime = timestamp;
    item.enchantCount = (item.enchantCount || 0) + 1;
    await saveData(user, data);
    return {
      success: true,
      user,
      replaced: willReplace,
      enchantId,
      level,
      updated: true,
      key: originalKey,
    };
  }
};
export const hasEnchant = async (user, itemPath, enchantId, level = null) => {
  if (!(await isValidUser(user))) throwError(`[-] hasEnchant: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const inv = (data.inventory ||= {});
  const { item } = resolveItem(inv, itemPath);
  if (!item || !Array.isArray(item.enchants)) return false;
  return item.enchants.some(e => e.id === enchantId && (level === null || e.level === level));
};
export const getRandomEnchant = async (rarity = 'common') => {
  const pool = Object.entries(enchants).filter(([_, e]) => e.rarity === rarity && e.obtainable !== false);
  if (!pool.length) return null;
  const [id, base] = pool[Math.floor(randomNumber(0, pool.length))];
  const level = Math.floor(randomNumber(0, (base.maxLevel || 1) + 1));
  return { id, level };
};
export const getRandomEnchantByChance = async () => {
  const table = config.ENCHANT_RARITY_CHANCE;
  const total = Object.values(table).reduce((a, b) => a + b, 0);
  const roll = randomNumber(0, total);
  let cumulative = 0;
  for (const [rarity, chance] of Object.entries(table)) {
    cumulative += chance;
    if (roll <= cumulative) return getRandomEnchant(rarity);
  }
  return null;
};
export const enchantToItem = async enchantObj => {
  if (!enchantObj?.id || !enchantObj?.name || typeof enchantObj.level !== 'number') throwError('[-] enchantToItem: Invalid enchant object: must include id, name, and level');
  const scrollId = `scrolls.${enchantObj.id.replace(/\./g, '_')}_lv${enchantObj.level}`;
  const enchantName = enchantObj.name;
  return {
    id: scrollId,
    name: `${enchantName} Scroll`,
    description: `Use on an item to apply ${enchantName} (Lv ${enchantObj.level}).`,
    type: 'consumable',
    rarity: enchantObj.rarity || 'common',
    obtainable: false,
    enchantSource: {
      id: enchantObj.id,
      level: enchantObj.level,
    },
    execute: async (user, item, deps, count = 1) => {},
  };
};
export const useEnchantScroll = async (user, scrollPath, targetItemPath) => {
  if (!(await isValidUser(user))) throwError(`[-] useEnchantScroll: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const inv = data.inventory;
  const { item: scroll } = resolveItem(inv, scrollPath);
  if (!scroll || !scroll.enchantSource) throwError('[-] useEnchantScroll: Invalid scroll, no enchant data');
  const { id: enchantId, level } = scroll.enchantSource;
  const { item: target } = resolveItem(inv, targetItemPath);
  if (!target) return '[-] useEnchantScroll: Target item not found';
  const result = await enchantItem(user, targetItemPath, enchantId, level);
  const success = await removeItem(user, scrollPath, 1);
  if (!success) return `[-] useEnchantScroll: You dont have "${scrollPath}".`;
  return {
    user,
    ...result,
    scrollUsed: scroll.id,
    to: targetItemPath,
  };
};
export const getEnchants = async (user, itemPath) => {
  if (!(await isValidUser(user))) throwError(`[-] getEnchants: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const inv = data.inventory;
  const { item, pathArray } = await resolveItem(inv, itemPath);
  if (!item || !Array.isArray(item.enchants)) return [];
  return item.enchants.map(e => {
    const meta = enchants[e.id];
    return {
      ...e,
      ...(meta
        ? {
            name: meta.name,
            rarity: meta.rarity,
            description: meta.description,
          }
        : {}),
    };
  });
};
export const resetEnchants = async (user, itemPath) => {
  if (!(await isValidUser(user))) throwError(`[-] resetEnchants: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const inv = data.inventory;
  const { item } = resolveItem(inv, itemPath);
  if (!item) return `[-] resetEnchants: Item not found at '${itemPath}'.`;
  delete item.enchants;
  delete item.enchantCount;
  delete item.lastEnchantTime;
  await saveData(user, data);
  return { success: true, reset: true, path: itemPath };
};
export const removeEnchant = async (user, itemPath, enchantIdOrIndex) => {
  if (!(await isValidUser(user))) throwError(`[-] removeEnchant: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const inv = (data.inventory ||= {});
  const { item } = resolveItem(inv, itemPath);
  if (!item?.enchants) throwError(`[-] removeEnchant: No enchants found at '${itemPath}'.`);
  if (typeof enchantIdOrIndex === 'number') {
    if (enchantIdOrIndex < 0 || enchantIdOrIndex >= item.enchants.length) return `[-] removeEnchant: Invalid enchant index ${enchantIdOrIndex}.`;
    item.enchants.splice(enchantIdOrIndex, 1);
  } else {
    const index = item.enchants.findIndex(e => e.id === enchantIdOrIndex);
    if (index === -1) return `[-] removeEnchant: Enchant '${enchantIdOrIndex}' not found.`;
    item.enchants.splice(index, 1);
  }
  await saveData(user, data);
  return { success: true, removed: enchantIdOrIndex, path: itemPath };
};

export const getRecipeByIdOrName = (table, query) => {
  if (!table || query == null) return null;
  const q = query.toString().toLowerCase();
  for (const r of Object.values(table)) {
    if (!r) continue;
    const idMatch = (typeof r.id === 'number' && r.id.toString() === q) || (typeof r.id === 'string' && r.id.toLowerCase() === q);
    const nameMatch = typeof r.name === 'string' && r.name.toLowerCase() === q;
    if (idMatch || nameMatch) return r;
  }
  return null;
};
export const resolveInputToDef = async input => {
  if (input == null) return null;
  if (typeof input === 'string' || typeof input === 'number') return await getItemDefByIdOrName(input);
  if (input.id != null) return await getItemDefByIdOrName(input.id);
  if (input.name) return await getItemDefByIdOrName(input.name);
  return null;
};
export const getCraftingStatus = async user => {
  if (!(await isValidUser(user))) throwError(`[-] getCraftingStatus: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const task = data.craftingTask;
  if (!task) return false;
  const now = Date.now();
  const end = task.start + task.duration;
  const remaining = Math.max(0, end - now);
  const complete = remaining <= 0;
  return {
    user,
    active: true,
    recipeId: task.recipeId,
    output: task.output,
    start: task.start,
    end,
    remaining,
    complete,
  };
};
export const claimCraft = async user => {
  if (!(await isValidUser(user))) throwError(`[-] claimCraft: User ${user} not found.`);
  await initUserObject(user);
  const status = await getCraftingStatus(user);
  if (!status.active) return `[-] claimCraft: No active crafting task.`;
  if (!status.complete) return `[-] claimCraft: Crafting not finished.`;
  const data = await loadData(user);
  await addItem(user, status.output);
  delete data.craftingTask;
  await saveData(user, data);
  return {
    user,
    crafted: status.output,
  };
};
export const craftItem = async (user, recipeId) => {
  if (!(await isValidUser(user))) throwError(`[-] craftItem: User ${user} not found.`);
  await initUserObject(user);
  const recipe = getRecipeByIdOrName(recipes.crafting, recipeId);
  if (!recipe) throwError(`[-] craftItem: Unknown recipe '${recipeId}'.`);
  const data = await loadData(user);
  if (data.craftingTask) return `[-] craftItem: You are already crafting something.`;
  const inv = (data.inventory ||= {});
  for (const input of recipe.inputs) {
    const def = await resolveInputToDef(input);
    if (!def) return `[-] craftItem: Unknown input '${input.name ?? input.id}'.`;
    const owned = countItem(inv, def.id);
    if (owned < input.count) return `[-] craftItem: Missing '${def.name}' (${owned}/${input.count}).`;
  }
  for (const input of recipe.inputs) {
    const def = await resolveInputToDef(input);
    if (!def) return `[-] craftItem: Unknown input '${input.name ?? input.id}'.`;
    const success = await removeItem(user, def.id, input.count);
    if (!success) return `[-] craftItem: You don't have "${def.name}" or not enough item.`;
  }
  const output = typeof recipe.output === 'function' ? recipe.output() : structuredClone(recipe.output);
  if (output.quality === undefined) output.quality = Math.floor(1 + randomNumber(0, 99));
  data.craftingTask = {
    recipeId,
    start: Date.now(),
    duration: recipe.craftTime || 0,
    output,
  };
  await saveData(user, data);
  return {
    user,
    recipeId,
    duration: recipe.craftTime || 0,
    output,
  };
};
export const getCookingStatus = async user => {
  if (!(await isValidUser(user))) throwError(`[-] getCookingStatus: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const task = data.cookingTask;
  if (!task) return false;
  const now = Date.now();
  const end = task.start + task.duration;
  const remaining = Math.max(0, end - now);
  const complete = remaining <= 0;
  return {
    user,
    active: true,
    recipeId: task.recipeId,
    output: task.output,
    start: task.start,
    end,
    remaining,
    complete,
  };
};
export const claimCook = async user => {
  if (!(await isValidUser(user))) throwError(`[-] claimCook: User ${user} not found.`);
  await initUserObject(user);
  const status = await getCookingStatus(user);
  if (!status.active) return `[-] claimCook: No active cooking task.`;
  if (!status.complete) return `[-] claimCook: Cooking not finished.`;
  const data = await loadData(user);
  await addItem(user, status.output);
  delete data.cookingTask;
  await saveData(user, data);
  return {
    user,
    cooked: status.output,
  };
};
export const cookItem = async (user, recipeId) => {
  if (!(await isValidUser(user))) throwError(`[-] cookItem: User ${user} not found.`);
  await initUserObject(user);
  const recipe = getRecipeByIdOrName(recipes.cooking, recipeId);
  if (!recipe) throwError(`[-] cookItem: Unknown recipe '${recipeId}'.`);
  const data = await loadData(user);
  if (data.cookingTask) return `[-] cookItem: You are already cooking something.`;
  const inv = (data.inventory ||= {});
  for (const input of recipe.inputs) {
    const def = await resolveInputToDef(input);
    if (!def) return `[-] craftItem: Unknown input '${input.name ?? input.id}'.`;
    const owned = countItem(inv, def.id);
    if (owned < input.count) return `[-] craftItem: Missing '${def.name}' (${owned}/${input.count}).`;
  }
  for (const input of recipe.inputs) {
    const def = await resolveInputToDef(input);
    if (!def) return `[-] craftItem: Unknown input '${input.name ?? input.id}'.`;
    const success = await removeItem(user, def.id, input.count);
    if (!success) return `[-] craftItem: You don't have "${def.name}" or not enough item.`;
  }
  const output = typeof recipe.output === 'function' ? recipe.output() : structuredClone(recipe.output);
  if (output.quality === undefined) output.quality = Math.floor(1 + randomNumber(0, 99));
  data.cookingTask = {
    recipeId,
    start: Date.now(),
    duration: recipe.cookTime || 0,
    output,
  };
  await saveData(user, data);
  return {
    user,
    recipeId,
    duration: recipe.cookTime || 0,
    output,
  };
};
export const getMeltingStatus = async user => {
  if (!(await isValidUser(user))) throwError(`[-] getMeltingStatus: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const task = data.meltingTask;
  if (!task) return false;
  const now = Date.now();
  const end = task.start + task.duration;
  const remaining = Math.max(0, end - now);
  const complete = remaining <= 0;
  return {
    user,
    active: true,
    recipeId: task.recipeId,
    output: task.output,
    start: task.start,
    end,
    remaining,
    complete,
  };
};
export const claimMelt = async user => {
  if (!(await isValidUser(user))) throwError(`[-] claimMelt: User ${user} not found.`);
  await initUserObject(user);
  const status = await getMeltingStatus(user);
  if (!status.active) return `[-] claimMelt: No active melting task.`;
  if (!status.complete) return `[-] claimMelt: Melting not finished.`;
  const data = await loadData(user);
  await addItem(user, status.output);
  delete data.meltingTask;
  await saveData(user, data);
  return {
    user,
    melted: status.output,
  };
};
export const meltItem = async (user, recipeId) => {
  if (!(await isValidUser(user))) throwError(`[-] meltItem: User ${user} not found.`);
  await initUserObject(user);
  const recipe = getRecipeByIdOrName(recipe.melting, recipeId);
  if (!recipe) throwError(`[-] meltItem: Unknown recipe '${recipeId}'.`);
  const data = await loadData(user);
  if (data.meltingTask) return `[-] meltItem: You are already melting something.`;
  const inv = (data.inventory ||= {});
  for (const input of recipe.inputs) {
    const def = await resolveInputToDef(input);
    if (!def) return `[-] craftItem: Unknown input '${input.name ?? input.id}'.`;
    const owned = countItem(inv, def.id);
    if (owned < input.count) return `[-] craftItem: Missing '${def.name}' (${owned}/${input.count}).`;
  }
  for (const input of recipe.inputs) {
    const def = await resolveInputToDef(input);
    if (!def) return `[-] craftItem: Unknown input '${input.name ?? input.id}'.`;
    const success = await removeItem(user, def.id, input.count);
    if (!success) return `[-] craftItem: You don't have "${def.name}" or not enough item.`;
  }
  const output = typeof recipe.output === 'function' ? recipe.output() : structuredClone(recipe.output);
  if (output.quality === undefined) output.quality = Math.floor(1 + randomNumber(0, 99));
  data.meltingTask = {
    recipeId,
    start: Date.now(),
    duration: recipe.meltTime || 0,
    output,
  };
  await saveData(user, data);
  return {
    user,
    recipeId,
    duration: recipe.meltTime || 0,
    output,
  };
};

export const disassembleItem = async (user, itemPath, count = 1) => {
  if (!(await isValidUser(user))) throwError(`[-] disassembleItem: User ${user} not found.`);
  if (!isInteger(count) || count < 1) throwError(`[-] disassembleItem: Invalid count '${count}'.`);
  await initUserObject(user);
  const { item } = resolveItem(userInventory, itemPath);
  if (!item) return `[-] disassembleItem: Item '${itemPath}' not found.`;
  if (item.count < count) return `[-] disassembleItem: Not enough '${item.id}' to disassemble (${item.count}/${count}).`;
  const def = items[item.id];
  if (!def?.disassemble) return `[-] disassembleItem: '${item.id}' is not disassemblable.`;
  const dep = await resolveDependencies(def.dependencies);
  const oneResult = await def.disassemble(user, item, dep);
  if (!oneResult || oneResult === false) return `[-] disassembleItem: '${item.id}' cannot be disassembled.`;
  const removed = await removeItem(user, itemPath, count);
  if (!removed) return `[-] disassembleItem: Failed to remove items from inventory.`;
  const totalResult = {};
  for (let i = 0; i < count; i++) {
    for (const mat of oneResult) {
      const roll = randomNumber;
      const chance = mat.chance ?? 1;
      if (roll > chance) continue;
      const c = mat.count;
      let amt = 1;
      if (typeof c === 'number') amt = c;
      else if (c?.min != null && c?.max != null) {
        const min = Math.max(0, c.min);
        const max = Math.max(min, c.max);
        amt = Math.floor(randomNumber(max - min + 1)) + min;
      }
      if (amt > 0) {
        const key = typeof mat.id === 'number' ? mat.id.toString() : mat.id.toLowerCase();
        totalResult[key] = (totalResult[key] || 0) + amt;
      }
    }
  }
  for (const [id, amt] of Object.entries(totalResult)) await addItem(user, id, amt);
  return {
    user,
    itemPath,
    count,
    result: Object.entries(totalResult).map(([id, count]) => ({ id, count })),
  };
};
export const disassemblePreview = async (user, item) => {
  if (!(await isValidUser(user))) throwError(`[-] disassemblePreview: User ${user} not found.`);
  if (!item || !item.id) throwError(`[-] disassemblePreview: Invalid item input.`);
  await initUserObject(user);
  const def = items[item.id];
  if (!def?.disassemble) return false;
  const dep = await resolveDependencies(def?.dependencies);
  const result = await def.disassemble(user, item, dep);
  if (!result || result === false) return false;
  const final = [];
  for (const mat of result) {
    const chance = mat.chance ?? 1;
    if (chance < 1) final.push({ user, id: mat.id, count: mat.count, chance });
    else final.push({ user, id: mat.id, count: mat.count });
  }
  return final;
};
export const reforgeItem = async (user, itemPath) => {
  if (!(await isValidUser(user))) throwError(`[-] reforgeItem: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const inv = (data.inventory ||= {});
  const { item } = resolveItem(inv, itemPath);
  if (!item) throwError(`[-] reforgeItem: Item not found at '${itemPath}'.`);
  const current = item.quality || 100;
  if (current === 100) return `[-] reforgeItem: '${itemPath}' is already 100% quality.`;
  const cost = config.REFORGE_COST?.(user, item) || { dredcoin: 10000 };
  if (cost.dredcoin) {
    const coins = await getDredcoin(user);
    if (coins < cost.dredcoin) return `[-] reforgeItem: Not enough Dredcoin (${coins}/${cost.dredcoin}) to reforge '${itemPath}'.`;
    await removeDredcoin(user, cost.dredcoin);
  }
  if (cost.item) {
    const success = await removeItem(user, cost.item, cost.count || 1);
    if (!success) return `[-] reforgeItem: You don't have "${cost.item}" or not enough item.`;
  }
  const oldQuality = item.quality || 100;
  item.quality = Math.floor(1 + randomNumber(0, 99));
  await saveData(user, data);
  return {
    user,
    oldQuality,
    newQuality: item.quality,
    itemPath,
  };
};
export const formatItemQuality = (quality, options = {}) => {
  if (typeof quality !== 'number' || isNaN(quality)) return 'Unknown';
  const { bold, emoji = true, tier = true, discordFormat = false } = options;
  const q = quality.toFixed(1);
  const tiers = [
    { min: 95, label: 'Perfect', icon: '💎', discord: '<::>' },
    { min: 85, label: 'Excellent', icon: '🔷', discord: '<::>' },
    { min: 70, label: 'Good', icon: '🔵', discord: '<::>' },
    { min: 50, label: 'Fair', icon: '🟢', discord: '<::>' },
    { min: 25, label: 'Worn', icon: '🟠', discord: '<::>' },
    { min: 0, label: 'Broken', icon: '🔴', discord: '<::>' },
  ];
  const matched = tiers.find(t => quality >= t.min);
  if (!matched) return 'Unknown';
  const name = bold ? `**${matched.label}**` : matched.label;
  const icon = discordFormat ? matched.discord : matched.icon;
  const label = [emoji ? icon : null, tier ? name : null].filter(Boolean).join(' ');
  return `${label} (${q}%)`;
};

export const createTrade = async (fromUser, toUser, toUserConfirmed = null) => {
  if (!(await isValidUser(fromUser))) throwError(`[-] createTrade: User ${fromUser} not found.`);
  if (!(await isValidUser(toUser))) throwError(`[-] createTrade: User ${toUser} not found.`);
  if (fromUser === toUser) return errorMsg("createTrade", "You cannot trade with yourself");
  await initUserObject(fromUser);
  await initUserObject(toUser);
  const fromData = await loadData(fromUser);
  const toData = await loadData(toUser);
  if (fromData.trade?._active) return errorMsg("createTrade", "You already have an active trade");
  if (toData.trade?._active) return errorMsg("createTrade", `${toUser} already has an active trade`);
  fromData.trade = {
    _active: true,
    partner: toUser,
    confirmed: null
  };
  toData.trade = {
    _active: true,
    partner: fromUser,
    confirmed: toUserConfirmed
  };
  await saveData(fromUser, fromData);
  await saveData(toUser, toData);
  let status = "pending";
  if (toUserConfirmed === true) status = "accepted";
  if (toUserConfirmed === false) status = "declined";
  return successMsg("createTrade", `Trade ${status} between ${fromUser} and ${toUser}`, 0o0, {
    fromUser,
    toUser,
    status
  });
};

export const filterRarity = async (list, maxRarity, category) => {
  if (list == null) throwError(`[-] filterRarity: 'list' is required.`);
  if (typeof maxRarity !== 'string') throwError(`[-] filterRarity: 'maxRarity' must be a string.`);
  if (!config?.RARITIES || !Array.isArray(config.RARITIES)) throwError(`[-] filterRarity: config.RARITIES missing or invalid.`);
  const pool = Array.isArray(list) ? list : typeof list === 'object' ? Object.values(list) : null;
  if (!pool) throwError(`[-] filterRarity: 'list' must be an array or object.`);
  const maxIndex = config.RARITIES.indexOf(maxRarity.toLowerCase());
  if (maxIndex === -1) return `[-] filterRarity: Invalid maxRarity '${maxRarity}'. Valid: ${config.RARITIES.join(', ')}`;
  if (category !== undefined && category !== null && typeof category !== 'string') throwError(`[-] filterRarity: 'category' must be a string if provided.`);
  const cat = category ? category.toLowerCase() : null;
  if (cat && cat !== 'event' && cat !== 'normal') return `[-] filterRarity: Invalid category '${category}', expected 'event' or 'normal'.`;
  const result = [];
  for (const e of pool) {
    if (!e || typeof e !== 'object') continue;
    if ('rarity' in e && e.rarity != null && typeof e.rarity !== 'string') throwError(`[-] filterRarity: item has invalid 'rarity' type.`);
    if (!e.rarity || typeof e.rarity !== 'string') continue;
    const rIndex = config.RARITIES.indexOf(e.rarity.toLowerCase());
    if (rIndex === -1) continue;
    if (rIndex > maxIndex) continue;
    if (cat) {
      if (cat === 'event' && !['event', 'limited'].includes(e.rarity.toLowerCase())) continue;
      if (cat === 'normal' && ['event', 'limited'].includes(e.rarity.toLowerCase())) continue;
    }
    result.push(e);
  }
  if (!result.length) return `[-] filterRarity: No matching entries found for maxRarity='${maxRarity}' category='${category || 'any'}'.`;
  return result;
};
export const pickRandomByRarity = async (list, maxRarity, category) => {
  if (list == null) throwError(`[-] pickRandomByRarity: 'list' is required.`);
  if (typeof maxRarity !== 'string') throwError(`[-] pickRandomByRarity: 'maxRarity' must be a string.`);
  const filtered = await filterRarity(list, maxRarity, category);
  if (typeof filtered === 'string' && filtered.startsWith('[-]')) return `[-] pickRandomByRarity: ${filtered}`;
  if (!Array.isArray(filtered)) throwError(`[-] pickRandomByRarity: Unexpected result from filterRarity, got ${typeof filtered}.`);
  const i = Math.floor(Math.random() * filtered.length);
  return filtered[i];
};

export const startHatchEgg = async (user, eggPath) => {
  if (!(await isValidUser(user))) throwError(`[-] startHatchEgg: User ${user} not found.`);
  await initUserObject(user);
  if (!eggPath || typeof eggPath !== 'string') throwError(`[-] startHatchEgg: 'eggPath' must be a string.`);
  const data = await loadData(user);
  data.hatching ||= {};
  if (data.hatching.active) return `[-] startHatchEgg: user already has an egg hatching.`;
  const { item: egg, pathArray } = resolveItem(data.inventory, eggPath);
  if (!egg) return `[-] startHatchEgg: egg '${eggPath}' not found in inventory.`;
  if (!egg.rarity) throwError(`[-] startHatchEgg: egg missing rarity field.`);
  if (!egg.hatchTime || typeof egg.hatchTime !== 'number') throwError(`[-] startHatchEgg: egg missing hatchTime field.`);
  if (!egg.hatchable) return `[-] startHatchEgg: not a egg or not hatchable.`;
  const removed = await removeItem(user, eggPath, 1);
  if (!removed) throwError(`[-] startHatchEgg: failed to remove egg from inventory.`);
  const start = Date.now();
  const end = start + egg.hatchTime;
  data.hatching = { active: true, egg, start, end };
  await saveData(user, data);
  return {
    success: true,
    user,
    egg,
    start,
    end,
    remaining: egg.hatchTime,
  };
};
export const hatchEgg = async user => {
  if (!(await isValidUser(user))) throwError(`[-] hatchEgg: User ${user} not found.`);
  await initUserObject(user);
  if (!Array.isArray(pets)) return `[-] hatchEgg: 'pets' must be an array.`;
  if (!config?.RARITIES || !Array.isArray(config.RARITIES)) throwError(`[-] hatchEgg: config.RARITIES missing or invalid.`);
  const data = await loadData(user);
  const hatch = data.hatching;
  if (!hatch?.active) return `[-] hatchEgg: no egg is currently hatching.`;
  if (Date.now() < hatch.end) return `[-] hatchEgg: egg is still hatching, wait until ${hatch.end}.`;
  let hatchedPets = [];
  if (hatch.egg.hatchPets && typeof hatch.egg.hatchPets === 'object') {
    const total = Object.keys(hatch.egg.hatchPets).reduce((a, k) => a + Number(k), 0);
    if (total !== 100) return `[-] hatchEgg: hatchPets percentages must total 100.`;
    const roll = randomNumber(0, 100);
    let sum = 0;
    for (const [percent, petIds] of Object.entries(hatch.egg.hatchPets)) {
      sum += Number(percent);
      if (roll <= sum) {
        const ids = Array.isArray(petIds) ? petIds : [petIds];
        for (const id of ids) {
          const found = pets.find(p => p.id === id);
          if (!found) throwError(`[-] hatchEgg: pet with id '${id}' not found in pets list.`);
          hatchedPets.push(found);
        }
        break;
      }
    }
  } else {
    const rarity = hatch.egg.rarity.toLowerCase();
    const category = ['event', 'limited'].includes(rarity) ? 'event' : 'normal';
    const picked = await pickRandomByRarity(pets, rarity, category);
    if (typeof picked === 'string') return picked;
    hatchedPets = [picked];
  }
  data.hatching = { active: false };
  await saveData(user, data);
  return {
    success: true,
    user,
    egg: hatch.egg,
    hatchedAt: Date.now(),
    pets: hatchedPets,
  };
};
// REMOVE the current active egg
export const cancelHatchEgg = async user => {
  if (!(await isValidUser(user))) throwError(`[-] cancelHatchEgg: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  if (!data.hatching?.active) return `[-] cancelHatchEgg: no active hatch to cancel.`;
  const cancelledEgg = data.hatching.egg;
  data.hatching = { active: false };
  await saveData(user, data);
  return {
    success: true,
    user,
    cancelledEgg,
    cancelledAt: Date.now(),
  };
};
// REFUND the current active egg
export const refundEggOnCancel = async user => {
  if (!(await isValidUser(user))) throwError(`[-] refundEggOnCancel: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  if (!data.hatching?.active) return `[-] refundEggOnCancel: no active hatch to cancel.`;
  const egg = data.hatching.egg;
  if (!egg?.id) throwError(`[-] refundEggOnCancel: egg data invalid, cannot refund.`);
  await giveItem(user, egg.id, 1);
  data.hatching = { active: false };
  await saveData(user, data);
  return {
    success: true,
    user,
    refundedEgg: egg,
    refundedAt: Date.now(),
  };
};
export const checkHatchStatus = async user => {
  if (!(await isValidUser(user))) throwError(`[-] checkHatchStatus: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const hatch = data.hatching;
  if (!hatch?.active) return `[-] checkHatchStatus: no egg hatching.`;
  return {
    success: true,
    user,
    egg: hatch.egg,
    start: hatch.start,
    end: hatch.end,
    remaining: Math.max(0, hatch.end - Date.now()),
  };
};
export const listUserEggs = async user => {
  if (!(await isValidUser(user))) throwError(`[-] checkHatchStatus: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const inventory = data?.inventory;
  const eggs = [];
  const walk = (obj, path = []) => {
    for (const key in obj) {
      const val = obj[key];
      if (val && typeof val === 'object' && 'id' in val && 'count' in val) {
        if (val.type === 'egg') eggs.push({ ...val, path: path.concat(key).join('.') });
      } else if (val && typeof val === 'object') walk(val, path.concat(key));
    }
  };
  walk(inventory);
  return {
    success: true,
    user,
    total: eggs.length,
    eggs,
  };
};

export const listItemForSale = async (user, itemPath, price) => {
  if (!(await isValidUser(user))) throwError(`[-] listItemForSale: User ${user} not found.`);
  if (!isInteger(price) || price <= 0 || price > Number.MAX_SAFE_INTEGER) throwError(`[-] listItemForSale: Invalid price '${price}'.`);
  await initUserObject(user);
  const data = await loadData(user);
  const inv = (data.inventory ||= {});
  const { item } = resolveItem(inv, itemPath);
  if (!item) return `[-] listItemForSale: Item '${itemPath}' not found.`;
  if (item.count < 1) return `[-] listItemForSale: No item count left at '${itemPath}'.`;
  const success = await removeItem(user, itemPath, 1);
  if (!success) return `[-] listItemForSale: You don't have "${itemPath}" or not enough item.`;
  const id = crypto.randomUUID();
  const timestamp = Date.now();
  const frozenItem = {
    id: item.id,
    name: item.name,
    count: 1,
    rarity: item.rarity,
    type: item.type,
    ...(item.metadata ? { metadata: structuredClone(item.metadata) } : {}),
  };
  await saveListing({ id, seller: user.toLowerCase(), item: frozenItem, price, timestamp });
  return { id, seller: user.toLowerCase(), price, timestamp };
};
export const buyListing = async (buyer, listingId) => {
  if (!(await isValidUser(buyer))) throwError(`[-] buyListing: Invalid buyer '${buyer}'.`);
  await initUserObject(buyer);
  const listing = getListingById(listingId);
  if (!listing) return `[-] buyListing: Listing '${listingId}' not found.`;
  if (buyer.toLowerCase() === listing.seller.toLowerCase()) return `[-] buyListing: You cannot buy your own listing.`;
  const balance = await getDredcoin(buyer);
  if (balance < listing.price) return `[-] buyListing: Not enough Dredcoin (${balance}/${listing.price}).`;
  await removeDredcoin(buyer, listing.price);
  await addItem(buyer, listing.item.id, 1, listing.item);
  if (await isValidUser(listing.seller)) await addDredcoin(listing.seller, listing.price);
  await deleteListing(listingId);
  return { buyer, seller: listing.seller, item: listing.item, price: listing.price };
};
export const cancelListing = async (user, listingId) => {
  if (!(await isValidUser(user))) throwError(`[-] cancelListing: Invalid user '${user}'.`);
  await initUserObject(user);
  const listing = getListing(listingId);
  if (!listing) return `[-] cancelListing: Listing '${listingId}' not found.`;
  if (listing.seller.toLowerCase() !== user.toLowerCase()) return `[-] cancelListing: You can only cancel your own listings.`;
  await addItem(user, listing.item.id, 1, listing.item);
  await deleteListing(listingId);
  return { user, restoredItem: listing.item, listingId };
};
export const refundExpiredListings = async (expiryMs = 48 * 3600 * 1000) => {
  const expiredBefore = Date.now() - expiryMs;
  const listings = getAllListings().filter(l => l.timestamp < expiredBefore);
  for (const listing of listings) {
    if (await isValidUser(listing.seller)) await addItem(listing.seller, listing.item.id, 1, listing.item);
    await deleteListing(listing.id);
  }
  return { refunded: listings.length };
};

// confusing functions so i put comments here
export const skillBoostList = {
  dredcoin: ['dredcoinBonus', 'dredcoinMultiplier'],
  ignoreTax: ['ignoreTaxPercent'],
  consumable: ['itemPreserveMultiplier'],
  expBonus: ['expGainMultiplier'],
  bonusPassiveIncomePerSecond: [],
  bonusPassiveIncomePerMinute: [],
  bonusPassiveIncomePerHour: [],
  expNeededDebuffPercent: [],
  bonusLevelChance: [],
  loot: ['lootBonus', 'dropRateMultiplier'],
};
export const skillExpNeeded = lvl => Math.floor(100 * Math.pow(1.5, lvl - 1));
export const searchSkillByIdOrName = (skills, query) => {
  const q = query.toLowerCase();
  for (const slot in skills) {
    const skill = skills[slot];
    if (!skill || typeof skill !== 'object') continue;
    const idMatch = skill.id?.toLowerCase() === q;
    const nameMatch = skill.name?.toLowerCase() === q;
    if (idMatch || nameMatch) return { skill, slot };
  }
  return { skill: null };
};
export const resolveSkill = (skills, skillOrSlot) => {
  if (typeof skillOrSlot === 'object') return { skill: skillOrSlot };
  const slot = skillOrSlot;
  if (skills[slot]) return { skill: skills[slot], slot };
  return searchSkillByIdOrName(skills, skillOrSlot);
};
export const giveSkill = async (user, slot, skillId) => {
  if (!(await isValidUser(user))) throwError(`[-] giveSkill: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const skill = data.skills;
  const def = skills[skillId];
  if (!def) throwError(`[-] giveSkill: Skill not found '${skillId}'.`);
  skill[slot] = {
    id: def.id,
    name: def.name,
    description: def.description,
    category: def.category,
    obtainable: def.obtainable ?? true,
    learned: true,
    exp: 0,
    level: 1,
    expNeeded: 100,
    maxLevel: def.maxLevel || null,
  };
  await saveData(user, data);
  return { user, slot, skill: skill[slot] };
};
export const removeSkill = async (user, slotOrSkillId) => {
  if (!(await isValidUser(user))) throwError(`[-] removeSkill: Invalid user ${user}`);
  await initUserObject(user);
  const data = await loadData(user);
  const skills = data.skills;
  const { skill, slot } = resolveSkill(skills, slotOrSkillId);
  if (!skill || !slot) throwError(`[-] removeSkill: Skill not found: ${slotOrSkillId}`);
  delete skills[slot];
  await saveData(user, data);
  return { user, removedSlot: slot, removedSkill: skill };
};
export const applySkill = async (user, slotOrSkill, message) => {
  if (!(await isValidUser(user))) throwError(`[-] applySkill: Invalid user ${user}`);
  await initUserObject(user);
  const data = await loadData(user);
  const Skills = data?.skills;
  if (!Skills) throwError(`[-] applySkill: No skills found for user ${user}`);
  const { skill, slot } = resolveSkill(Skills, slotOrSkill);
  if (!skill || !skill.id) throwError(`[-] applySkill: Invalid skill or slot: ${slotOrSkill}`);
  const logic = skills[skill.id];
  if (!logic || typeof logic.execute !== 'function') throwError(`[-] applySkill: No logic defined for skill '${skill.id}'`);
  const dep = await resolveDependencies(skill.dependencies, message);
  const executed = await logic.execute(user, skill, dep);
  return { user, slotOrSkill, executed };
};
// List all skill name and id from user
export const listSkills = async user => {
  if (!(await isValidUser(user))) throwError(`[-] listSkills: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const skills = data?.skills || {};
  return Object.entries(skills)
    .filter(([_, skill]) => skill && typeof skill === 'object' && !Array.isArray(skill) && 'id' in skill && typeof skill.id === 'string')
    .map(([slot, skill]) => ({ slot, ...skill }));
};
// List all skill boost multipler (listSkillBoost.total) from user by skillBoostList
export const listSkillBoost = async (user, key) => {
  if (!(await isValidUser(user))) throwError(`[-] listSkillBoost: User ${user} not found.`);
  await initUserObject(user);
  const allBoosts = await applySkillBoosts(user);
  const boostKeys = skillBoostList[key];
  if (!boostKeys || !Array.isArray(boostKeys)) throwError(`[-] listSkillBoost: key ${key} not found.`);
  const result = {};
  for (const key of boostKeys) {
    if (allBoosts[key]) result[key] = allBoosts[key];
  }
  const total = Object.values(result).reduce((acc, mult) => acc * mult, 1);
  return {
    total,
    ...result,
  };
};
// return total multiplier from user all skill combine
export const userAllSkillBoosts = async user => {
  if (!(await isValidUser(user))) throwError(`[-] userAllSkillBoosts: Invalid user: ${user}`);
  await initUserObject(user);
  const allBoosts = await applySkillBoosts(user);
  const result = {};
  for (const [parentKey, boostKeys] of Object.entries(skillBoostList)) {
    const group = {};
    for (const key of boostKeys) {
      if (allBoosts[key]) group[key] = allBoosts[key];
    }
    const total = Object.values(group).reduce((acc, m) => acc * m, 1);
    result[parentKey] = { total, ...group };
  }
  return result;
};
export const allSkillBoosts = () => {
  const result = {};
  for (const skillId in skills) {
    const logic = skills[skillId];
    if (!logic) continue;
    const staticBoosts = logic.boosts || {};
    const simulatedSkill = { id: skillId, level: logic.maxLevel || 1 }; // Simulate max-level skill for example
    const dynamicBoosts = typeof logic.applyBoost === 'function' ? logic.applyBoost('global', simulatedSkill) || {} : {};
    const combinedBoosts = { ...staticBoosts, ...dynamicBoosts };
    for (const [boostKey, multiplier] of Object.entries(combinedBoosts)) {
      const parentKey = boostKey.replace(/([A-Z].*)$/, '').toLowerCase() || boostKey;
      if (!result[parentKey]) result[parentKey] = { total: 1 };
      result[parentKey][boostKey] = multiplier;
      result[parentKey].total *= multiplier;
    }
  }
  return result;
};
export const giveSkillExp = async (user, skillIdOrSlot, amount = 10) => {
  if (!(await isValidUser(user))) throwError(`[-] gainSkillExp: Invalid user ${user}`);
  await initUserObject(user);
  const data = await loadData(user);
  const skills = data.skills || {};
  const { skill, slot } = resolveSkill(skills, skillIdOrSlot);
  if (!skill || !slot) throwError(`[-] gainSkillExp: Skill not found: ${skillIdOrSlot}`);
  skill.exp = (skill.exp || 0) + amount;
  while (skill.exp >= skill.expNeeded) {
    if (skill.maxLevel && skill.level >= skill.maxLevel) {
      skill.exp = skill.expNeeded;
      break;
    }
    skill.exp -= skill.expNeeded;
    skill.level = (skill.level || 1) + 1;
    skill.expNeeded = Math.floor(skill.expNeeded * 1.5);
  }
  await saveData(user, data);
  return { skill, slot };
};
export const giveSkillLv = async (user, skillIdOrSlot, newLevel = 1, newExp = 0, newExpNeeded = null) => {
  if (!(await isValidUser(user))) throwError(`[-] giveSkillLv: Invalid user ${user}`);
  await initUserObject(user);
  const data = await loadData(user);
  const skills = (data.skills ||= {});
  const { skill, slot } = resolveSkill(skills, skillIdOrSlot);
  if (!skill || !slot) throwError(`[-] setSkillLv: Skill not found for ${skillIdOrSlot}`);
  skill.level += newLevel;
  if (skill.maxLevel && skill.level > skill.maxLevel) {
    skill.level = skill.maxLevel;
  }
  skill.exp += newExp;
  skill.expNeeded = newExpNeeded ?? skillExpNeeded(skill.level);
  await saveData(user, data);
  return { user, slot, skill };
};
export const applySkillBoosts = async user => {
  if (!(await isValidUser(user))) throwError(`[-] applySkillBoosts: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const skillsData = data.skills || {};
  const result = {};
  for (const [slot, skill] of Object.entries(skillsData)) {
    if (!skill?.learned || !skill.id) continue;
    const logic = skills[skill.id];
    if (!logic) continue;
    if (logic.boosts && typeof logic.boosts === 'object') {
      for (const [boostType, multiplier] of Object.entries(logic.boosts)) {
        result[boostType] = (result[boostType] || 1) * multiplier;
      }
    }
    if (typeof logic.applyBoost === 'function') {
      const dynamicBoosts = logic.applyBoost(user, skill);
      if (dynamicBoosts && typeof dynamicBoosts === 'object') {
        for (const [boostType, multiplier] of Object.entries(dynamicBoosts)) {
          result[boostType] = (result[boostType] || 1) * multiplier;
        }
      }
    }
  }
  return result;
};
export const repairAllSkillObject = async user => {
  if (!(await isValidUser(user))) throwError(`[-] repairAllSkillObject: Invalid user: ${user}`);
  await initUserObject(user);
  const data = await loadData(user);
  const skillsData = (data.skills ||= {});
  const repairedDetails = [];
  for (const slot in skillsData) {
    const skill = skillsData[slot];
    if (!skill || typeof skill !== 'object' || Array.isArray(skill) || !skill.id || !skills[skill.id]) {
      repairedDetails.push({ slot, removed: true });
      delete skillsData[slot];
      continue;
    }
    const def = skills[skill.id];
    const fixed = [];
    const fix = prop => {
      if (skill[prop] !== def[prop] && def[prop] !== undefined) {
        skill[prop] = def[prop];
        fixed.push(prop);
      }
    };
    fix('name');
    fix('description');
    fix('category');
    fix('rarity');
    fix('obtainable');
    fix('id');
    if (typeof skill.level !== 'number') {
      skill.level = 1;
      fixed.push('level');
    }
    if (typeof skill.exp !== 'number') {
      skill.exp = 0;
      fixed.push('exp');
    }
    if (typeof skill.expNeeded !== 'number') {
      skill.expNeeded = skillExpNeeded(skill.level);
      fixed.push('expNeeded');
    }
    if (def.maxLevel !== undefined && skill.maxLevel !== def.maxLevel) {
      skill.maxLevel = def.maxLevel;
      fixed.push('maxLevel');
    }
    skill.learned = true;
    if (!skill.learned) {
      skill.learned = true;
      fixed.push('learned');
    }
    if (fixed.length > 0) repairedDetails.push({ slot, id: skill.id, fixed });
  }
  await saveData(user, data);
  return {
    user,
    repairedCount: repairedDetails.length,
    details: repairedDetails,
  };
};

export const researchBoostList = {
  search_cooldown: ['search_cooldown'],
  search_quality: ['search_quality'],
};
export const research = async (user, id) => {
  if (!(await isValidUser(user))) throwError(`[-] research: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const tree = researchs[id];
  if (!tree) throwError(`[-] research: ID ${id} not found.`);
  const complete = (data.research.complete ||= []);
  const queue = (data.research.queue ||= []);
  const levels = (data.research.levels ||= {});
  if (complete.includes(id)) return `[-] research: ${id} already completed`;
  for (const req of tree.require || []) {
    if (req.startsWith('item:')) {
      const item = req.slice(5);
      if (!hasItem(user, item)) return `[-] research: Missing item: ${item}`;
    } else if (req.startsWith('quest:')) {
      const quest = req.slice(6);
      if (!isQuestComplete(user, quest)) return `[-] research: Missing quest: ${quest}`;
    } else if (req.startsWith('achievement:')) {
      const ach = req.slice(12);
      if (!hasAchievement(user, ach)) return `[-] research: Missing achievement: ${ach}`;
    } else if (!complete.includes(req)) return `[-] research: Missing research ${req}`;
  }
  const level = (levels[id] || 0) + 1;
  const cost = typeof tree.cost === 'function' ? tree.cost(level) : tree.cost || 0;
  const duration = typeof tree.duration === 'function' ? tree.duration(level) : tree.duration;
  const coins = await getDredcoin(user);
  if (coins < cost) return `[-] research: User ${user} don't have enough ${config.CURRENCY_NAME}.`;
  await removeDredcoin(user, cost);
  if (duration && duration > 0) queue.push({ id, level, start: Date.now(), duration });
  else {
    complete.push(id);
    levels[id] = level;
  }
  await saveData(user, data);
  return { user, id, level, cost, queued: !!duration };
};
export const completeResearchQueuesIfCan = async (user, message) => {
  if (!(await isValidUser(user))) throwError(`[-] completeResearchQueuesIfCan: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const complete = (data.research.complete ||= []);
  const queue = (data.research.queue ||= []);
  const now = Date.now();
  const completedItems = [];
  const remainingQueue = [];
  for (const queuedItem of queue) {
    const { id, level, start, duration } = queuedItem;
    const endTime = start + duration;
    if (now >= endTime) {
      if (!complete.includes(id)) {
        complete.push(id);
        const research = researchs[id];
        const dep = await resolveDependencies(research.dependencies, message);
        if (research && research.execute) await research.execute(user, research, dep);
        completedItems.push({ id, level, completedAt: now });
      }
    } else remainingQueue.push(queuedItem);
  }
  data.research.queue = remainingQueue;
  if (completedItems.length > 0) await saveData(user, data);
  return {
    user,
    completedItems,
    remainingQueueCount: remainingQueue.length,
    hasChanges: completedItems.length > 0,
  };
};
export const listResearchBoost = async (user, key) => {
  if (!(await isValidUser(user))) throwError(`[-] listResearchBoost: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const researchData = data.research || {};
  const complete = researchData.complete || [];
  const result = {};
  const boostKeys = researchBoostList[key];
  if (!boostKeys || !Array.isArray(boostKeys)) throwError(`[-] listResearchBoost: key ${key} not found.`);
  for (const boostKey of boostKeys) {
    result[boostKey] = 1;
    for (const researchId of complete) {
      const research = researchs[researchId];
      if (research && research.boosts && typeof research.boosts === 'object' && boostKey in research.boosts) result[boostKey] *= research.boosts[boostKey];
    }
  }
  const values = Object.values(result);
  const total = values.reduce((sum, value) => {
    return typeof value === 'number' ? sum + value : sum;
  }, 0);
  return {
    user,
    keys: boostKeys,
    total: total,
  };
};
export const hasResearch = async (user, id, level) => {
  if (!(await isValidUser(user))) throwError(`[-] hasResearch: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const completed = data?.research?.complete || [];
  if (!level) return completed.includes(id) || completed.find(r => typeof r === 'object' && r.id === id);
  return completed.some(r => {
    if (typeof r === 'string') return r === id && level === 1;
    return r.id === id && r.level >= level;
  });
};
export const drawResearchTree = async user => {
  if (!(await isValidUser(user))) throwError(`[-] drawResearchTree: Invalid user ${user}`);
  await initUserObject(user);
  const data = await loadData(user),
    queue = data.research?.queue || [],
    complete = data.research?.complete || [];
  const canvas = createCanvas(600, 400),
    ctx = canvas.getContext('2d'),
    W = canvas.width,
    H = canvas.height;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0f0f1a');
  grad.addColorStop(1, '#1e1e2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  for (let x = 0; x < W; x += 40) ctx.beginPath(), ctx.moveTo(x, 0), ctx.lineTo(x, H), ctx.stroke();
  for (let y = 0; y < H; y += 40) ctx.beginPath(), ctx.moveTo(0, y), ctx.lineTo(W, y), ctx.stroke();
  ctx.strokeStyle = 'rgba(0,255,255,0.05)';
  for (let i = 0; i < 6; i++) ctx.beginPath(), ctx.arc(W / 2, H / 2, 100 + i * 40, 0, Math.PI * 2), ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  for (let i = 0; i < 20; i++) ctx.beginPath(), ctx.roundRect(randomNumber(0, W), randomNumber(0, H), 20 + randomNumber(0, 60), 10 + randomNumber(0, 30), 4), ctx.stroke();
  for (let i = 0; i < 10; i++) ctx.beginPath(), ctx.arc(randomNumber(0, W), randomNumber(0, H), 10 + randomNumber(0, 20), 0, Math.PI * 2), ctx.stroke();
  const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  glow.addColorStop(0, 'rgba(0, 200, 255, 0.08)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  for (let x = 0; x < W; x += 40) {
    const alpha = 0.05 * (1 - Math.abs(x - W / 2) / (W / 2));
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    const alpha = 0.05 * (1 - Math.abs(y - H / 2) / (H / 2));
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.015)';
  for (let i = -W; i < W; i += 80) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + H, H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i + H, 0);
    ctx.lineTo(i, H);
    ctx.stroke();
  }

  const spacingBaseX = 180,
    spacingBaseY = 160,
    baseNodeSize = 48,
    pos = {};
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  const buildTree = (id, x, y, visited = new Set()) => {
    if (visited.has(id)) return;
    visited.add(id);
    pos[id] = [x, y];
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    const children = Object.entries(researchs).filter(([cid, r]) => (r.require || []).includes(id) && !visited.has(cid));
    const totalWidth = (children.length - 1) * spacingBaseX;
    children.forEach(([cid], i) => {
      const cx = x - totalWidth / 2 + i * spacingBaseX;
      const cy = y + spacingBaseY;
      buildTree(cid, cx, cy, visited);
    });
  };
  Object.entries(researchs)
    .filter(([_, r]) => !r.require || !r.require.length)
    .forEach(([id], i, arr) => {
      const rootX = i * spacingBaseX - ((arr.length - 1) * spacingBaseX) / 2;
      buildTree(id, rootX, 0, new Set());
    });

  const padTop = 50,
    padSide = 50,
    padBottom = 120;
  const contentWidth = maxX - minX + padSide * 2,
    contentHeight = maxY - minY + padTop + padBottom;
  const scale = Math.min(W / contentWidth, H / contentHeight);
  const offsetX = (W - (maxX - minX) * scale) / 2 - minX * scale;
  const offsetY = padTop * scale - minY * scale;
  const t = (x, y) => [x * scale + offsetX, y * scale + offsetY];

  for (const [id, n] of Object.entries(researchs)) {
    const [x, y] = t(...pos[id]);
    const queueItem = queue.some(r => r.id === id);
    const inQueue = !!queueItem;
    const queueFinished = queueItem?.start && Date.now() >= queueItem.start + queueItem.duration;
    const state = complete.includes(id) || queueFinished ? 'done' : inQueue ? 'queue' : 'locked';
    const color = state === 'done' ? '#0f8' : state === 'queue' ? '#fc0' : '#88c';
    const glow = state === 'done' ? 'rgba(0,255,128,0.4)' : state === 'queue' ? 'rgba(255,200,0,0.4)' : 'rgba(80,80,255,0.2)';
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(x, y, baseNodeSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    for (const req of n.require || []) {
      const [fx, fy] = t(...pos[req]);
      const dx = x - fx,
        dy = y - fy,
        dist = Math.hypot(dx, dy);
      const ux = dx / dist,
        uy = dy / dist,
        pad = 30;
      const sx = fx + ux * pad,
        sy = fy + uy * pad;
      const ex = x - ux * pad,
        ey = y - uy * pad;
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.restore();
      const angle = Math.atan2(uy, ux),
        len = 12 * scale,
        ang = Math.PI / 7;
      const count = Math.max(2, (dist / 80) | 0);
      for (let i = 1; i <= count; i++) {
        const t = i / (count + 1);
        const ax = sx + (ex - sx) * t,
          ay = sy + (ey - sy) * t;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - len * Math.cos(angle - ang), ay - len * Math.sin(angle - ang));
        ctx.lineTo(ax - len * Math.cos(angle + ang), ay - len * Math.sin(angle + ang));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }
    }
  }

  for (const [k, n] of Object.entries(researchs)) {
    const [x, y] = pos[k],
      [sx, sy] = t(x, y),
      size = baseNodeSize * scale,
      h = size / 2;
    const q = queue.find(r => r.id === k),
      done = complete.includes(k),
      prog = q?.start ? Math.min((Date.now() - q.start) / q.duration, 1) : 0;
    const level = q?.level ?? (done ? n.maxLevel : 0),
      unlocked = (n.require || []).every(dep => complete.includes(dep)),
      r2 = h + 6;
    const duration = typeof n.duration === 'function' ? n.duration(level) : n.duration;
    ctx.lineWidth = 6;
    if (q?.start && !done) {
      const a0 = -Math.PI / 2,
        a1 = a0 + prog * 2 * Math.PI;
      ctx.beginPath();
      ctx.strokeStyle = '#ffe100ff';
      ctx.arc(sx, sy, r2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = '#00ff88';
      ctx.arc(sx, sy, r2, a0, a1);
      ctx.stroke();
      (ctx.fillStyle = '#fc0'), (ctx.font = `bold ${Math.round(16 * scale)}px Segoe UI`);
      const remaining = Math.max(0, q.start + q.duration - Date.now());
      ctx.fillText(`Remaining: ${formatTime(remaining)}`, sx, sy + h + 34 * scale);
    } else {
      ctx.beginPath();
      ctx.strokeStyle = done ? '#00ff88' : unlocked ? '#fc0' : '#2d2d2dff';
      ctx.arc(sx, sy, r2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, h, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(sx - h, sy - h, size, size);
    try {
      const img = await loadImage(n.icon);
      ctx.drawImage(img, sx - h, sy - h, size, size);
      if (!unlocked) (ctx.fillStyle = 'rgba(0,0,0,0.6)'), ctx.fillRect(sx - h, sy - h, size, size);
    } catch {
      ctx.fillStyle = '#222';
      ctx.fillRect(sx - h, sy - h, size, size);
    }
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(16 * scale)}px Segoe UI`;
    ctx.textAlign = 'center';
    ctx.fillText(n.name, sx, sy + h + 18 * scale);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(14 * scale)}px Segoe UI`;
    ctx.fillText(`Level ${level}/${n.maxLevel}`, sx, sy - h - 6 * scale);
    if (config.RESEARCH_SHOW_REQUIREMENTS && n.require?.length && !done && !q) {
      ctx.fillStyle = '#ccc';
      ctx.font = `bold ${Math.round(8 * scale)}px Sans-serif`;
      const reqs = n.require.map(r => researchs[r]?.name || r).join(', ');
      ctx.fillText(`Require: ${reqs}`, sx, sy - h + 6 * scale);
    }
    const cost = typeof n.cost === 'function' ? n.cost(level) : n.cost;
    if (cost && !done && !q) (ctx.fillStyle = '#ffe100ff'), (ctx.font = `bold ${Math.round(16 * scale)}px Segoe UI`), ctx.fillText(`Cost: ${formatAmount(cost)}`, sx, sy + h + 34 * scale);
    if (duration && !done && !q) (ctx.fillStyle = '#1ed1feff'), (ctx.font = `bold ${Math.round(16 * scale)}px Segoe UI`), ctx.fillText(`Duration: ${formatTime(duration)}`, sx, sy + h + 48 * scale);
    if (config.RESEARCH_SHOW_DESCRIPTION) {
      const maxWidth = 128,
        words = n.description.split(' '),
        lines = [];
      let line = '';
      for (const word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > maxWidth) lines.push(line.trim()), (line = word + ' ');
        else line = test;
      }
      if (line) lines.push(line.trim());
      ctx.fillStyle = '#ccc';
      ctx.font = `${Math.round(12 * scale)}px Segoe UI`;
      ctx.textAlign = 'left';
      lines.forEach((text, i) => ctx.fillText(text, sx + h + 10 * scale, sy + h - 18 * scale - (lines.length - i - 1) * 14 * scale));
    }
  }
  const buffer = canvas.toBuffer('image/png');
  const timestamp = Date.now();
  const filePath = path.join(paths.temp, `research_tree_${timestamp}.png`);
  await fs.writeFile(filePath, buffer);
  return {
    user,
    filePath,
    img: filePath,
    timestamp,
    width: W,
    height: H,
    contentWidth,
    contentHeight,
    scale,
    offsetX,
    offsetY,
    pos,
    minX,
    maxX,
    minY,
    maxY,
    padTop,
    padSide,
    padBottom,
    spacingBaseX,
    spacingBaseY,
    baseNodeSize,
  };
};
export const cleanOldResearchImages = async (dir = '../temp', maxAgeMs = 30_000) => {
  const now = Date.now();
  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      if (!file.startsWith('research_tree_') || !file.endsWith('.png')) continue;
      const fullPath = path.join(dir, file);
      const stat = await fs.stat(fullPath);
      const age = now - stat.mtimeMs;
      if (age > maxAgeMs) {
        await fs.unlink(fullPath);
        log(`[-] cleanOldResearchImages: Deleted ${file}`);
      }
    }
  } catch (err) {
    log(`[-] cleanOldResearchImages: ${err}.`);
  }
};

export const giveAchievement = async (user, achievementId) => {
  if (!(await isValidUser(user))) throwError(`[-] giveAchievement: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const Achievements = (data.achievements ||= {});
  if (Achievements[achievementId]) return `[-] giveAchievement: Achievement ${achievementId} already given to user ${user}.`;
  const achievement = achievements[achievementId];
  if (!achievement) throwError(`[-] giveAchievement: Achievement ${achievementId} not found.`);
  Achievements[achievementId] = {
    id: achievement.id,
    name: achievement.name,
    description: achievement.description,
    obtainable: achievement.obtainable || false,
    category: achievement.category,
    obtained: true,
    obtainedAt: Date.now(),
  };
  await saveData(user, data);
  return {
    user,
    achievementId,
    achievement: Achievements[achievementId],
  };
};
export const hasAchievement = async (user, achievementId) => {
  if (!(await isValidUser(user))) throwError(`[-] hasAchievement: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const achievements = data.achievements || {};
  return achievements.hasOwnProperty(achievementId) && achievements[achievementId].obtained;
};
export const listAchievements = async user => {
  if (!(await isValidUser(user))) throwError(`[-] listAchievements: Invalid user ${user}`);
  await initUserObject(user);
  const data = await loadData(user);
  const achievements = data.achievements || {};
  return Object.entries(achievements)
    .filter(([_, ach]) => ach && typeof ach === 'object' && !Array.isArray(ach) && 'id' in ach && typeof ach.id === 'string')
    .map(([id, ach]) => ({ id, ...ach }));
};
export const completeAchievementsIfCan = async (user, message) => {
  if (!(await isValidUser(user))) throwError(`[-] completeAchievementsIfCan: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const userAchievements = (data.achievements ||= {});
  const completed = [];
  for (const [key, achievement] of Object.entries(achievements)) {
    if (!achievement.obtainable) continue;
    if (userAchievements[key]?.obtained) continue;
    if (achievement.dependencies?.length) {
      const unmet = achievement.dependencies.some(dep => !userAchievements[dep]?.obtained);
      if (unmet) continue;
    }
    try {
      const qualifies = typeof achievement.need === 'function' ? await achievement.need(user, data) : false;
      if (qualifies) {
        const result = await giveAchievement(user, key);
        if (typeof achievement.execute === 'function') {
          const dep = await resolveDependencies(achievement.dependencies, message);
          await achievement.execute(user, data, dep);
          await saveData(user, data);
        }
        completed.push(result.achievement);
      }
    } catch (err) {
      throwError(`[!] Error checking achievement "${key}": ${err.message}`);
    }
  }
  return {
    user,
    completed,
  };
};

export const isQuestComplete = async (user, id) => {
  if (!(await isValidUser(user))) throwError(`[-] isQuestComplete: Invalid user ${user}`);
  await initUserObject(user);
  const data = await loadData(user);
  return (data.quests?.complete || []).includes(id);
};
export const getQuests = async (user, { onlyObtainable = true } = {}) => {
  if (!(await isValidUser(user))) throwError(`[-] getQuests: User ${user} not found.`);
  await initUserObject(user);
  const available = [],
    inProgress = [],
    complete = [],
    locked = [];
  for (const [key, quest] of Object.entries(quests)) {
    if (onlyObtainable && !quest.obtainable) continue;
    const entry = {
      key,
      user,
      raw: quest,
      state: 'locked',
      status: '🔒',
      progress: '0%',
    };
    if (isQuestComplete(user, key)) {
      entry.state = 'complete';
      entry.status = '✅';
      entry.progress = '100%';
      complete.push(entry);
      continue;
    }
    const unmet = quest.require?.some(req => {
      const [type, value] = req.split(':');
      switch (type) {
        case 'item':
          return !hasItem(user, value);
        case 'quest':
          return !isQuestComplete(user, value);
        case 'achievement':
          return !hasAchievement(user, value);
        case 'research':
          return !hasResearch(user, value);
        default:
          return true;
      }
    });
    if (unmet) {
      locked.push(entry);
      continue;
    }
    entry.state = 'inProgress';
    const need = quest.need?.() || {};
    const values = Object.entries(need).map(([key, target]) => {
      const current = getStat?.(user, key) ?? 0;
      const percent = Math.min(Math.round((current / target) * 100), 100);
      return percent;
    });
    const avg = values.length ? Math.floor(values.reduce((a, b) => a + b, 0) / values.length) : 0;
    entry.progress = values.map(v => `${v}%`).join(' / ') || '0%';
    entry.status = avg >= 100 ? '✅' : avg >= 88 ? '🕖' : avg >= 76 ? '🕕' : avg >= 63 ? '🕔' : avg >= 51 ? '🕓' : avg >= 38 ? '🕒' : avg >= 26 ? '🕑' : avg >= 13 ? '🕐' : '🕛';
    inProgress.push(entry);
    available.push(entry);
  }
  return {
    user,
    available,
    inProgress,
    complete,
    locked,
  };
};
export const getQuestsByType = async (type, filters = {}) => {
  return Object.entries(quests)
    .filter(([_, quest]) => {
      if (!quest.obtainable) return false;
      if (!Array.isArray(quest.questTypes) || !quest.questTypes.includes(type)) return false;
      if (filters.rarity && quest.rarity !== filters.rarity) return false;
      if (filters.category && quest.category !== filters.category) return false;
      return true;
    })
    .map(([key]) => key);
};
export const giveQuest = async (user, key) => {
  if (!(await isValidUser(user))) throwError(`[-] giveQuest: User ${user} not found.`);
  if (isQuestComplete(user, key)) return false;
  await initUserObject(user);
  const data = await loadData(user);
  if (data.quests[key]) return false;
  data.quests[key] = { startedAt: Date.now() };
  await saveData(user, data);
  return true;
};
export const giveRandomQuests = async (user, amount = 1, { category = null, exclude = [], onlyObtainable = true, filter = null } = {}) => {
  if (!(await isValidUser(user))) throwError(`[-] giveRandomQuests: User ${user} not found.`);
  await initUserObject(user);
  const given = [];
  const data = await loadData(user);
  data.quests ??= {};
  const pool = Object.entries(quests).filter(([key, quest]) => {
    if (onlyObtainable && !quest.obtainable) return false;
    if (exclude.includes(key)) return false;
    if (data.quests[key]) return false;
    if (isQuestComplete(user, key)) return false;
    if (category && !key.startsWith(category + '.')) return false;
    if (filter && !filter(quest)) return false;
    return true;
  });
  while (given.length < amount && pool.length > 0) {
    const index = Math.floor(randomNumber(0, pool.length));
    const [key] = pool.splice(index, 1)[0];
    giveQuest(user, key);
    given.push(key);
  }
  await saveData(user, data);
  return given;
};
export const hasQuest = async (user, key) => {
  if (!(await isValidUser(user))) throwError(`[-] hasQuest: User ${user} not found.`);
  if (!key || typeof key !== 'string') return false;
  if (await isQuestComplete(user, key)) return true;
  await initUserObject(user);
  const quest = quests[key];
  if (!quest || !quest.obtainable) return false;
  let unmet = false;
  if (quest.require?.length) {
    for (const req of quest.require) {
      const [type, value] = req.split(':');
      switch (type) {
        case 'item':
          if (!(await hasItem(user, value))) unmet = true;
          break;
        case 'quest':
          if (!(await isQuestComplete(user, value))) unmet = true;
          break;
        case 'achievement':
          if (!(await hasAchievement(user, value))) unmet = true;
          break;
        case 'research':
          if (!(await hasResearch(user, value))) unmet = true;
          break;
        default:
          unmet = true;
      }
      if (unmet) break;
    }
  }
  if (unmet) return false;
  return true;
};
export const completeQuestsIfCan = async (user, message) => {
  if (!(await isValidUser(user))) throwError(`[-] completeQuestsIfCan: Invalid user ${user}`);
  await initUserObject(user);
  const data = await loadData(user);
  let updated = false;
  const completed = [];
  for (const [id, quest] of Object.entries(quests)) {
    if (!quest.obtainable || isQuestComplete(user, id)) continue;
    let unmet = false;
    for (const req of quest.require || []) {
      const [type, value] = req.split(':');
      if ((type === 'item' && !(await hasItem(user, value))) || (type === 'quest' && !(await isQuestComplete(user, value))) || (type === 'achievement' && !(await hasAchievement(user, value))) || (type === 'research' && !(await hasResearch(user, value)))) {
        unmet = true;
        break;
      }
    }
    if (unmet) continue;
    const dep = resolveDependencies(quest.dependencies, message);
    const isDone = typeof quest.need === 'function' ? await quest.need(user, dep) : false;
    if (isDone) {
      if (typeof quest.execute === 'function') await quest.execute(user, dep);
      completeQuest(user, id);
      completed.push(id);
      updated = true;
    }
  }
  if (updated) await saveData(user, data);
  return {
    user,
    completed,
    updated,
  };
};
export const completeQuest = async (user, id, message) => {
  if (!(await isValidUser(user))) throwError(`[-] completeQuest: User ${user} not found.`);
  if (!id) throwError(`[-] completeQuest: Missing user or quest ID`);
  await initUserObject(user);
  const data = await loadData(user);
  const complete = (data.quests.complete ||= []);
  const quest = quests[id];
  if (!quest) throwError(`[-] completeQuest: Quest ${id} not found.`);
  if (!complete.includes(id)) {
    if (typeof quest.execute === 'function') {
      try {
        const dep = resolveDependencies(quest.dependencies, message);
        await quest.execute(user, quest, dep);
      } catch (err) {
        throwError(`[-] completeQuest: Error executing quest "${id}": ${err.message}`);
      }
    }
    complete.push(id);
    await saveData(user, data);
  }
  return true;
};
export const removeCompleteQuest = async (user, id) => {
  if (!(await isValidUser(user))) throwError(`[-] removeQuestComplete: Invalid user ${user}`);
  if (!id) throwError(`[-] removeQuestComplete: Missing quest ID`);
  await initUserObject(user);
  const data = await loadData(user);
  const complete = (data.quests.complete ||= []);
  const index = complete.indexOf(id);
  if (index !== -1) complete.splice(index, 1);
  await saveData(user, data);
  return true;
};
export const removeQuest = async (user, id) => {
  if (!(await isValidUser(user))) throwError(`[-] removeQuest: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const completeIdx = data.quests.complete.indexOf(id);
  if (completeIdx !== -1) data.quests.complete.splice(completeIdx, 1);
  const activeIdx = data.quests.active.indexOf(id);
  if (activeIdx !== -1) data.quests.active.splice(activeIdx, 1);
  await saveData(user, data);
  return true;
};
// DAILY QUESTS
export const seedToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
};
export const seededRandom = seed => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return () => {
    h = Math.imul(31, h + 1) | 0;
    return (h >>> 0) / 2 ** 32;
  };
};
export const setDailyQuests = async (user, amount = 3, filters = {}) => {
  if (!(await isValidUser(user))) throwError(`[-] setDailyQuests: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const today = seedToday();
  if (data.dailyQuests.date === today) return data.dailyQuests;
  const rand = seededRandom(today);
  const allKeys = getQuestsByType('daily', filters);
  const selected = [];
  const pool = [...allKeys];
  for (let i = 0; i < amount && pool.length > 0; i++) {
    const index = Math.floor(rand() * pool.length);
    selected.push(pool.splice(index, 1)[0]);
  }
  data.dailyQuests = {
    date: today,
    quests: selected,
    complete: [],
  };
  await saveData(user, data);
  return data.dailyQuests;
};
export const completeDailyQuests = async (user, message) => {
  if (!(await isValidUser(user))) throwError(`[-] completeDailyQuests: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const today = seedToday();
  if (!data.dailyQuests || data.dailyQuests.date !== today) await setDailyQuests(user);
  const { quests, complete } = data.dailyQuests;
  const newlyCompleted = [];
  for (const id of quests) {
    if (complete.includes(id)) continue;
    const quest = quests[id];
    if (!quest) continue;
    const dep = resolveDependencies(quest.dependencies, message);
    const isDone = await quest.execute?.(user, quest, dep);
    if (isDone) {
      complete.push(id);
      newlyCompleted.push(id);
    }
  }
  await saveData(user, data);
  return {
    user,
    date: today,
    completed: complete,
    newlyCompleted,
    total: quests.length,
    done: complete.length,
  };
};
export const listDailyQuests = async user => {
  if (!(await isValidUser(user))) throwError(`[-] listDailyQuests: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const today = seedToday();
  if (!data.dailyQuests || data.dailyQuests.date !== today) await setDailyQuests(user);
  const questsToday = data.dailyQuests?.quests || [];
  const completed = data.dailyQuests?.complete || [];
  const available = [],
    inProgress = [],
    complete = [];
  for (const key of questsToday) {
    const quest = quests[key];
    if (!quest) continue;
    const entry = {
      key,
      user,
      state: 'locked',
      status: '🔒',
      progress: '0%',
    };
    if (completed.includes(key)) {
      entry.state = 'complete';
      entry.status = '✅';
      entry.progress = '100%';
      complete.push(entry);
      continue;
    }
    const need = quest.need?.() || {};
    const values = Object.entries(need).map(([statKey, target]) => {
      const current = getStat(user, statKey) ?? 0;
      const percent = Math.min(Math.round((current / target) * 100), 100);
      return percent;
    });
    const avg = values.length ? Math.floor(values.reduce((a, b) => a + b, 0) / values.length) : 0;
    entry.progress = values.map(v => `${v}%`).join(' / ') || '0%';
    if (avg >= 100) {
      entry.state = 'complete';
      entry.status = '✅';
      complete.push(entry);
    } else {
      entry.state = 'inProgress';
      entry.status = avg >= 88 ? '🕖' : avg >= 76 ? '🕕' : avg >= 63 ? '🕔' : avg >= 51 ? '🕓' : avg >= 38 ? '🕒' : avg >= 26 ? '🕑' : avg >= 13 ? '🕐' : '🕛';
      inProgress.push(entry);
      available.push(entry);
    }
  }
  return {
    user,
    available,
    inProgress,
    complete,
  };
};
// WEEKLY QUESTS
export const seedThisWeek = () => {
  const now = new Date();
  const year = now.getFullYear();
  const onejan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  return `${year}-W${week}`;
};
export const setWeeklyQuests = async (user, amount = 5, filters = {}) => {
  if (!(await isValidUser(user))) throwError(`[-] setWeeklyQuests: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const thisWeek = seedThisWeek();
  if (data.weeklyQuests.date === thisWeek) return data.weeklyQuests;
  const rand = seededRandom(thisWeek);
  const allKeys = getQuestsByType('weekly', filters);
  const selected = [];
  const pool = [...allKeys];
  for (let i = 0; i < amount && pool.length > 0; i++) {
    const index = Math.floor(rand() * pool.length);
    selected.push(pool.splice(index, 1)[0]);
  }
  data.weeklyQuests = {
    date: thisWeek,
    quests: selected,
    complete: [],
  };
  await saveData(user, data);
  return data.weeklyQuests;
};
export const completeWeeklyQuests = async (user, message) => {
  if (!(await isValidUser(user))) throwError(`[-] completeWeeklyQuests: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const thisWeek = seedThisWeek();
  if (!data.weeklyQuests || data.weeklyQuests.date !== thisWeek) await setWeeklyQuests(user);
  const { quests: weekly, complete } = data.weeklyQuests;
  const newlyCompleted = [];
  for (const id of weekly) {
    if (complete.includes(id)) continue;
    const quest = quests[id];
    if (!quest) continue;
    const dep = resolveDependencies(quest.dependencies, message);
    const isDone = await quest.execute?.(user, quest, dep);
    if (isDone) {
      complete.push(id);
      newlyCompleted.push(id);
    }
  }
  await saveData(user, data);
  return {
    user,
    week: thisWeek,
    completed: complete,
    newlyCompleted,
    total: weekly.length,
    done: complete.length,
  };
};
export const listWeeklyQuests = async user => {
  if (!(await isValidUser(user))) throwError(`[-] listWeeklyQuests: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const thisWeek = seedThisWeek();
  if (!data.weeklyQuests || data.weeklyQuests.date !== thisWeek) await setWeeklyQuests(user);
  const weekly = data.weeklyQuests?.quests || [];
  const completed = data.weeklyQuests?.complete || [];
  const available = [],
    inProgress = [],
    completeList = [];
  for (const key of weekly) {
    const quest = quests[key];
    if (!quest) continue;
    const entry = {
      key,
      user,
      state: 'locked',
      status: '🔒',
      progress: '0%',
    };
    if (completed.includes(key)) {
      entry.state = 'complete';
      entry.status = '✅';
      entry.progress = '100%';
      completeList.push(entry);
      continue;
    }
    const need = quest.need?.() || {};
    const values = Object.entries(need).map(([statKey, target]) => {
      const current = getStat(user, statKey) ?? 0;
      const percent = Math.min(Math.round((current / target) * 100), 100);
      return percent;
    });
    const avg = values.length ? Math.floor(values.reduce((a, b) => a + b, 0) / values.length) : 0;
    entry.progress = values.map(v => `${v}%`).join(' / ') || '0%';
    if (avg >= 100) {
      entry.state = 'complete';
      entry.status = '✅';
      completeList.push(entry);
    } else {
      entry.state = 'inProgress';
      entry.status = avg >= 88 ? '🕖' : avg >= 76 ? '🕕' : avg >= 63 ? '🕔' : avg >= 51 ? '🕓' : avg >= 38 ? '🕒' : avg >= 26 ? '🕑' : avg >= 13 ? '🕐' : '🕛';
      inProgress.push(entry);
      available.push(entry);
    }
  }
  return {
    user,
    available,
    inProgress,
    complete: completeList,
  };
};
// MONTHLY QUESTS
export const seedThisMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`;
};
export const setMonthlyQuests = async (user, amount = 8, filters = {}) => {
  if (!(await isValidUser(user))) throwError(`[-] setMonthlyQuests: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const currentMonth = seedThisMonth();
  if (data.monthlyQuests.date === currentMonth) return data.monthlyQuests;
  const rand = seededRandom(currentMonth);
  const allKeys = getQuestsByType('monthly', filters);
  const selected = [];
  const pool = [...allKeys];
  for (let i = 0; i < amount && pool.length > 0; i++) {
    const index = Math.floor(rand() * pool.length);
    selected.push(pool.splice(index, 1)[0]);
  }
  data.monthlyQuests = {
    date: currentMonth,
    quests: selected,
    complete: [],
  };
  await saveData(user, data);
  return data.monthlyQuests;
};
export const completeMonthlyQuests = async (user, message) => {
  if (!(await isValidUser(user))) throwError(`[-] completeMonthlyQuests: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const currentMonth = seedMonth();
  if (!data.monthlyQuests || data.monthlyQuests.date !== currentMonth) await setMonthlyQuests(user);
  const { quests, complete } = data.monthlyQuests;
  const newlyCompleted = [];
  for (const id of quests) {
    if (complete.includes(id)) continue;
    const quest = questsData[id];
    if (!quest) continue;
    const dep = resolveDependencies(quest.dependencies, message);
    const isDone = await quest.execute?.(user, quest, dep);
    if (isDone) {
      complete.push(id);
      newlyCompleted.push(id);
    }
  }
  await saveData(user, data);
  return {
    user,
    date: currentMonth,
    completed: complete,
    newlyCompleted,
    total: quests.length,
    done: complete.length,
  };
};
export const listMonthlyQuests = async user => {
  if (!(await isValidUser(user))) throwError(`[-] listMonthlyQuests: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const currentMonth = seedMonth();
  if (!data.monthlyQuests || data.monthlyQuests.date !== currentMonth) await setMonthlyQuests(user);
  const questsList = data.monthlyQuests?.quests || [];
  const completed = data.monthlyQuests?.complete || [];
  const available = [],
    inProgress = [],
    completeList = [];
  for (const key of questsList) {
    const quest = quests[key];
    if (!quest) continue;
    const entry = {
      key,
      user,
      state: 'locked',
      status: '🔒',
      progress: '0%',
    };
    if (completed.includes(key)) {
      entry.state = 'complete';
      entry.status = '✅';
      entry.progress = '100%';
      completeList.push(entry);
      continue;
    }
    const need = quest.need?.() || {};
    const values = Object.entries(need).map(([statKey, target]) => {
      const current = getStat(user, statKey) ?? 0;
      const percent = Math.min(Math.round((current / target) * 100), 100);
      return percent;
    });
    const avg = values.length ? Math.floor(values.reduce((a, b) => a + b, 0) / values.length) : 0;
    entry.progress = values.map(v => `${v}%`).join(' / ') || '0%';
    if (avg >= 100) {
      entry.state = 'complete';
      entry.status = '✅';
      completeList.push(entry);
    } else {
      entry.state = 'inProgress';
      entry.status = avg >= 88 ? '🕖' : avg >= 76 ? '🕕' : avg >= 63 ? '🕔' : avg >= 51 ? '🕓' : avg >= 38 ? '🕒' : avg >= 26 ? '🕑' : avg >= 13 ? '🕐' : '🕛';
      inProgress.push(entry);
      available.push(entry);
    }
  }
  return {
    user,
    available,
    inProgress,
    complete: completeList,
  };
};
// YEARLY QUESTS
export const seedThisYear = () => {
  return `${new Date().getFullYear()}`;
};
export const setYearlyQuests = async (user, amount = 7, filters = {}) => {
  if (!(await isValidUser(user))) throwError(`[-] setYearlyQuests: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const year = seedThisYear();
  if (data.yearlyQuests.date === year) return data.yearlyQuests;
  const rand = seededRandom(year);
  const allKeys = getQuestsByType('yearly', filters);
  const selected = [];
  const pool = [...allKeys];
  for (let i = 0; i < amount && pool.length > 0; i++) {
    const index = Math.floor(rand() * pool.length);
    selected.push(pool.splice(index, 1)[0]);
  }
  data.yearlyQuests = {
    date: year,
    quests: selected,
    complete: [],
  };
  await saveData(user, data);
  return data.yearlyQuests;
};
export const completeYearlyQuests = async (user, message) => {
  if (!(await isValidUser(user))) throwError(`[-] completeYearlyQuests: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const year = seedYear();
  if (!data.yearlyQuests || data.yearlyQuests.date !== year) await setYearlyQuests(user);
  const { quests, complete } = data.yearlyQuests;
  const newlyCompleted = [];
  for (const id of quests) {
    if (complete.includes(id)) continue;
    const quest = questsData[id];
    if (!quest) continue;
    const dep = resolveDependencies(quest.dependencies, message);
    const isDone = await quest.execute?.(user, quest, dep);
    if (isDone) {
      complete.push(id);
      newlyCompleted.push(id);
    }
  }
  await saveData(user, data);
  return {
    user,
    date: year,
    completed: complete,
    newlyCompleted,
    total: quests.length,
    done: complete.length,
  };
};
export const listYearlyQuests = async user => {
  if (!(await isValidUser(user))) throwError(`[-] listYearlyQuests: User ${user} not found.`);
  await initUserObject(user);
  const data = await loadData(user);
  const year = seedThisYear();
  if (!data.yearlyQuests || data.yearlyQuests.date !== year) await setYearlyQuests(user);
  const questsList = data.yearlyQuests?.quests || [];
  const completed = data.yearlyQuests?.complete || [];
  const available = [],
    inProgress = [],
    completeList = [];
  for (const key of questsList) {
    const quest = quests[key];
    if (!quest) continue;
    const entry = {
      key,
      user,
      state: 'locked',
      status: '🔒',
      progress: '0%',
    };
    if (completed.includes(key)) {
      entry.state = 'complete';
      entry.status = '✅';
      entry.progress = '100%';
      completeList.push(entry);
      continue;
    }
    const need = quest.need?.() || {};
    const values = Object.entries(need).map(([statKey, target]) => {
      const current = getStat(user, statKey) ?? 0;
      const percent = Math.min(Math.round((current / target) * 100), 100);
      return percent;
    });
    const avg = values.length ? Math.floor(values.reduce((a, b) => a + b, 0) / values.length) : 0;
    entry.progress = values.map(v => `${v}%`).join(' / ') || '0%';
    if (avg >= 100) {
      entry.state = 'complete';
      entry.status = '✅';
      completeList.push(entry);
    } else {
      entry.state = 'inProgress';
      entry.status = avg >= 88 ? '🕖' : avg >= 76 ? '🕕' : avg >= 63 ? '🕔' : avg >= 51 ? '🕓' : avg >= 38 ? '🕒' : avg >= 26 ? '🕑' : avg >= 13 ? '🕐' : '🕛';
      inProgress.push(entry);
      available.push(entry);
    }
  }
  return {
    user,
    available,
    inProgress,
    complete: completeList,
  };
};

export const Permission = async (user, action, role) => {
  if (!(await isValidUser(user))) return false;
  await initUserObject(user);
  action = action.toLowerCase();
  const data = await loadData(user);
  let permissions = data.Permission || '';
  if (action === 'get') {
    if (!permissions) return 'Guest 0';
    if (typeof role === 'string') {
      if (role === 'max' || role === 'highest') {
        let highestRole = permissions
          .split(', ')
          .map(r => {
            let [name, rank] = r.split(' ');
            return { name, rank: parseFloat(rank) };
          })
          .sort((a, b) => b.rank - a.rank)[0];
        return highestRole ? `${highestRole.name} ${highestRole.rank}` : 'Guest 0';
      }
      if (config.RANKS.hasOwnProperty(role)) return `${role} ${config.RANKS[role]}`;
      if (config.RANKS.genders?.hasOwnProperty(role)) return role;
      const match = role.match(/^(\d+)(\+|-|=\+|=-|=)$/);
      if (match) {
        let baseRank = parseFloat(match[1]);
        let operator = match[2];
        let filteredRoles = Object.entries(config.RANKS)
          .filter(([_, rank]) => {
            if (operator === '+') return rank > baseRank;
            if (operator === '>') return rank > baseRank;
            if (operator === '-') return rank < baseRank;
            if (operator === '<') return rank < baseRank;
            if (operator === '=+') return rank >= baseRank;
            if (operator === '>=') return rank >= baseRank;
            if (operator === '=-') return rank <= baseRank;
            if (operator === '<=') return rank <= baseRank;
            if (operator === '=') return rank === baseRank;
            if (operator === '===') return rank === baseRank;
            return false;
          })
          .map(([name, rank]) => `${name} ${rank}`)
          .join(', ');
        return filteredRoles || 'No matching roles';
      }
    }
    return permissions;
  }
  if (action === 'set' || action === 'add') {
    if (config.RANKS.genders?.hasOwnProperty(role)) {
      if (permissions.includes(role)) return false;
      permissions = permissions ? `${permissions}, ${role}` : role;
    } else {
      if (!config.RANKS.hasOwnProperty(role)) return false;
      let roleString = `${role} ${config.RANKS[role]}`;
      if (permissions.includes(roleString)) return false;
      permissions = permissions ? `${permissions}, ${roleString}` : roleString;
    }
    data.Permission = permissions;
    await saveData(user, data);
    return true;
  }
  if (action === 'remove' || action === 'delete') {
    if (!permissions) return false;
    let updatedRoles;
    if (config.RANKS.genders?.hasOwnProperty(role))
      updatedRoles = permissions
        .split(', ')
        .filter(r => r !== role)
        .join(', ');
    else if (config.RANKS.hasOwnProperty(role)) {
      let removedRole = `${role} ${config.RANKS[role]}`;
      updatedRoles = permissions
        .split(', ')
        .filter(r => r !== removedRole)
        .join(', ');
    } else return false;
    if (updatedRoles) data.Permission = updatedRoles;
    else delete data.Permission;
    await saveData(user, data);
    return true;
  }
  return false;
};
export const isRankBetter = (a, b = 4) => {
  if (a == null || b == null) return false;
  const parseRank = r => {
    if (typeof r === 'number') return r;
    if (typeof r === 'string') {
      const parts = r.trim().split(' ');
      if (parts.length === 2) {
        const num = parseFloat(parts[1]);
        return isNaN(num) ? null : num;
      }
      const fallback = parseFloat(r);
      return isNaN(fallback) ? null : fallback;
    }
    return null;
  };
  const valA = parseRank(a);
  const valB = parseRank(b);
  if (valA == null || valB == null) return false;
  return valA > valB;
};
export const isRankEqual = (a, b) => {
  if (a == null || b == null) return false;
  const parseRank = r => {
    if (typeof r === 'number') return r;
    if (typeof r === 'string') {
      const parts = r.trim().split(' ');
      if (parts.length === 2) {
        const num = parseFloat(parts[1]);
        return isNaN(num) ? null : num;
      }
      const fallback = parseFloat(r);
      return isNaN(fallback) ? null : fallback;
    }
    return null;
  };
  const valA = parseRank(a);
  const valB = parseRank(b);
  if (valA == null || valB == null) return false;
  return valA === valB;
};

export const donateToClanVault = async (user, clan, amount) => {
  if (!(await isValidUser(user))) throwError(`[-] donateToClanVault: User ${user} not found.`);
  const member = clanDB.prepare('SELECT 1 FROM clan_members WHERE user = ? AND clan = ?').get(user, clan);
  if (!member) return { member, donated: false, error: '[-] donateToClanVault: not a member.' };
  const row = clanDB.prepare('SELECT data FROM clans WHERE id = ?').get(clan);
  if (!row) return { donated: false, error: '[-] donateToClanVault: clan data not found.' };
  const data = JSON.parse(row.data || '{}');
  if (typeof data.vault !== 'number') data.vault = 0;
  data.vault += amount;
  clanDB.prepare('UPDATE clans SET data = ? WHERE id = ?').run(JSON.stringify(data), clan);
  return { user, clan, donates: amount, donated: true, newVault: data.vault };
};
export const joinClan = async (user, clan, password = null) => {
  if (!(await isValidUser(user))) throwError(`[-] joinClan: User ${user} not found.`);
  const info = clanDB.prepare('SELECT data FROM clans WHERE id = ?').get(clan);
  if (!info) return { joined: false, error: '[-] joinClan: clan not found.' };
  const data = JSON.parse(info.data || '{}');
  if (typeof data.settings !== 'object' || data.settings === null) data.settings = {};
  const settings = data.settings;
  const isPrivate = settings.private === true;
  const approvalOnly = settings.approvalOnly === true;
  const limit = settings.memberLimit ?? Infinity;
  const hasPassword = typeof settings.password === 'string';
  const memberCount = clanDB.prepare('SELECT COUNT(*) AS total FROM clan_members WHERE clan = ?').get(clan)?.total || 0;
  const alreadyMember = clanDB.prepare('SELECT 1 FROM clan_members WHERE user = ?').get(user);
  if (alreadyMember) return { joined: false, error: '[-] joinClan: already a member.' };
  if (memberCount >= limit) return { joined: false, error: '[-] joinClan: member limit reached.' };
  if (isPrivate) return { joined: false, error: '[-] joinClan: clan is private.' };
  if (hasPassword && settings.password !== password) return { joined: false, error: '[-] joinClan: wrong password.' };
  if (approvalOnly) {
    const id = `${clan}-${user}`;
    clanDB.prepare('INSERT OR REPLACE INTO clan_requests (id, user, clan) VALUES (?, ?, ?)').run(id, user, clan);
    return { user, joined: 'pending', clan };
  }
  const id = `${clan}-${user}`;
  clanDB.prepare('INSERT INTO clan_members (id, user, clan) VALUES (?, ?, ?)').run(id, user, clan);
  return { joined: true, user, clan, limit, memberCount, passwordProtected: hasPassword };
};
export const leaveClan = async user => {
  if (!(await isValidUser(user))) throwError(`[-] leaveClan: User ${user} not found.`);
  const member = clanDB.prepare('SELECT clan FROM clan_members WHERE user = ?').get(user);
  if (!member) return { left: false, error: '[-] leaveClan: not a member.' };
  clanDB.prepare('DELETE FROM clan_members WHERE user = ?').run(user);
  return { user, clan: member.clan, left: true };
};
export const changeClanSetting = async (user, clan, keyPath, value) => {
  if (!(await isValidUser(user))) throwError(`[-] changeClanSetting: User ${user} not found.`);
  const existing = clanDB.prepare('SELECT * FROM clans WHERE id = ?').get(clan);
  if (!existing || existing.owner !== user) return { changed: false, error: '[-] changeClanSetting: not owner or clan not found.' };
  const data = JSON.parse(existing.data || '{}');
  if (typeof data.settings !== 'object' || data.settings === null) return { changed: false, error: '[-] changeClanSetting: settings not initialized.' };
  const keys = keyPath.split('.');
  let current = data;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) return { changed: false, error: `[-] changeClanSetting: '${keys[i]}' path does not exist.` };
    current = current[keys[i]];
    if (typeof current !== 'object' || current === null) return { changed: false, error: `[-] changeClanSetting: '${keys[i]}' is not an object.` };
  }
  const finalKey = keys.at(-1);
  if (!(finalKey in current)) return { changed: false, error: `[-] changeClanSetting: '${keyPath}' not found.` };
  if (keyPath === 'settings.memberLimit' && Number(value) > 50) return { changed: false, error: '[-] changeClanSetting: memberLimit cannot exceed 50.' };
  current[finalKey] = value;
  clanDB.prepare('UPDATE clans SET data = ? WHERE id = ?').run(JSON.stringify(data), clan);
  return { user, clan, changed: true, updatedPath: keyPath, newValue: value };
};
export const approveJoinRequest = async (requester, clan, user) => {
  if (!(await isValidUser(user))) throwError(`[-] approveJoinRequest: User ${user} not found.`);
  if (!(await isValidUser(requester))) throwError(`[-] approveJoinRequest: Requester ${requester} not found.`);
  const info = clanDB.prepare('SELECT * FROM clans WHERE id = ?').get(clan);
  if (!info) return { approved: false, error: '[-] approveJoinRequest: clan not found.' };
  const data = JSON.parse(info.data || '{}');
  const admins = data.settings?.admins || [];
  const isOwner = info.owner === requester;
  const isAdmin = admins.includes(requester);
  if (!isOwner && !isAdmin) return { approved: false, error: '[-] approveJoinRequest: not authorized.' };
  const req = clanDB.prepare('SELECT * FROM clan_requests WHERE clan = ? AND user = ?').get(clan, user);
  if (!req) return { approved: false, error: '[-] approveJoinRequest: no request found.' };
  const id = `${clan}-${user}`;
  clanDB.prepare('INSERT INTO clan_members (id, user, clan) VALUES (?, ?, ?)').run(id, user, clan);
  clanDB.prepare('DELETE FROM clan_requests WHERE clan = ? AND user = ?').run(clan, user);
  return { approved: true, clan, user };
};
export const denyJoinRequest = async (requester, clan, user) => {
  if (!(await isValidUser(user))) throwError(`[-] denyJoinRequest: User ${user} not found.`);
  if (!(await isValidUser(requester))) throwError(`[-] denyJoinRequest: Requester ${requester} not found.`);
  const info = clanDB.prepare('SELECT * FROM clans WHERE id = ?').get(clan);
  if (!info) return { denied: false, error: '[-] denyJoinRequest: clan not found.' };
  const data = JSON.parse(info.data || '{}');
  const admins = data.settings?.admins || [];
  const isOwner = info.owner === requester;
  const isAdmin = admins.includes(requester);
  if (!isOwner && !isAdmin) return { denied: false, error: '[-] denyJoinRequest: not authorized.' };
  const result = clanDB.prepare('DELETE FROM clan_requests WHERE clan = ? AND user = ?').run(clan, user);
  return { denied: result.changes > 0, clan, user };
};
export const kickMember = async (requester, clan, user) => {
  if (!(await isValidUser(user))) throwError(`[-] kickMember: User ${user} not found.`);
  if (!(await isValidUser(requester))) throwError(`[-] kickMember: Requester ${requester} not found.`);
  const info = clanDB.prepare('SELECT * FROM clans WHERE id = ?').get(clan);
  if (!info) return { kicked: false, error: '[-] kickMember: clan not found.' };
  const data = JSON.parse(info.data || '{}');
  const admins = data.settings?.admins || [];
  const isOwner = info.owner === requester;
  const isAdmin = admins.includes(requester);
  if (!isOwner && !isAdmin) return { kicked: false, error: '[-] kickMember: no permission.' };
  if (user === info.owner) return { kicked: false, error: '[-] kickMember: cannot kick owner.' };
  const member = clanDB.prepare('SELECT 1 FROM clan_members WHERE user = ? AND clan = ?').get(user, clan);
  if (!member) return { kicked: false, error: '[-] kickMember: user not in clan.' };
  clanDB.prepare('DELETE FROM clan_members WHERE user = ?').run(user);
  return { clan, kicked: true, user, by: requester };
};
export const banMember = async (requester, clan, user) => {
  if (!(await isValidUser(user))) throwError(`[-] banMember: User ${user} not found.`);
  if (!(await isValidUser(requester))) throwError(`[-] banMember: Requester ${requester} not found.`);
  const info = clanDB.prepare('SELECT * FROM clans WHERE id = ?').get(clan);
  if (!info) return { banned: false, error: '[-] banMember: clan not found.' };
  const data = JSON.parse(info.data || '{}');
  const admins = data.settings?.admins || [];
  const isOwner = info.owner === requester;
  const isAdmin = admins.includes(requester);
  if (!isOwner && !isAdmin) return { banned: false, error: '[-] banMember: no permission.' };
  if (!Array.isArray(data.banned)) data.banned = [];
  if (!data.banned.includes(user)) data.banned.push(user);
  clanDB.prepare('DELETE FROM clan_members WHERE user = ?').run(user);
  clanDB.prepare('DELETE FROM clan_requests WHERE user = ? AND clan = ?').run(user, clan);
  clanDB.prepare('UPDATE clans SET data = ? WHERE id = ?').run(JSON.stringify(data), clan);
  return { clan, user, banned: true, by: requester };
};
export const unbanMember = async (requester, clan, user) => {
  if (!(await isValidUser(user))) throwError(`[-] unbanMember: User ${user} not found.`);
  if (!(await isValidUser(requester))) throwError(`[-] unbanMember: Requester ${requester} not found.`);
  const info = clanDB.prepare('SELECT * FROM clans WHERE id = ?').get(clan);
  if (!info) return { unbanned: false, error: '[-] unbanMember: clan not found.' };
  const data = JSON.parse(info.data || '{}');
  const admins = data.settings?.admins || [];
  const isOwner = info.owner === requester;
  const isAdmin = admins.includes(requester);
  if (!isOwner && !isAdmin) return { unbanned: false, error: '[-] unbanMember: no permission.' };
  if (!Array.isArray(data.banned)) data.banned = [];
  const index = data.banned.indexOf(user);
  if (index === -1) return { unbanned: false, error: '[-] unbanMember: user not banned.' };
  data.banned.splice(index, 1);
  clanDB.prepare('UPDATE clans SET data = ? WHERE id = ?').run(JSON.stringify(data), clan);
  return { user, by: requester, clan, unbanned: true };
};
export const listBannedMembers = clan => {
  const row = clanDB.prepare('SELECT data FROM clans WHERE id = ?').get(clan);
  if (!row) return { banned: [] };
  const data = JSON.parse(row.data || '{}');
  return { banned: Array.isArray(data.banned) ? data.banned : [] };
};
export const transferClanOwnership = async (currentOwner, clan, newOwner) => {
  if (!(await isValidUser(newOwner))) throwError(`[-] transferClanOwnership: New owner ${newOwner} not found.`);
  if (!(await isValidUser(currentOwner))) throwError(`[-] transferClanOwnership: Current owner ${currentOwner} not found.`);
  const existing = clanDB.prepare('SELECT * FROM clans WHERE id = ?').get(clan);
  if (!existing || existing.owner !== currentOwner) return { transferred: false, error: '[-] transferClanOwnership: not owner or clan not found.' };
  const member = clanDB.prepare('SELECT 1 FROM clan_members WHERE user = ? AND clan = ?').get(newOwner, clan);
  if (!member) return { transferred: false, error: '[-] transferClanOwnership: new owner not a member.' };
  clanDB.prepare('UPDATE clans SET owner = ? WHERE id = ?').run(newOwner, clan);
  return { transferred: true, newOwner };
};
export const isAuthorized = async (user, clan) => {
  if (!(await isValidUser(user))) throwError(`[-] isAuthorized: User ${user} not found.`);
  const row = clanDB.prepare('SELECT * FROM clans WHERE id = ?').get(clan);
  if (!row) return false;
  if (row.owner === user) return true;
  const data = JSON.parse(row.data || '{}');
  const admins = data.settings?.admins || [];
  return admins.includes(user);
};
export const drawClanCard = async (clan) => {
  const width = 360;
  const height = 180;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const cardColor = '#2b2d31';
  const bannerHeight = 52;
  const iconSize = 64;
  const padding = 16;
  ctx.fillStyle = cardColor;
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, 16);
  ctx.fill();
  if (clan.settings?.bannerPath) {
    try {
      const banner = await loadImage(clan.settings.bannerPath);
      ctx.drawImage(banner, 0, 0, width, bannerHeight);
    } catch {
      ctx.fillStyle = clan.settings?.color || '#555';
      ctx.fillRect(0, 0, width, bannerHeight);
    }
  } else {
    ctx.fillStyle = clan.settings?.color || '#555';
    ctx.fillRect(0, 0, width, bannerHeight);
  }
  const tagText = clan.settings?.private ? 'Private' : 'Public';
  const tagColor = clan.settings?.private ? '#ed4245' : '#3ba55d';
  ctx.font = 'bold 13px sans-serif';
  const tagWidth = ctx.measureText(tagText).width + 20;
  const tagHeight = 24;
  const tagX = width - tagWidth - 12;
  const tagY = 12;
  ctx.fillStyle = tagColor;
  ctx.beginPath();
  ctx.roundRect(tagX, tagY, tagWidth, tagHeight, 12);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tagText, tagX + tagWidth / 2, tagY + tagHeight / 2);
  const iconX = padding;
  const iconY = bannerHeight + padding;
  ctx.fillStyle = clan.settings?.color || '#777';
  ctx.beginPath();
  ctx.moveTo(iconX + 10, iconY);
  ctx.lineTo(iconX + iconSize - 10, iconY);
  ctx.quadraticCurveTo(iconX + iconSize, iconY, iconX + iconSize, iconY + 10);
  ctx.lineTo(iconX + iconSize, iconY + iconSize - 10);
  ctx.quadraticCurveTo(iconX + iconSize, iconY + iconSize, iconX + iconSize - 10, iconY + iconSize);
  ctx.lineTo(iconX + 10, iconY + iconSize);
  ctx.quadraticCurveTo(iconX, iconY + iconSize, iconX, iconY + iconSize - 10);
  ctx.lineTo(iconX, iconY + 10);
  ctx.quadraticCurveTo(iconX, iconY, iconX + 10, iconY);
  ctx.closePath();
  ctx.fill();
  if (clan.settings?.iconPath) {
    try {
      const icon = await loadImage(clan.settings.iconPath);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(iconX + 10, iconY);
      ctx.lineTo(iconX + iconSize - 10, iconY);
      ctx.quadraticCurveTo(iconX + iconSize, iconY, iconX + iconSize, iconY + 10);
      ctx.lineTo(iconX + iconSize, iconY + iconSize - 10);
      ctx.quadraticCurveTo(iconX + iconSize, iconY + iconSize, iconX + iconSize - 10, iconY + iconSize);
      ctx.lineTo(iconX + 10, iconY + iconSize);
      ctx.quadraticCurveTo(iconX, iconY + iconSize, iconX, iconY + iconSize - 10);
      ctx.lineTo(iconX, iconY + 10);
      ctx.quadraticCurveTo(iconX, iconY, iconX + 10, iconY);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
      ctx.restore();
    } catch {}
  }
  const textX = iconX + iconSize + 16;
  const textY = iconY + 2;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(clan.id, textX, textY + 0);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#aaa';
  ctx.fillText(`Owner: ${clan.owner}`, textX, textY + 22);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#ccc';
  ctx.fillText(`${clan.memberCount} Members • ${clan.requestCount} Requests`, textX, textY + 42);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#888';
  ctx.fillText(`Donations: ${clan.vault?.toLocaleString() ?? 0}`, textX, textY + 62);
  const rawDate = clan.created || clan.Created || null;
  if (rawDate) {
    const d = new Date(rawDate);
    if (!isNaN(d)) {
      const est = `Est. ${d.toLocaleString('en-US', { month: 'short', year: 'numeric' })}`;
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#666';
      ctx.fillText(est, textX, textY + 80);
    }
  }
  const badgeBoxX = width - 88;
  const badgeBoxY = bannerHeight + 12;
  const badgeBoxWidth = 68;
  const badgeHeight = 22;
  const badges = clan.badges || [];
  for (let i = 0; i < Math.min(badges.length, 3); i++) {
    const badgeY = badgeBoxY + i * (badgeHeight + 8);
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.roundRect(badgeBoxX, badgeY, badgeBoxWidth, badgeHeight, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badges[i], badgeBoxX + badgeBoxWidth / 2, badgeY + badgeHeight / 2);
  }
  return canvas.toBuffer('image/png');
};

export const helper = {
  // --- STUFFS (SHOULD BE COMMENTED SINCE ITS BIG OBJECT) ---
  // items, skills, researchs, achievements,
  // quests, enchants, recipes, jobs, pets
  // --- USER CLAN FUNCTIONS ---
  getClanMemberCount, //(clanId)
  getClanMemberLimit, //(clanId)
  isClanPrivate, //(clanId)
  getClanRequestCount, //(clanId)
  createClan, //(owner, clan, data = "{}")
  getClan, //(clan)
  getClanByOwner, //(owner)
  getUserClan, //(user)
  getAllClans, //()
  deleteClan, //(user, clan)
  updateClanData, //(user, clan, data)
  isValidClan, //(clan)
  setClanPassword, //(owner, clan, password)
  customizeClanColor, //(owner, clan, color)
  setClanBanner, //(owner = null, clan, base64Img)
  setUpClanSettings, //(clanId)
  viewPendingClanRequests, //(user, clan)
  renameClan, //(user, clan, newName)
  getClanSettings, //(clan, keyPath = null)
  setClanIcon, //(owner = null, clan, base64Img)

  // --- DATABASE SAVING & READING ---
  readData, //(path)
  writeData, //(path, data)
  readText, //(path)
  writeText, //(path, data)
  loadData, //(userId)
  loadAllData, //()
  loadDataByAccountId, //(accountId)
  loadUsernameByAccountId, //(accountId)
  isValidUser, //(userId)
  saveData, //(userId, data)
  writeEnv, //(key, value)
  readEnv, //(key)
  envAll, //()
  quickSaveUserIdData, //(userId, newValue)
  loadDataByAccountCookie, //(cookie)
  loadUsernameByAccountCookie, //(cookie)

  // --- USER MARKETPLACE FUNCTIONS ---
  getAllListings, //()
  getListing, //(id)
  saveListing, //(listing)
  deleteListing, //(id)

  // --- DELETE MESSAGE SCHEDULER ---
  scheduleDelete, //(bot, channelId, messageId, delay = 15000)
  removeDelete, //(channelId, messageId)
  rescheduleAll, //(bot)
  deleteDmWithUser, //(bot, userId)
  deleteAllDms, //(bot)

  // --- TRADING ---
  saveTrade, //(trade)
  getTrade, //(id)
  getAllTrades, //()
  deleteTrade, //(id)
  getUserTrades, //(userId)
  cleanUpExpiredTrades, //()

  // --- ULTILS FUNCTIONS ---
  encryptAccount, //(account)
  decryptAccount, //(payload, keyHex)
  randomNumber, //(min = 0, max = 1)
  gambleRandomNumber, //(min = 0, max = 1, multiplier = 1)
  key, //()
  fileexists, //(p)
  getFileContent, //(filePath)
  clearGetFileContentFiles, //(intervalMs = 10000, maxAgeMs = 30000),
  log, //(msg)
  parseAmount, //(input)
  parseBet, //(input, bal)
  formatAmount, //(num, options = {})
  isInteger, //(num)
  formatTime, //(ms)
  formatDate, //(date)
  parseDate, //(str)
  testEnv, //(envName = 'all')
  isSameDay, //(dateA, dateB)
  newToken, //(length = 16)
  toBase64, //(string)
  fromBase64, //(base64)
  toBinary, //(string)
  fromBinary, //(binary)
  toRoman, //(number)
  fromRoman, //(roman)
  toSlug, //(string)
  findAllObjectByValue, //(obj, value)
  findAllArrayByValue, //(arr, key, value)
  deepFindAllObjectKeyPaths, //(obj, targetKey)
  unicode, //(str)
  wait, //(ms)
  resolveDependencies, //(depStr)
  convertImageToBase64, //(url)
  waitForMessages, //(channel, userId, options = {})
  flagMap, //()
  formatFlags, //(bitField)
  parseFlags, //(opts)
  runCommand, //(bot, message, content)
  convertColorToHex, //(input)
  isSafeNumber, //(n)
  chalk, //(text, color = 'white')
  Schedule, //()
  pvpEvent, //(type)
  newTab, //(shipId)
  removeTab, //(shipId)
  findTab, //(shipId)
  fetchShipList, //()
  fetchShipFromLink, //(link)
  drawShipsCard, //(ships, updateInterval, totalPlayers, maxPlayers)
  getMissionState, //()
  getFutureMission, //(count = 3)
  getDrednotLeaderboard, //(category, by = 'pilot', page = 1, formatter = 'formatDrednotLeaderboard')
  formatDrednotLeaderboard, //(data, by = 'pilot')
  getSpotifyToken, //()
  refreshSpotifyToken, //()
  searchSpotify, //(songName, artistName = "", limit = 1)
  getLocalIP, //()
  getProxyUrl, //()
  getNgrokUrl, //()
  getTax, //(amount = 0, user)
  initUserObject, //(user)
  // --- BLUEPRINTS (CREDIT TO BLUEYESCAT) ---
  isValidBlueprint, //(bpStr)
  bluePrintCountMaterials, //(bpStr)
  bluePrintReplaceMaterial, //(bpStr, fromItem, toItem)
  blueprintListMaterials, //(bpStr)
  bluePrintRemoveMaterial, //(bpStr, targetItem)
  blueprintMostUsedMaterial, //(bpStr)
  blueprintPreview, //(bpStr, y = 0)
  blueprintCountCmdTypes, //(bpStr)
  blueprintResourceCost, //(bpStr)
  bluePrintRandomizeItems, //(bpStr)
  blueprintCompare, //(bpStrA, bpStrB)
  // --- DREDCOIN & EXP & MAX ---
  givePermanentBoost, //(user, { dredcoin = 0, exp = 0 })
  giveDredcoinBoost, //(user, multiplier, duration)
  giveDredcoin, //(user, amount)
  addDredcoin, //(user, amount)
  removeDredcoin, //(user, amount)
  setDredcoin, //(user, amount)
  getDredcoin, //(user)
  getBankBalance, //(user)
  applyDredcoinMultiplier, //(user, amount)
  applyExpMultiplier, //(user, amount)
  isMaxCoin, //(user)
  isMaxBank, //(user)
  isMaxLevel, //(user)
  getExpNeeded, //(level, user)
  getUserExpData, //(user)
  canLevelUp, //(user)
  forceLevelUp, //(user, amount = 1)
  levelUpIfCan, //(user)
  giveExp, //(user, amount)
  removeExp, //(user, amount)
  giveExpBoost, //(user, multiplier, duration)
  getExp, //(user)
  // --- PRETIGES ---
  prestigeIfCan, //(user)
  prestige, //(user)
  getPrestige, //(user)
  // --- BOOSTS ---
  isExpired, //(boost)
  deleteAllExpiredBoosts, //(user)
  deleteExpiredBoosts, //(user, boostType)
  getActiveBoosts, //(user, boostType)
  giveBoost, //(user, type, multiplier, duration)
  giveLuck, //(user, category, multiplier, durationMs)
  getLuck, //(user)
  giveLuckBoost, //(user, multiplier, durationMs)
  applyLuckBoost, //(user)
  // --- PASSIVE INCOME ---
  givePassiveIncomeBoost, //(user, multiplier, duration)
  earnPassiveIncome, //(user)
  getPassiveIncome, //(user)
  // --- COOLDOWNS ---
  giveCooldownBoost, //(user, multiplier, durationMs)
  getCooldownBoost, //(user)
  newCooldown, //(user, command, seconds)
  newGlobalCooldown, //(user, command, seconds)
  Cooldown, //(user, command)
  GlobalCooldown, //(user, command)
  resetAllCooldowns, //(user)
  resetRandomCooldown, //(user)
  doubleAllCooldowns, //(user)
  // --- STREAKS ---
  gambleStreak, //(user, streak)
  getGambleStreak, //(user)
  dailyStreak, //(user, streak, lastClaim)
  getDailyStreak, //(user)
  weeklyStreak, //(user, streak, lastClaim)
  getWeeklyStreak, //(user)
  // --- BANKS & COIN TRADE ---
  depositDredcoin, //(user, amount)
  withdrawDredcoin, //(user, amount)
  transferDredcoin, //(userA, userB, amount)
  // --- ITEMS ---
  searchItemByIdOrName, //(inventory, query)
  isItemExistByIdOrName, //(query)
  getItemDefByIdOrName, //(query)
  resolveItem, //(inventory, itemPathOrObj)
  resolveContainer, //(inventory, pathArray)
  giveItem, //(user, itemPath, count = 1)
  removeItem, //(user, itemPath, count = 1, removeIfZero = true)
  consumeItem, //(user, item, count, options = {})
  useItem, //(user, itemPathOrObj, count = 1, options = {}, message)
  hasItem, //(user, itemPathOrObj, minCount = 1)
  equipItem, //(user, itemPath)
  listItems, //(user, options = {})
  item, //()
  repairAllItemObject, //(user)
  getRandomItemByChance, //(user, category, range = [1, 1], options = {})
  getRandomItem, //(user, category, range = [1, 1], options = {})
  getItemsByRarity, //(category, rarity, options = {})
  reduceDurability, //(user, itemPath, amount = 1, removeIfBroken = true)
  enchantItem, //(user, itemPath, enchantId, level = 1)
  hasEnchant, //(user, itemPath, enchantId, level = null)
  getRandomEnchant, //(rarity = "common")
  getRandomEnchantByChance, //()
  enchantToItem, //(enchantObj)
  useEnchantScroll, //(user, scrollPath, targetItemPath)
  getEnchants, //(user, itemPath)
  resetEnchants, //(user, itemPath)
  removeEnchant, //(user, itemPath, enchantIdOrIndex)
  getRecipeByIdOrName, //(table, query)
  resolveInputToDef, //(input)
  getCraftingStatus, //(user)
  claimCraft, //(user)
  craftItem, //(user, recipeId)
  getCookingStatus, //(user)
  claimCook, //(user)
  cookItem, //(user, recipeId)
  getMeltingStatus, //(user)
  claimMelt, //(user)
  meltItem, //(user, recipeId)
  disassembleItem, //(user, itemPath, count = 1)
  disassemblePreview, //(user, item)
  reforgeItem, //(user, itemPath)
  formatItemQuality, //(quality, options = {})
  startHatchEgg, //(user, eggPath)
  hatchEgg, //(user)
  cancelHatchEgg, //(user)
  refundEggOnCancel, //(user)
  checkHatchStatus, //(user)
  listUserEggs, //(user)
  // --- MARKETPLACE ---
  listItemForSale, //(user, itemPath, price)
  buyListing, //(buyer, listingId)
  cancelListing, //(user, listingId)
  refundExpiredListings, //()
  // --- SKILLS ---
  skillExpNeeded, //(lvl)
  searchSkillByIdOrName, //(skills, query)
  resolveSkill, //(skills, skillOrSlot)
  giveSkill, //(user, slot, skillId)
  removeSkill, //(user, slotOrSkillId)
  applySkill, //(user, slotOrSkill, message)
  listSkills, //(user)
  listSkillBoost, //(user, key)
  userAllSkillBoosts, //(user)
  allSkillBoosts, //()
  giveSkillExp, //(user, skillIdOrSlot, amount = 10)
  giveSkillLv, //(user, skillIdOrSlot, newLevel = 1, newExp = 0, newExpNeeded = null)
  applySkillBoosts, //(user)
  repairAllSkillObject, //(user)
  // --- RESEARCH ---
  research, //(user, id)
  completeResearchQueuesIfCan, //(user, message)
  listResearchBoost, //(user, key)
  hasResearch, //(user, id, level)
  drawResearchTree, //(user)
  cleanOldResearchImages, //(dir = './temp', maxAgeMs = 30_000)
  giveAchievement, //(user, achievementId)
  hasAchievement, //(user, achievementId)
  listAchievements, //(user)
  completeAchievementsIfCan, //(user, message)
  // --- QUESTS ---
  isQuestComplete, //(user, id)
  getQuests, //(user, { onlyObtainable = true } = {})
  getQuestsByType, //(type, filters = {})
  giveQuest, //(user, key)
  giveRandomQuests, //(user, amount = 1, { category = null, exclude = [], onlyObtainable = true, filter = null } = {})
  hasQuest, //(user, key)
  completeQuestsIfCan, //(user, message)
  completeQuest, //(user, id, message)
  removeCompleteQuest, //(user, id)
  removeQuest, //(user, id)
  seedToday, //()
  seededRandom, //(seed)
  setDailyQuests, //(user, amount = 3, filters = {})
  completeDailyQuests, //(user, message)
  listDailyQuests, //(user)
  seedThisWeek, //()
  setWeeklyQuests, //(user, amount = 5, filters = {})
  completeWeeklyQuests, //(user, message)
  listWeeklyQuests, //(user)
  seedThisMonth, //()
  setMonthlyQuests, //(user, amount = 8, filters = {})
  completeMonthlyQuests, //(user, message)
  listMonthlyQuests, //(user)
  seedThisYear, //()
  setYearlyQuests, //(user, amount = 7, filters = {})
  completeYearlyQuests, //(user, message)
  listYearlyQuests, //(user)
  // --- RANKING ---
  Permission, //(user, action, role)
  isRankBetter, //(a, b = 4)
  isRankEqual, //(a, b)
  // --- CLANS ---
  donateToClanVault, //(user, clan, amount)
  joinClan, //(user, clan, password = null)
  leaveClan, //(user)
  changeClanSetting, //(user, clan, keyPath, value)
  approveJoinRequest, //(requester, clan, user)
  denyJoinRequest, //(requester, clan, user)
  kickMember, //(requester, clan, user)
  banMember, //(requester, clan, user)
  unbanMember, //(requester, clan, user)
  listBannedMembers, //(clan)
  transferClanOwnership, //(currentOwner, clan, newOwner)
  isAuthorized, //(user, clan)
  drawClanCard, //(clan)
};
