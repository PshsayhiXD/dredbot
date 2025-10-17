import { EmbedBuilder, ActionRowBuilder, 
         ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
         ModalBuilder, TextInputBuilder 
        } from "discord.js";
import config from '../config.js';
import { helper } from '../utils/helper.js';
import log from '../utils/logger.js';
import { 
  registerButtonHandlers, 
  registerSelectHandlers, 
  registerModalHandlers,
} from '../tasks/interactionCreate.js';

const customTypes = {
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  url: v => /^https?:\/\/\S+$/.test(v),
  int: v => /^-?\d+$/.test(v),
  float: v => !isNaN(parseFloat(v)),
  mention: v => /^<@!?\d+>$/.test(v)
};
export function checkMissingArgs(commandIdOrName, bot, { args = [], attachments = [] } = {}) {
  const commands = bot.commands;
  let command;
  if (typeof commandIdOrName === "number") command = Array.from(commands.values()).find(cmd => cmd.id === commandIdOrName);
  else if (typeof commandIdOrName === "string") command = commands.get(commandIdOrName.toLowerCase());
  if (!command) return "❌ Command not found.";
  const usage = command.usage || "";
  const parts = usage.match(/<[^>]+>|\[[^\]]+\]/g) || [];
  const displayParts = [command.name];
  const arrows = [];
  const missing = [];
  for (let i = 0, argIndex = 0; i < parts.length; i++) {
    const part = parts[i];
    const isRequired = part.startsWith("<");
    let arg = args[argIndex];
    const attachment = attachments[argIndex];
    const attachmentMatch = part.match(/^<attachment(?::(\w+))?>$/);
    if (attachmentMatch) {
      const expectedType = attachmentMatch[1] || "any";
      if (isRequired && !attachment) {
        missing.push(part);
        displayParts.push(part);
        arrows.push(" ".repeat(displayParts.join(" ").length + 1) + "^".repeat(part.length));
        continue;
      }
      if (attachment) {
        if (expectedType !== "any") {
          const isImage = attachment.contentType?.startsWith("image/");
          if (expectedType === "image" && !isImage) {
            missing.push(part);
            displayParts.push(part);
            arrows.push(" ".repeat(displayParts.join(" ").length + 1) + "^".repeat(part.length));
            continue;
          }
        }
        displayParts.push(`\`${attachment.name}\``);
        continue;
      }
    }
    const match1 = part.match(/^<(.+)>$/);
    let validOptions = null;
    let expectedTypes = [];
    let regexType = null;
    let range = null;
    let length = null;
    let defVal = null;
    let isArray = false;
    if (match1) {
      const content = match1[1];
      // Default value
      const [main, def] = content.split("=");
      if (def) defVal = def;
      // Array type
      if (main.endsWith("[]")) isArray = true;
      // Union types: <id:number|string>
      const typeSplit = main.replace("[]","").split(":");
      const name = typeSplit[0];
      if (typeSplit[1]) {
        expectedTypes = typeSplit[1].split("|").map(t => t.toLowerCase());
        // Regex type
        if (expectedTypes.length === 1 && expectedTypes[0].startsWith("/") && expectedTypes[0].endsWith("/")) {
          try { regexType = new RegExp(expectedTypes[0].slice(1,-1)); } catch {}
          expectedTypes = [];
        }
        // Range/length: <number[0-10]>, <string[3-12]>
        const constraintMatch = typeSplit[1].match(/(\w+)\[(\d+)(?:-(\d+))?\]/);
        if (constraintMatch) {
          const [, t, min, max] = constraintMatch;
          expectedTypes = [t.toLowerCase()];
          if (t.toLowerCase() === "number") {
            if (max) range = [Number(min), Number(max)];
            else range = [Number(min), Number(min)];
          }
          if (t.toLowerCase() === "string") {
            if (max) length = [Number(min), Number(max)];
            else length = [Number(min), Number(min)];
          }
        }
      }
      // Options: <red|green|blue>
      const splitOpts = name.includes("|") ? name.split("|") : [];
      if (splitOpts.length > 1) validOptions = splitOpts.map(opt => opt.toLowerCase());
    }
    let argDisplay = "";
    let isInvalid = false;
    if (!arg && defVal) arg = defVal;
    if (isArray && arg) arg = arg.split(",");
    const validate = v => {
      if (validOptions && !validOptions.includes(v.toLowerCase())) return false;
      if (regexType && !regexType.test(v)) return false;
      for (const t of expectedTypes) {
        if (t === "string") {
          if (length && (v.length < length[0] || v.length > length[1])) return false;
        } else if (t === "number") {
          if (isNaN(Number(v))) return false;
          if (range && (Number(v) < range[0] || Number(v) > range[1])) return false;
        } else if (t === "boolean") {
          if (!["true","false"].includes(v.toLowerCase())) return false;
        } else if (customTypes[t] && !customTypes[t](v)) {
          return false;
        }
      }
      return true;
    };
    if (isRequired && !arg) {
      argDisplay = part;
      isInvalid = true;
      missing.push(part);
    } else if (arg) {
      if (isArray) {
        const bad = arg.find(v => !validate(v));
        if (bad) { argDisplay = part; isInvalid = true; missing.push(part); }
        else argDisplay = `\`[${arg.join(", ")}]\``;
      } else {
        if (!validate(arg)) { argDisplay = part; isInvalid = true; missing.push(part); }
        else argDisplay = `\`${arg}\``;
      }
    } else argDisplay = part;
    const currentLine = displayParts.join(" ");
    const startPos = currentLine.length + 1;
    if (isInvalid) arrows.push(" ".repeat(startPos) + "^".repeat(argDisplay.length));
    displayParts.push(argDisplay);
    argIndex++;
  }
  if (missing.length > 0) {
    const usageLine = displayParts.join(" ");
    const arrowLine = arrows.length ? "\n" + arrows.join("\n") : "";
    return `❌ **Missing or invalid argument(s)**: ${missing.join(", ")}\n\`\`\`\n${usageLine}${arrowLine}\n\`\`\``;
  }
  return null;
}

export async function checkMissingPermission(user, commandIdOrName, bot, Permission) {
    const commands = bot.commands || new Map();
    let command;
    if (typeof commandIdOrName === 'number') command = Array.from(commands.values()).find(cmd => cmd.id === commandIdOrName);
    else if (typeof commandIdOrName === 'string') command = commands.get(commandIdOrName.toLowerCase());
    if (!command) return `❌ Command not found.`;
    let userPermStr = await Permission(user, "get", "max");
    if (!userPermStr) userPermStr = "Guest 0";
    const userPerm = parseInt(userPermStr.split(" ").pop()) || 0;
    const requiredPerm = command.perm || 0;
    if (userPerm < requiredPerm) return `❌ **You do not have permission** to use this command. (Required: **${requiredPerm}**, Yours: **${userPerm}**)`;
    return null;
};

export function checkMissingCommandProperty(commandIdOrName, bot) {
    const requiredProps = ['name', 'usage', 'perm', 'description', 'execute', 'cooldown', 'id', 'category'];
    const commands = bot.commands || new Map();
    let command;
    if (typeof commandIdOrName === 'number') command = Array.from(commands.values()).find(cmd => cmd.id === commandIdOrName);
    else if (typeof commandIdOrName === 'string') command = commands.get(commandIdOrName.toLowerCase());
    if (!command) return ['command'];
    const missing = [];
    for (const prop of requiredProps) {
        if (!(prop in command)) missing.push(prop);
    }
    return missing;
};

export const commandEmbed = async ({
  title = 'null',
  description = 'null',
  color = '#2f3136',
  footer = null,
  thumbnail = config.BotAvatarURL,
  image = null,
  fields = [],
  user = null,
  message = null,
  reward = true,
} = {}) => {
  try {
    if (typeof color === 'string') {
      color = color.replace(/^#/, '');
      if (color.length === 8) color = color.slice(0, 6);
      color = parseInt(color, 16);
    }
    if (typeof description !== "string") description = String(description);
    if (description.length > 4096) description = description.slice(0, 4093) + "...";
    const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();
    let rewardText = '';
    if (reward && Array.isArray(config.COMMANDS_REWARD) && config.COMMANDS_REWARD.length >= 2) {
      const xpMin = config.COMMANDS_REWARD[0];
      const xpMax = config.COMMANDS_REWARD[1];
      const xp = Math.floor(Math.random() * (xpMax - xpMin + 1)) + xpMin;
      rewardText += `+${xp} XP`;
      await helper.giveExp(user, xp);
      if (config.COMMANDS_REWARD.length >= 4) {
        const coinMin = config.COMMANDS_REWARD[2];
        const coinMax = config.COMMANDS_REWARD[3];
        const coins = Math.floor(Math.random() * (coinMax - coinMin + 1)) + coinMin;
        rewardText += ` • +${coins}${config.CURRENCY_SYMBOL}`;
        await helper.giveDredcoin(user, coins);
      }
    }
    if (footer?.text) embed.setFooter(footer);
    else if (user) {
      const now = new Date();
      const formattedTime = now.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).toLowerCase();
      const formattedDate = now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      let iconURL = config.BotAvatarURL;
      if (message?.author?.displayAvatarURL) iconURL = message.author.displayAvatarURL({ dynamic: true, size: 32 });
      else if (message?.user?.displayAvatarURL) iconURL = message.user.displayAvatarURL({ dynamic: true, size: 32 });
      embed.setFooter({
        text: `${user}${rewardText ? ' • ' + rewardText : ''} • ${formattedDate} at ${formattedTime}`,
        iconURL,
      });
    }
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (typeof image === "string" && image.length > 0) embed.setImage(image);
    if (fields?.length) embed.addFields(fields);
    return embed;
  } catch (error) {
    log(`[commandEmbed]: ${error.stack}`, 'error');
    return new EmbedBuilder().setColor(0xff0000).setDescription('An error occurred while creating the embed.');
  }
};
export const commandButtonComponent = async (buttonDefs = []) => {
  const rows = [];
  const handlers = {};
  const buildRow = (buttons) => {
    const row = new ActionRowBuilder();
    for (const btn of buttons.slice(0, 5)) {
      const button = new ButtonBuilder()
        .setLabel(btn.label || 'Button')
        .setStyle(btn.style ?? ButtonStyle.Primary);
      const customId = btn.customId || `btn_${Math.random().toString(36).slice(2, 10)}`;
      if (btn.style === ButtonStyle.Link && btn.url) button.setURL(btn.url);
      else {
        button.setCustomId(customId);
        if (typeof btn.onClick === 'function') handlers[customId] = btn.onClick;
      }
      if (btn.emoji) button.setEmoji(btn.emoji);
      if (btn.disabled) button.setDisabled(true);
      row.addComponents(button);
    }
    return row;
  };
  if (Array.isArray(buttonDefs[0])) {
    for (const row of buttonDefs.slice(0, 5)) rows.push(buildRow(row));
  } else rows.push(buildRow(buttonDefs));
  registerButtonHandlers(handlers);
  return rows;
};
export const commandSelectComponent = async (menuDefs = []) => {
  const rows = [];
  const handlers = {};
  const buildRow = (menu) => {
    const row = new ActionRowBuilder();
    const select = new StringSelectMenuBuilder()
      .setPlaceholder(menu.placeholder || "Choose an option")
      .setMinValues(menu.minValues ?? 1)
      .setMaxValues(menu.maxValues ?? 1);
    const customId = menu.customId || `sel_${Math.random().toString(36).slice(2, 10)}`;
    select.setCustomId(customId);
    if (typeof menu.onSelect === "function") handlers[customId] = menu.onSelect;
    for (const opt of (menu.options || []).slice(0, 25)) {
      const label = (opt.label || "Option").toString().slice(0, 100);
      const value = (opt.value || opt.label || `val_${Math.random().toString(36).slice(2, 8)}`).toString().slice(0, 100);
      const description = opt.description?.toString().slice(0, 100);
      if (value.length < 1 || label.length < 1) continue;
      select.addOptions({
        label,
        value,
        description,
        emoji: opt.emoji,
        default: opt.default
      });
    }
    row.addComponents(select);
    return row;
  };
  if (Array.isArray(menuDefs[0])) {
    for (const menu of menuDefs.slice(0, 5)) rows.push(buildRow(menu));
  } else rows.push(buildRow(menuDefs));
  registerSelectHandlers(handlers);
  return rows;
};
export const commandModal = async (modalDef = {}) => {
  const { title, customId, inputs, onSubmit } = modalDef;
  const modalId = customId || `mod_${Math.random().toString(36).slice(2, 10)}`;
  const modal = new ModalBuilder().setCustomId(modalId).setTitle(title || "Modal");
  for (const input of (inputs || [])) {
    const textInput = new TextInputBuilder()
      .setCustomId(input.customId || `in_${Math.random().toString(36).slice(2, 10)}`)
      .setLabel(input.label || "Input")
      .setStyle(input.style ?? TextInputStyle.Short)
      .setRequired(input.required ?? true)
      .setMinLength(input.minLength ?? 1)
      .setMaxLength(input.maxLength ?? 4000)
      .setPlaceholder(input.placeholder || "");
    modal.addComponents(new ActionRowBuilder().addComponents(textInput));
  }
  registerModalHandlers({ [modalId]: onSubmit });
  return modal;
};
export const commandReRunButton = (bot, message, command, args) => {
  if (!bot || !message || !command) return null;
  return {
    label: "🔁 Run again",
    style: 2,
    customId: `run_${crypto.randomUUID()}`,
    onClick: async (interaction) => {
      if (interaction.user.id !== message.author.id) return;
      const newMessage = Object.assign(Object.create(message), {
        _rerun: message.id,
        id: Date.now().toString().slice(0, 17),
        createdTimestamp: Date.now(),
        content: `${config.PREFIX}${command} ${args.join(" ")}`
      });
      bot.emit("messageCreate", newMessage);
    }
  };
};
export const commandEmbedPager = async (embeds, userId) => {
  let i = 0;
  const build = async () => ({
    embeds: [embeds[i]],
    components: await commandButtonComponent([
      {
        label: "⬅️ Prev",
        style: 2,
        onClick: async int => {
          if (int.user.id !== userId) return;
          i = (i - 1 + embeds.length) % embeds.length;
          await int.update(await build());
        }
      },
      {
        label: "➡️ Next",
        style: 2,
        onClick: async int => {
          if (int.user.id !== userId) return;
          i = (i + 1) % embeds.length;
          await int.update(await build());
        }
      }
    ])
  });
  return await build();
};
export const commandLinkButton = async (label, url, emoji = null) => {
  return await commandButtonComponent([
    { label, style: ButtonStyle.Link, url, emoji }
  ]);
};
export const Embed = ({
  title = 'Untitled',
  description = 'No description provided.',
  color = '#2f3136',
  footer = null,
  thumbnail = null,
  timestamp = true,
} = {}) => {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color);
  if (footer) embed.setFooter(footer);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (timestamp) embed.setTimestamp();
  return embed;
};
