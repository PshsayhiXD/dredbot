export default {
  name: 'search',
  description: 'Search and find some random items.',
  aliases: ['sc', 'srch'],
  usage: '',
  category: 'item',
  perm: 0,
  cooldown: 120,
  globalCooldown: 1,
  id: 17,
  dependencies: `giveItem commandEmbed config formatTime 
                 formatAmount getRandomItemByChance 
                 commandButtonComponent Cooldown newCooldown`,
  execute: async (message, args, user, command, dep) => {
    const search = async () => {
      const baseItems = await dep.getRandomItemByChance(user, 'consumable', [1, 3], { Metadata: true, all: true });
      const foundItems = baseItems.map(item => ({
        ...item,
        amount: Math.floor(Math.random() * 4) + 1,
      }));
      if (foundItems.length === 0) {
        const embed = await dep.commandEmbed({
          title: `${dep.config.PREFIX}${command}`,
          description: `You searched around but found absolutely nothing...`,
          color: '#7a7a7aff',
          user,
          reward: false,
          message,
        });
        return { embeds: [embed] };
      }
      for (const item of foundItems) await dep.giveItem(user, `${item.type}.${item.name}`, item.amount);
      const lines = foundItems.map(item => `> • ${item.icon} **${item.name}** x${item.amount} (${item.rarity})`);
      const embed = await dep.commandEmbed({
        title: `${dep.config.PREFIX}${command}`,
        description: `**You found**\n${lines.join('\n')}`,
        color: '#00FF00',
        user,
        reward: false,
        message,
      });
      return { embeds: [embed] };
    };
    const response = await search();
    const buttons = await dep.commandButtonComponent([
      {
        label: 'Search Again',
        customId: `${command}_useagain_${user}`,
        style: 1,
        emoji: '🔁',
        onClick: async (interaction) => {
          if (interaction.user.id !== message.author.id) return;
          const cooldown = await dep.Cooldown(user, command);
          if (cooldown) {
            return interaction.reply({
              content: `⏳ You must wait **${dep.formatTime(cooldown.remaining)}** before searching again.`,
              ephemeral: true,
            });
          }
          await dep.newCooldown(user, command, 120);
          const newResult = await search();
          await interaction.update({ ...newResult });
        }
      },
      {
        label: "inventory",
        customId: `${command}_inventory_${user}`,
        style: 2,
        emoji: "🎒",
        onClick: async interaction => {
          if (interaction.user.id !== message.author.id) return;
          const label = interaction.component.label.toLowerCase().replace(/\s+/g, "");
          await dep.runCommand(message.client, message, `${dep.config.PREFIX}${label}`);
        }
      }
    ]);
    return message.reply({ ...response, components: buttons });
  }
};