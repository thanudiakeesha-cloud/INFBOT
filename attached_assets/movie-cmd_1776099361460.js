const axios = require('axios');
const { cmd } = require('../lib/command');
const bot = require('../lib/bot')
//=================Movie Dl Link=======================
cmd({
    pattern: "film",
    alias: ["moviedl"],
    react: "🎬",
    desc: "🎥 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱 𝗠𝗼𝘃𝗶𝗲𝘀",
    category: "📁 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱",
    filename: __filename
},
async (conn, mek, m, { from, quoted, q, reply, sender }) => {
    try {
        if (!q) return reply("❌ *𝙋𝙡𝙚𝙖𝙨𝙚 𝙥𝙧𝙤𝙫𝙞𝙙𝙚 𝙖 𝙈𝙊𝙑𝙄𝙀 𝙉𝘼𝙈𝙀!* ❌");

        const res = await fetch(`https://suhas-bro-apii.vercel.app/movie?query=${encodeURIComponent(q)}`);
        const data = await res.json();
        
        if (!data.status === 'success' || !data.data || !data.data.length) {
            return reply("❌ *𝙁𝙖𝙞𝙡𝙚𝙙 𝙩𝙤 𝙛𝙚𝙩𝙘𝙝 𝙢𝙤𝙫𝙞𝙚 𝙞𝙣𝙛𝙤.* ❌");
        }

        const movie = data.data[0];
        
        const movieDetails = {
            mentionedJid: [sender],
            forwardingScore: 1000,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: '',
                newsletterName: "DEW-MD",
                serverMessageId: 143,
            },
        };

        let desc = `
╭═══〘 *🎬 𝗠𝗢𝗩𝗜𝗘 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗* 〙═══⊷❍
┃ 🎬 *𝙈𝙤𝙫𝙞𝙚 𝙏𝙞𝙩𝙡𝙚:*  *『 ${movie.movieName} 』*
┃ 🎥 *𝙔𝙚𝙖𝙧:* *『 ${movie.year} 』*
┃ ⭐ *𝙄𝙈𝘿𝙗 𝙍𝙖𝙩𝙞𝙣𝙜:* *『 ${movie.imdbRating} 』*
┃ 📥 *𝘿𝙤𝙬𝙣𝙡𝙤𝙖𝙙 𝙎𝙩𝙖𝙧𝙩𝙚𝙙...*
╰──━──━──━──━──━──━──━──━──━─╯

*${bot.COPYRIGHT}*`;

        // Send the movie thumbnail and info
        await conn.sendMessage(
            from, 
            { 
                image: { url: movie.thumbnail }, 
                caption: desc,
                contextInfo: movieDetails
            }, 
            { quoted: mek }
        );

        // Send the download link
        await conn.sendMessage(
            from, 
            { 
                text: `🎬 *𝗠𝗢𝗩𝗜𝗘 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗*\n\n🎥 *Movie Name:* *『 ${movie.movieName} 』*\n🎬 *Download Link:* ${movie.link}\n\n*${bot.COPYRIGHT}*`, 
                contextInfo: movieDetails
            }, 
            { quoted: mek }
        );
        
    } catch (e) {
        console.error(e);
        reply("❌ *𝘼𝙣 𝙚𝙧𝙧𝙤𝙧 𝙤𝙘𝙘𝙪𝙧𝙧𝙚𝙙 𝙬𝙝𝙞𝙡𝙚 𝙛𝙚𝙩𝙘𝙝𝙞𝙣𝙜 𝙩𝙝𝙚 𝙢𝙤𝙫𝙞𝙚.* ❌");
    }
});

cmd({
    pattern: "movie",
    desc: "Fetch detailed information about a movie.",
    category: "movie",
    react: "🎞️",
    filename: __filename
}, async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        const movieName = args.join(' ');
        if (!movieName) {
            return reply("📽️ Please provide the name of the movie.");
        }

        const apiUrl = `http://www.omdbapi.com/?t=${encodeURIComponent(movieName)}&apikey=76cb7f39`;
        const response = await axios.get(apiUrl);
        const data = response.data;

        if (data.Response === "False") {
            return reply("! Movie not found.");
        }

        const movieInfo = `
*🎬 DEW-MD 🎬*

*ᴛɪᴛʟᴇ:* ${data.Title}
*ʏᴇᴀʀ:* ${data.Year}
*ʀᴀᴛᴇᴅ:* ${data.Rated}
*ʀᴇʟᴇᴀꜱᴇᴅ:* ${data.Released}
*ʀᴜɴᴛɪᴍᴇ:* ${data.Runtime}
*ɢᴇɴʀᴇ:* ${data.Genre}
*ᴅɪʀᴇᴄᴛᴏʀ:* ${data.Director}
*ᴡʀɪᴛᴇʀ:* ${data.Writer}
*ᴀᴄᴛᴏʀꜱ:* ${data.Actors}
*ʟᴀɴɢᴜᴀɢᴇ:* ${data.Language}
*ᴄᴏᴜɴᴛʀʏ:* ${data.Country}
*ᴀᴡᴀʀᴅꜱ:* ${data.Awards}
*ɪᴍᴅʙ ʀᴀᴛɪɴɢ:* ${data.imdbRating}
`;

        const imageUrl = data.Poster && data.Poster !== 'N/A' ? data.Poster : bot.ALIVE_IMG;

        await conn.sendMessage(from, {
            image: { url: imageUrl },
            caption: `${movieInfo}\n*${bot.COPYRIGHT}*`
        }, { quoted: mek });
    } catch (e) {
        console.error(e);
        reply(`❌ Error: ${e.message}`);
    }
});
