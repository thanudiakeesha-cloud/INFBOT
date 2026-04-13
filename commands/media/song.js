const axios = require('axios');
const yts = require('yt-search');
const APIs = require('../../utils/api');

const DL_API = 'https://api.qasimdev.dpdns.org/api/loaderto/download';
const API_KEY = process.env.SONG_DOWNLOAD_API_KEY || 'xbps-install-Syu';
const YT_REGEX = /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|v\/|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/;
const wait = (ms) => new Promise(r => setTimeout(r, ms));

function normalizeYouTubeUrl(input) {
    const match = String(input || '').match(YT_REGEX);
    return match ? `https://www.youtube.com/watch?v=${match[1]}` : input;
}

function extractAudio(data) {
    const item = data?.data || data?.result || data;
    const downloadUrl =
        item?.downloadUrl ||
        item?.download ||
        item?.download_url ||
        item?.dl ||
        item?.url;
    if (!downloadUrl) return null;
    return {
        downloadUrl,
        title: item?.title || item?.name || 'song',
        thumbnail: item?.thumbnail || item?.thumb
    };
}

const downloadWithLoader = async (url, retries = 1) => {
    for (let i = 0; i < retries; i++) {
        try {
            const { data } = await axios.get(DL_API, {
                params: { apiKey: API_KEY, format: 'mp3', url: normalizeYouTubeUrl(url) },
                timeout: 90000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json, */*'
                }
            });
            const audio = extractAudio(data);
            if (audio) return audio;
            throw new Error('No download URL');
        }
        catch (err) {
            if (i === retries - 1)
                throw err;
            console.log(`Download attempt ${i + 1} failed, retrying in 5s...`);
            await wait(5000);
        }
    }
    throw new Error('All download attempts failed');
};

const downloadWithFallbacks = async (url) => {
    const normalizedUrl = normalizeYouTubeUrl(url);
    const sources = [
        () => downloadWithLoader(normalizedUrl),
        async () => {
            const result = await APIs.getEliteProTechDownloadByUrl(normalizedUrl);
            return extractAudio(result);
        },
        async () => {
            const result = await APIs.getYupraDownloadByUrl(normalizedUrl);
            return extractAudio(result);
        },
        async () => {
            const result = await APIs.getOkatsuDownloadByUrl(normalizedUrl);
            return extractAudio(result);
        },
        async () => {
            const { data } = await axios.get('https://api.qasimdev.dpdns.org/api/youtube/download', {
                params: { apiKey: 'qasim-dev', url: normalizedUrl, format: 'mp3' },
                timeout: 60000,
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json, */*' }
            });
            return extractAudio(data);
        }
    ];

    const errors = [];
    for (const source of sources) {
        try {
            const audio = await source();
            if (audio?.downloadUrl) return audio;
        } catch (err) {
            errors.push(err.message);
        }
    }
    throw new Error(errors[0] || 'No download URL');
};

module.exports = {
    name: 'song',
    command: 'song',
    aliases: ['music', 'audio', 'mp3'],
    category: 'music',
    description: 'Download song from YouTube (MP3)',
    usage: '.song <song name | youtube link>',
    async handler(sock, message, args, context) {
        const chatId = context.chatId || message.key.remoteJid;
        const query = args.join(' ').trim();
        if (!query)
            return sock.sendMessage(chatId, { text: '🎵 *Song Downloader*\n\nUsage:\n.song <song name | YouTube link>' }, { quoted: message });
        try {
            let video;
            if (YT_REGEX.test(query)) {
                video = { url: normalizeYouTubeUrl(query) };
            }
            else {
                const { videos } = await yts(query);
                if (!videos?.length)
                    return sock.sendMessage(chatId, { text: '❌ No results found.' }, { quoted: message });
                video = videos[0];
            }
            if (video.thumbnail) {
                await sock.sendMessage(chatId, {
                    image: { url: video.thumbnail },
                    caption: `🎶 *${video.title || query}*\n⏱ ${video.timestamp || ''}\n\n⏳ Downloading... *(may take up to 30s)*`
                }, { quoted: message });
            }
            const audio = await downloadWithFallbacks(video.url);
            await sock.sendMessage(chatId, {
                audio: { url: audio.downloadUrl },
                mimetype: 'audio/mpeg',
                fileName: `${audio.title || video.title || 'song'}.mp3`,
                ptt: false
            }, { quoted: message });
        }
        catch (err) {
            console.error('Song plugin error:', err.message);
            const reason = err.response?.status === 408
                ? 'Download timed out. Try again.'
                : err.message;
            await sock.sendMessage(chatId, { text: `❌ Failed: ${reason}` }, { quoted: message });
        }
    }
};
