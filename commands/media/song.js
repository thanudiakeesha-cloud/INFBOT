const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { PassThrough } = require('stream');

ffmpeg.setFfmpegPath(ffmpegPath);

const YT_REGEX = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|v\/|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/;

async function getAudioBuffer(videoUrl) {
  return new Promise((resolve, reject) => {
    const audioStream = ytdl(videoUrl, {
      quality: 'highestaudio',
      filter: 'audioonly',
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        }
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
  name: 'song',
  aliases: ['music', 'audio', 'mp3'],
  category: 'media',
  description: 'Download song from YouTube (MP3)',
  usage: '.song <song name | youtube link>',

  async execute(sock, msg, args, extra) {
    const chatId = msg.key.remoteJid;
    const query = args.join(' ').trim();

    if (!query)
      return sock.sendMessage(chatId, {
        text: '🎵 *Song Downloader*\n\nUsage:\n.song <song name | YouTube link>'
      }, { quoted: msg });

    try {
      let video;
      if (YT_REGEX.test(query)) {
        const info = await ytdl.getInfo(query);
        video = {
          url: query,
          title: info.videoDetails.title,
          thumbnail: info.videoDetails.thumbnails?.slice(-1)[0]?.url,
          timestamp: new Date(parseInt(info.videoDetails.lengthSeconds) * 1000).toISOString().substr(11, 8).replace(/^00:/, '')
        };
      } else {
        const { videos } = await yts(query);
        if (!videos?.length)
          return sock.sendMessage(chatId, { text: '❌ No results found.' }, { quoted: msg });
        const v = videos[0];
        video = { url: v.url, title: v.title, thumbnail: v.thumbnail, timestamp: v.timestamp };
      }

      if (video.thumbnail) {
        await sock.sendMessage(chatId, {
          image: { url: video.thumbnail },
          caption: `🎶 *${video.title}*\n⏱ ${video.timestamp || ''}\n\n⏳ Downloading... *(may take 10–30s)*`
        }, { quoted: msg });
      }

      const audioBuffer = await getAudioBuffer(video.url);

      await sock.sendMessage(chatId, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${(video.title || 'song').replace(/[^\w\s-]/g, '').trim()}.mp3`,
        ptt: false
      }, { quoted: msg });

    } catch (err) {
      console.error('Song plugin error:', err.message);
      const isConnErr = err.message?.includes('Connection Closed') || err.message?.includes('Connection Reset') || err.output?.statusCode === 428;
      if (isConnErr) return;
      try {
        await sock.sendMessage(chatId, {
          text: `❌ Failed to download: ${err.message}`
        }, { quoted: msg });
      } catch (_) {}
    }
  }
};
