const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { PassThrough } = require('stream');
const axios = require('axios');

ffmpeg.setFfmpegPath(ffmpegPath);

const YT_REGEX = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|v\/|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/;

async function getAudioBuffer(videoUrl) {
  return new Promise((resolve, reject) => {
    const audioStream = ytdl(videoUrl, {
      quality: 'highestaudio',
      filter: 'audioonly',
      requestOptions: {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      }
    });

    const passThrough = new PassThrough();
    const chunks = [];

    ffmpeg(audioStream)
      .setFfmpegPath(ffmpegPath)
      .audioCodec('libmp3lame')
      .audioBitrate(128)
      .format('mp3')
      .on('error', reject)
      .pipe(passThrough, { end: true });

    passThrough.on('data', chunk => chunks.push(chunk));
    passThrough.on('end', () => resolve(Buffer.concat(chunks)));
    passThrough.on('error', reject);

    const timeout = setTimeout(() => reject(new Error('Conversion timeout')), 90000);
    passThrough.on('end', () => clearTimeout(timeout));
  });
}

module.exports = {
  name: 'play',
  aliases: ['plays'],
  category: 'media',
  description: 'Search and download a song as MP3 from YouTube',
  usage: '.play <song name>',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;
    const query = args.join(' ').trim();

    if (!query)
      return sock.sendMessage(chatId, {
        text: '*Which song do you want to play?*\nUsage: .play <song name>'
      }, { quoted: msg });

    try {
      await sock.sendMessage(chatId, { text: '🔍 *Searching...*' }, { quoted: msg });

      let video;
      if (YT_REGEX.test(query)) {
        const info = await ytdl.getInfo(query);
        const ytId = query.match(YT_REGEX)?.[1];
        video = {
          url: query,
          title: info.videoDetails.title,
          timestamp: new Date(parseInt(info.videoDetails.lengthSeconds) * 1000).toISOString().substr(11, 8).replace(/^00:/, ''),
          author: { name: info.videoDetails.author?.name || '' },
          thumbnail: ytId ? `https://i.ytimg.com/vi/${ytId}/sddefault.jpg` : null
        };
      } else {
        const { videos } = await yts(query);
        if (!videos?.length)
          return sock.sendMessage(chatId, { text: '❌ *No results found!*' }, { quoted: msg });
        const v = videos[0];
        video = { url: v.url, title: v.title, timestamp: v.timestamp, author: v.author, thumbnail: v.thumbnail };
      }

      await sock.sendMessage(chatId, {
        text: `✅ *Found:* ${video.title}\n⏱️ ${video.timestamp}\n👤 ${video.author?.name || ''}\n\n⏳ *Downloading... (10–30s)*`
      }, { quoted: msg });

      const audioBuffer = await getAudioBuffer(video.url);

      let thumbnailBuffer;
      if (video.thumbnail) {
        try {
          const img = await axios.get(video.thumbnail, { responseType: 'arraybuffer', timeout: 10000 });
          thumbnailBuffer = Buffer.from(img.data);
        } catch { }
      }

      await sock.sendMessage(chatId, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${(video.title || 'song').replace(/[^\w\s-]/g, '').trim()}.mp3`,
        contextInfo: thumbnailBuffer ? {
          externalAdReply: {
            title: video.title,
            body: `${video.author?.name || ''} • ${video.timestamp}`,
            thumbnail: thumbnailBuffer,
            mediaType: 2,
            sourceUrl: video.url
          }
        } : undefined
      }, { quoted: msg });

    } catch (err) {
      console.error('Play error:', err.message);
      const isConnErr = err.message?.includes('Connection Closed') || err.message?.includes('Connection Reset') || err.output?.statusCode === 428;
      if (isConnErr) return;
      try {
        await sock.sendMessage(chatId, {
          text: `❌ *Failed:* ${err.message}`
        }, { quoted: msg });
      } catch (_) {}
    }
  }
};
