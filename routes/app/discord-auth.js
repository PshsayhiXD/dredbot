import express from "express";
import axios from "axios";
import paths from "../../utils/path.js";
import dotenv from "dotenv";
import crypto from "crypto";
dotenv.config({ path: paths.env });
import rateLimit from "../../utils/ratelimit.js";
export default ({ log, saveData, loadDataByAccountId, loadUsernameByAccountId, helper, readText }) => {
  const Router = express.Router();

  Router.get("/discord-auth", rateLimit, async (req, res) => {
    try {
      const code = req.query.code;
      if (!code) return res.status(400).send("[400] No code provided.");
      const data = new URLSearchParams();
      data.append("client_id", process.env.DISCORD_CLIENT_ID);
      data.append("client_secret", process.env.DISCORD_CLIENT_SECRET);
      data.append("grant_type", "authorization_code");
      data.append("code", code);
      data.append("redirect_uri", process.env.DISCORD_REDIRECT_URI);
      const headers = { "Content-Type": "application/x-www-form-urlencoded" };
      const tokenResponse = await axios.post("https://discord.com/api/oauth2/token", data, { headers });
      const accessToken = tokenResponse.data.access_token;
      const userResponse = await axios.get("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const discordUser = userResponse.data;
      const username = await loadUsernameByAccountId(discordUser.id);
      let user = await loadDataByAccountId(discordUser.id);
      if (!user) {
        user = {
          account: { id: discordUser.id, cookie: crypto.randomBytes(32).toString("hex") },
          banned: false
        };
      }
      const updatedData = {
        ...user,
        Discord: {
          username: discordUser.username,
          discriminator: discordUser.discriminator,
          avatar: discordUser.avatar,
          accessToken
        },
      };
      await saveData(username || discordUser.id, updatedData);
      res.cookie("d_sess", updatedData.account.cookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
      const rank = await helper.Permission(username, "get", "max");
      if (helper.isRankBetter(rank, 4)) {
        const adminHtml = await readText(paths.html.admin_dashboard);
        return res.send(adminHtml);
      }
      const dashboardHtml = await readText(paths.html.dashboard);
      return res.send(dashboardHtml);
    } catch (err) {
      log(`[-] /discord-auth: ${err}`, "error");
      return res.status(500).send("[500] Internal server error");
    }
  });

  return Router;
};