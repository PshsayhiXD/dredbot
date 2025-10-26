import express from "express";
import crypto from "crypto";
import argon2 from "argon2";
import paths from "./../../utils/path.js";
import { pathToFileURL } from "url";

const module = await import(pathToFileURL(paths.utils.ratelimit).href);
const ratelimit = module.default;

export default ({ loadData, saveData, log, initUserObject }, bot) => {
  const Router = express.Router();
  Router.post("/signup", ratelimit, async (req, res) => {
    try {
      const { username, password, token, discordId } = req.body;
      if (!username || !password || !token || !discordId) return res.status(400).json({ success: false, message: "[400] Missing fields." });
      const verifyUrl = "https://www.google.com/recaptcha/api/siteverify";
      const params = new URLSearchParams();
      params.append("secret", process.env.RECAPTCHA_SECRET_KEY);
      params.append("response", token);
      const verifyRes = await fetch(verifyUrl, { method: "POST", body: params });
      const result = await verifyRes.json();
      if (!result.success || (result.score !== undefined && result.score < 0.5)) return res.status(403).json({ success: false, message: "[403] Failed reCAPTCHA." });
      const existing = await loadData(username);
      if (existing?.account) return res.status(409).json({ success: false, message: "[409] Username already exists." });
      await initUserObject(username);
      const data = await loadData(username);
      const account = data.account ?? {};
      account.id = discordId;
      account.uid = crypto.randomBytes(16).toString("hex");
      account.username = username;
      account.password = await argon2.hash(password, { type: argon2.argon2id });
      account.status = "Registered";
      account.createdAt = Date.now();
      data.account = account;
      await saveData(username, data);
      log(`[+] New signup: ${username} (${discordId})`, "info");
      return res.status(201).json({ success: true, message: "[201] Account created." });
    } catch (err) {
      log(`[-] /signup error: ${err}`, "error");
      return res.status(500).json({ success: false, message: "[500] Internal server error", err: err.message });
    }
  });
  return Router;
};