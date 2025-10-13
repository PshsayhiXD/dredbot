import { exec } from "child_process";
import path from "path";
import fs from "fs";
export default {
  name: "restart",
  description: "Restart the bot",
  aliases: [],
  usage: "",
  category: "moderation",
  perm: 4.7,
  cooldown: 1,
  globalCooldown: 1,
  id: 19,
  dependencies: "paths log",
  execute: async (message, args, user, command, dep) => {
    await message.react("🔁");
    const botBat = dep.paths?.["command-prompt"]?.run;
    const tempBat = path.join(process.cwd(), "temp-restart.bat");
    const script = [
      "@echo off",
      "timeout /t 1 >nul",
      `cmd /c "${botBat}"`,
      "del \"%~f0\""
    ].join("\r\n");
    fs.writeFileSync(tempBat, script);
    exec(`cmd /c "${tempBat}"`, (err) => {
      if (err) dep.log(`[restart]: ${err}`);
      process.exit(0);
    });
  }
};