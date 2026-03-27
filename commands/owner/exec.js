const { exec } = require('child_process');

module.exports = {
  name: 'exec',
  aliases: ['shell', 'sh', '$'],
  category: 'owner',
  description: 'Execute a shell command (owner only)',
  usage: '.exec <command>',
  ownerOnly: true,

  async execute(sock, msg, args, extra) {
    if (!args.length) {
      return extra.reply('❌ Please provide a command to execute!\nUsage: .exec <command>');
    }

    const command = args.join(' ');

    await extra.reply(`⏳ Executing: \`${command}\``);

    exec(command, { timeout: 30000, maxBuffer: 1024 * 1024 }, async (error, stdout, stderr) => {
      try {
        let output = '';

        if (stdout) output += `*stdout:*\n\`\`\`${stdout.substring(0, 3000)}\`\`\`\n`;
        if (stderr) output += `*stderr:*\n\`\`\`${stderr.substring(0, 1000)}\`\`\`\n`;
        if (error) output += `*Error:*\n\`\`\`${error.message.substring(0, 1000)}\`\`\``;

        if (!output) output = '✅ Command executed with no output.';

        await extra.reply(output);
      } catch (e) {
        await extra.reply(`❌ Error sending output: ${e.message}`);
      }
    });
  }
};
