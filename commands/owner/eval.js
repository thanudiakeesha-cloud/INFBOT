module.exports = {
  name: 'eval',
  aliases: ['ev', 'evaluate'],
  category: 'owner',
  description: 'Evaluate JavaScript code (owner only)',
  usage: '.eval <code>',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    if (!args.length) {
      return extra.reply('❌ Please provide code to evaluate!\nUsage: .eval <code>');
    }

    const code = args.join(' ');

    try {
      let result = eval(code);

      if (result instanceof Promise) {
        result = await result;
      }

      if (typeof result !== 'string') {
        result = require('util').inspect(result, { depth: 3 });
      }

      if (result.length > 3000) {
        result = result.substring(0, 3000) + '\n... (truncated)';
      }

      await extra.reply(`✅ *Result:*\n\n${result}`);
    } catch (error) {
      await extra.reply(`❌ *Error:*\n\n${error.message}`);
    }
  }
};
