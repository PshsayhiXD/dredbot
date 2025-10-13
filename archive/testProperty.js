export default {
  name: 'a',
  description: 'e',
  aliases: ['s'],
  usage: '',
  category: 'g',
  perm: 0,
  cooldown: 1,
  globalCooldown: 86400,
  id: 299,
  execute: async (message, args, user, command, { helper, config, commandUsage }) => {
    const xpAmount = Math.floor(Math.random() * (100 - 10 + 1)) + 10;
    const xp = await helper.giveExp(user, xpAmount);
    let levelUpMsg = '';
    if (xp.oldLevel !== xp.newLevel) levelUpMsg = `\n **Level Up!** You are now level ${xp.newLevel}!`;
    const embed = await commandUsage.commandEmbed({
      title: `${config.PREFIX}${command}`,
      description: `🎉 You've claimed +${xp.gained} (${xp.newExp}/${xp.newExpNeeded}) Exp.` + 
                   `\n${levelUpMsg}`,
      user: user,
      reward: false,
      message,
    });
    message.reply({ embeds: [embed] });
    if (args && args.length > 0) {
      const arg = args[0];
      if (arg.startsWith('-')) {
        const withoutminus = parseInt(arg.replace('-', ''));
        const a = await helper.removeExp(user, withoutminus);
        const embed = await commandUsage.commandEmbed({
          title: `${config.PREFIX}${command}`,
          description: `-${withoutminus} (${a.newExp}/${a.newExpNeeded}) ${a.newLevel}.`,
          user: user,
          reward: false,
          message,
        });
        return message.reply({ embeds: [embed] });
      }
      if (arg.startsWith('+')) {
        const withoutplus = parseInt(arg.replace('+', ''));
        const a = await helper.giveExp(user, withoutplus);
        const embed = await commandUsage.commandEmbed({
          title: `${config.PREFIX}${command}`,
          description: `+${withoutplus} (${a.newExp}/${a.newExpNeeded}) ${a.newLevel}.`,
          user: user,
          reward: false,
          message,
        });
        return message.reply({ embeds: [embed] });
      }
      if (arg.startsWith('l')) {
        const level = parseInt(arg.replace('l', ''));
        const a = await helper.levelUp(user, level);
        const embed = await commandUsage.commandEmbed({
          title: `${config.PREFIX}${command}`,
          description: `${a.newLevel} (${a.newExp}/${a.newExpNeeded}).`,
          user: user,
          reward: false,
          message,
        });
        return message.reply({ embeds: [embed] });
      }
      if (arg.startsWith('p')) {
        const prestige = parseInt(arg.replace('p', ''));
        const a = await helper.prestige(user, prestige);
        const embed = await commandUsage.commandEmbed({
          title: `${config.PREFIX}${command}`,
          description: `${a.newPrestige} (${a.newExp}/${a.newExpNeeded}).`,
          user: user,
          reward: false,
          message,
        });
        return message.reply({ embeds: [embed] });
      }
    }
  },
};
