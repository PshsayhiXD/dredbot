import config from "../config.js";
import chalk from "chalk";

const log = async (msg, status = "info", options = {}) => {
  const {
    timestamp = false, // prepend [HH:MM:SS]
    uppercase = false, // force msg to uppercase
    prefix = "",       // add a custom prefix string
  } = options;
  const colors = {
    error: chalk.red,
    success: chalk.green,
    ok: chalk.green,
    successfully: chalk.green,
    warning: chalk.yellow,
    warn: chalk.yellow,
    title: chalk.cyan.bold,
    info: chalk.white,
  };
  const colorize = colors[status] || colors.info;
  const str = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
  let logMessage = str;
  if (uppercase) logMessage = logMessage.toUpperCase();
  if (prefix) logMessage = `${prefix} ${logMessage}`;
  if (timestamp) {
    const now = new Date().toLocaleTimeString("en-GB");
    logMessage = `[${now}] ${logMessage}`;
  }
  logMessage = colorize(logMessage);
  return fetch(`http://localhost:${config.LOG_PORT}/log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ log: str, status }),
  })
    .then(res => {
      if (!res.ok) process.exit(1);
    })
    .catch(() => {
      console.log(logMessage);
    });
};
export default log;