export default {
  name: "balance",
  description: "view balance or another user's balance.",
  aliases: ["bal","b","bank"],
  usage: "[target]",
  category: "economy",
  perm: 0,
  cooldown: 1,
  globalCooldown: 1,
  id: 1,
  dependencies: `getDredcoin getBankBalance formatAmount parseBet
                 commandEmbed config commandButtonComponent 
                 commandModal transferDredcoin withdrawDredcoin depositDredcoin`,
  execute: async (message, args, user, command, dep) => {
    const target = args[0] ? args[0] : user;
    const wallet = await dep.getDredcoin(target);
    const bank = await dep.getBankBalance(target);
    const embed = await dep.commandEmbed({
      title: `${dep.config.PREFIX}${command}`,
      description: `**${target}'s** Wallet: **\`${await dep.formatAmount(wallet)}${dep.config.CURRENCY_SYMBOL}\`**.\n` +
                   `🏛 Bank: **\`${await dep.formatAmount(bank)}${dep.config.CURRENCY_SYMBOL}\`**.`,
      color: "#00FF00",
      user,
      reward: false,
      message
    });
    const rows = await dep.commandButtonComponent([
      {
        label: "Deposit",
        customId: `${command}_deposit_${user}`,
        style: 1,
        emoji: "🏛",
        onClick: async (i) => {
          if (i.user.id !== message.author.id) return;
          const modal = await dep.commandModal({
            title: "Deposit Dredcoin",
            customId: `${command}_deposit_modal_${user}`,
            inputs: [
              { label: "Amount", customId: `${command}_deposit_amount_${user}`, style: 1 }
            ],
            onSubmit: async (mi) => {
              const b = await dep.getBankBalance(user);
              const { err, amount } = await dep.parseBet(mi.fields.getTextInputValue(`${command}_deposit_amount_${user}`), b);
              if (err) return mi.reply({ content: `❌ Error ${err}`, ephemeral: true });
              if (isNaN(amount) || amount <= 0) return mi.reply({ content: "❌ Invalid amount.", ephemeral: true });
              await dep.depositDredcoin(user, amount);
              return mi.reply({ content: `✅ Deposited **\`${amount}${dep.config.CURRENCY_SYMBOL}\`**.`, ephemeral: true });
            }
          });
          await i.showModal(modal);
        }
      },
      {
        label: "Withdraw",
        customId: `${command}_withdraw_${user}`,
        style: 2,
        emoji: "📩",
        onClick: async (i) => {
          if (i.user.id !== message.author.id) return;
          const modal = await dep.commandModal({
            title: "Withdraw Dredcoin",
            customId: `${command}_withdraw_modal_${user}`,
            inputs: [
              { label: "Amount", customId: `${command}_withdraw_amount_${user}`, style: 1 }
            ],
            onSubmit: async (mi) => {
              const w = await dep.getDredcoin(user);
              const { err, amount } = await dep.parseBet(mi.fields.getTextInputValue(`${command}_withdraw_amount_${user}`), w);
              if (err) return mi.reply({ content: `❌ Error ${err}`, ephemeral: true });
              if (isNaN(amount) || amount <= 0) return mi.reply({ content: "❌ Invalid amount.", ephemeral: true });
              await dep.withdrawDredcoin(user, amount);
              return mi.reply({ content: `✅ Withdrew **\`${amount}${dep.config.CURRENCY_SYMBOL}\`**.`, ephemeral: true });
            }
          });
          await i.showModal(modal);
        }
      },
      {
        label: "Give To",
        customId: `${command}_giveto_${user}`,
        style: 3,
        emoji: "📤",
        onClick: async (i) => {
          if (i.user.id !== message.author.id) return;
          const modal = await dep.commandModal({
            title: "Give Dredcoin",
            customId: `${command}_give_modal_${user}`,
            inputs: [
              { label: "User", customId: `${command}_give_user_${user}`, style: 1 },
              { label: "Amount", customId: `${command}_give_amount_${user}`, style: 1 }
            ],
            onSubmit: async (mi) => {
              const w = await dep.getDredcoin(user);
              const recipient = mi.fields.getTextInputValue(`${command}_giveto_user_${user}`);
              const { err, amount } = await dep.parseBet(mi.fields.getTextInputValue(`${command}_giveto_amount_${user}`), w);
              if (err) return mi.reply({ content: `❌ Error ${err}`, ephemeral: true });
              if (isNaN(amount) || amount <= 0) return mi.reply({ content: "❌ Invalid amount.", ephemeral: true });
              await dep.transferDredcoin(user, recipient, amount);
              return mi.reply({ content: `✅ You gave **\`${amount}${dep.config.CURRENCY_SYMBOL}\`** to **\`${recipient}\`**.`, ephemeral: true });
            }
          });
          await i.showModal(modal);
        }
      }
    ]);
    return message.reply({ embeds: [embed], components: rows });
  }
};