const { baiscopelkdownload } = require('baiscopelk-api');

module.exports = {
    name: 'moviedl',
    aliases: ['subdl', 'baiscopedl', 'subtitledl'],
    category: 'movie',
    description: 'Download Sinhala subtitles from a baiscope.lk movie URL',
    usage: '.moviedl <baiscope.lk url>',

    async execute(sock, msg, args, extra) {
        try {
            if (args.length === 0) {
                return extra.reply(
                    '❌ Please provide a baiscope.lk movie URL.\n\n' +
                    '📌 Usage: *.moviedl <url>*\n' +
                    'Example: *.moviedl https://www.baiscope.lk/avengers-endgame-2019-sinhala-subtitles/*\n\n' +
                    '💡 Use *.movie <name>* to search for a movie first.'
                );
            }

            const url = args[0];

            if (!url.includes('baiscope.lk')) {
                return extra.reply('❌ Please provide a valid baiscope.lk URL.\nExample: https://www.baiscope.lk/movie-name/');
            }

            await extra.react('⏳');
            await extra.reply('📥 *Fetching subtitle download link... Please wait.*');

            let data;
            try {
                data = await baiscopelkdownload(url);
            } catch (err) {
                return extra.reply('❌ Failed to fetch subtitle. The page may not be available or the URL is incorrect.');
            }

            if (!data) {
                return extra.reply('❌ No subtitle found for the given URL.');
            }

            if (data.download) {
                let text = `╭━━〔 📥 SUBTITLE DOWNLOAD 〕━━⬣\n`;
                text += `┃ 🎬 *Subtitle found!*\n┃\n`;
                if (data.title) text += `┃ 📽️ *Title:* ${data.title}\n┃\n`;
                text += `┃ 🔗 *Download Link:*\n┃ ${data.download}\n`;
                text += `╰━━━━━━━━━━━━━━━━━━━━⬣\n\n`;
                text += `> *INFINITY MD*`;

                await extra.reply(text);
            } else if (typeof data === 'string' && data.startsWith('http')) {
                let text = `╭━━〔 📥 SUBTITLE DOWNLOAD 〕━━⬣\n`;
                text += `┃ 🔗 *Download Link:*\n┃ ${data}\n`;
                text += `╰━━━━━━━━━━━━━━━━━━━━⬣\n\n`;
                text += `> *INFINITY MD*`;

                await extra.reply(text);
            } else {
                let text = `╭━━〔 📥 SUBTITLE INFO 〕━━⬣\n`;
                text += `┃ *Result:*\n┃ ${JSON.stringify(data, null, 2)}\n`;
                text += `╰━━━━━━━━━━━━━━━━━━━━⬣\n\n`;
                text += `> *INFINITY MD*`;

                await extra.reply(text);
            }

        } catch (error) {
            await extra.reply(`❌ Error: ${error.message}`);
        }
    }
};
