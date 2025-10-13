import express from "express";
import paths from "./../../utils/path.js";
export default ({ loadDataByAccountCookie, readText, log, helper }) => {
  const Router = express.Router();
  Router.post("/auto-login", async (req, res) => {
    try {
      const authToken = req.cookies["d_sess"];
      if (!authToken) return res.status(401).send("[401] No auth token provided.");
      const matchedUser = loadDataByAccountCookie(authToken);
      if (!matchedUser) return res.status(401).send("[401] auto-login failed.");
      const rank = await helper.Permission(matchedUser.username, "get", "max");
      if (helper.isRankBetter(rank, 4)) {
        const adminHtml = await readText(paths.html.admin_dashboard);
        return res.send(adminHtml);
      }
      const dashboardHtml = await readText(paths.html.dashboard);
      return res.send(dashboardHtml);
    } catch (err) {
      log(`[-] Auto-login error: ${err.stack}`, "error");
      return res.status(500).send("[500] Internal server error");
    }
  });
  return Router;
};