import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import config from "../config.js";
import log from "../utils/logger.js";

const setupReactionRoles = async (bot) => {
  const channel = await bot.channels.fetch(config.reactionRoleChannelID).catch(() => null);
  if (!channel || !channel.isTextBased()) return log("[reactionRole] Invalid channel", 'warn');
  const messages = await channel.messages.fetch({ limit: 10 }).catch(() => []);
  const existing = messages.find(m => m.author.id === bot.user.id && m.embeds.length > 0);
  const embed = new EmbedBuilder()
    .setTitle("Choose Your Roles")
    .setDescription([
      "Customize your experience by picking the roles that apply to you.",
      "",
      "Click a button below to toggle a role on or off."
    ].join("\n"))
    .setColor("#4e5d94")
    .setFooter({ text: "Changes apply instantly • You can always come back to update this." })
    .setTimestamp();
  for (const [_, { label, role }] of Object.entries(config.ReactionRoles)) embed.addFields({ name: label, value: `<@&${role}>`, inline: true });
  const buttons = Object.entries(config.ReactionRoles).map(([_, { label, role }]) =>
    new ButtonBuilder()
      .setCustomId(`role_${role}`)
      .setLabel(label)
      .setStyle(ButtonStyle.Secondary)
  );
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  if (existing) await existing.edit({ embeds: [embed], components: rows });
  else await channel.send({ embeds: [embed], components: rows });
  log(`[reactionRole.js] registered.`, "success");
};

export default setupReactionRoles;