export default {
  name: 'gamble',
  description: 'Gamble your Dredcoin.',
  aliases: [],
  usage: '<bet>',
  category: 'gambling',
  perm: 0,
  cooldown: 10,
  globalCooldown: 0,
  id: 56,
  dependencies: `commandEmbed formatAmount config parseAmount randomNumber parseBet scheduleDelete
                 addDredcoin removeDredcoin loadData gambleStreak getGambleStreak getDredcoin`,
  execute: async (message, args, user, command, dep) => {
    const data = await dep.loadData(user);
    const balance = await dep.getDredcoin(user);
    const { bet, err } = await dep.parseBet(args[0], balance);
    if (err || bet <= 0) {
      const embed = await dep.commandEmbed({
        title: `${dep.config.PREFIX}${command} ${args[0] || ""}`,
        description: `${err || "❔"}\n` + 
                     `💰 Balance: **\`${dep.formatAmount(balance)}${dep.config.CURRENCY_SYMBOL}\`**.`,
        color: "#FF0000",
        user,
        reward: false,
        message,
      });
      const reply = await message.reply({ embeds: [embed] });
      return await dep.scheduleDelete(reply.client, reply.channel.id, reply.id);
    }
    await dep.removeDredcoin(user, bet);
    const outcomes = [
      { m: 5, text: a => `⚡ **Jackpot!** You won **\`${dep.formatAmount(a)}${dep.config.CURRENCY_SYMBOL}\`**!`, color: '#FFD700' },
      { m: 3, text: a => `🔥 **Triple win**! You won **\`${dep.formatAmount(a)}${dep.config.CURRENCY_SYMBOL}\`**!`, color: '#FFA500' },
      { m: 2, text: a => `💰 **Double up**! You won **\`${dep.formatAmount(a)}${dep.config.CURRENCY_SYMBOL}\`**!`, color: '#00FF00' },
      { m: 1.5, text: a => `⭐ **1.5x win**! You won **\`${dep.formatAmount(a)}${dep.config.CURRENCY_SYMBOL}\`**!`, color: '#32CD32' },
      { m: 1, text: a => `**Broke even** with **\`${dep.formatAmount(a)}${dep.config.CURRENCY_SYMBOL}\`**.`, color: '#FFFF00' },
      { m: 0.5, text: a => `**Half loss**: **\`${dep.formatAmount(a)}${dep.config.CURRENCY_SYMBOL}\`** gone.`, color: '#FF4500' },
      { m: 0.25, text: a => `**Quarter left**! Lost **\`${dep.formatAmount(Math.floor(bet * 0.75))}${dep.config.CURRENCY_SYMBOL}\`**.`, color: '#B22222' },
      { m: 0, text: () => `**Lost everything**.. **\`${dep.formatAmount(bet)}${dep.config.CURRENCY_SYMBOL}\`**..`, color: '#FF0000' },
    ];
    const weights = [0.001, 0.004, 0.015, 0.03, 0.15, 0.3, 0.25, 0.25];
    const r = dep.randomNumber();
    let acc = 0,
      chosen = outcomes[outcomes.length - 1];
      for (let i = 0; i < outcomes.length; i++) {
      acc += weights[i];
      if (r < acc) {
        chosen = outcomes[i];
        break;
      }
    }
    const embed = await dep.commandEmbed({
      title: `${dep.config.PREFIX}${command} ${bet}`,
      description: '🎲 **Gambling...**',
      color: '#808080',
      user,
      reward: false,
      message,
    });
    const msg = await message.reply({ embeds: [embed] });
    let steps = Math.floor(dep.randomNumber() * 6) + 5;
    let c = 0;
    const animate = async () => {
      if (c < steps) {
        const fake = outcomes[Math.floor(dep.randomNumber() * outcomes.length)];
        const embed = await dep.commandEmbed({
          title: `${dep.config.PREFIX}${command} ${bet}`,
          description: `🎲 **Rolling...**\n` + (typeof fake.text === 'function' ? (fake.m === 0 ? fake.text() : fake.text(Math.floor(bet * fake.m))) : ''),
          color: fake.color,
          user,
          reward: false,
          message,
        });
        await msg.edit({ embeds: [embed] });
        c++;
        setTimeout(animate, 150 + c * 20);
      } else {
        const amt = Math.floor(bet * chosen.m);
        let newBalance = null;
        if (amt > 0) {
          const r = await dep.addDredcoin(user, amt);
          newBalance = r.newBalance;
        } else {
          const r = await dep.removeDredcoin(user, bet);
          newBalance = r.newBalance;
        }
        await dep.gambleStreak(user, chosen.m >= 2);
        const streak = await dep.getGambleStreak(user);
        const embed = await dep.commandEmbed({
          title: `${dep.config.PREFIX}${command} ${bet}`,
          description: `${chosen.text(amt)}\n` +
                       `💰 Balance: **\`${dep.formatAmount(newBalance)}\`**.\n` +
                       `🔥 Streak: **\`${streak}\`**.`,
          color: chosen.color,
          user,
          reward: false,
          message,
        });
        await msg.edit({ embeds: [embed] });
      }
    };
    animate();
  },
};
