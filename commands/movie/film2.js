const cheerio = require('cheerio');
const fetch = require('node-fetch');

const getdl = async (url) => {
    const types = [
        { name: 'gdrive', type: { gdrive: true } },
        { name: 'gdrive2', type: { gdrive: true, second: true } },
        { name: 'direct', type: { direct: true } },
        { name: 'pixeldrain', type: { pix: true } },
        { name: 'pixeldrain2', type: { pix: true, nc: true } },
    ];

    const results = [];

    try {
        for (const { name, type } of types) {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(type),
            });

            if (!response.ok) continue;

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) continue;

            const data = await response.json();
            results.push({ [name]: data });
        }

        return results;
    } catch (e) {
        console.error('Error in getdl:', e.message);
        return null;
    }
};

const cinedl = async (url) => {
    if (!url) throw new Error('URL parameter is required');

    try {
        let primaryDownloadLink = url;

        if (url.startsWith('https://cinesubz.net/api')) {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.text();
            const $ = cheerio.load(data);
            primaryDownloadLink = $('#link').attr('href');

            if (!primaryDownloadLink) {
                throw new Error('Download link not found in API response');
            }
        }

        const serverMap = [
            {
                search: [
                    'https://google.com/server11/1:/',
                    'https://google.com/server12/1:/',
                    'https://google.com/server13/1:/',
                ],
                replace: 'https://drive2.cscloud12.online/server1/',
            },
            {
                search: [
                    'https://google.com/server21/1:/',
                    'https://google.com/server22/1:/',
                    'https://google.com/server23/1:/',
                ],
                replace: 'https://drive2.cscloud12.online/server2/',
            },
            {
                search: ['https://google.com/server3/1:/'],
                replace: 'https://drive2.cscloud12.online/server3/',
            },
            {
                search: ['https://google.com/server4/1:/'],
                replace: 'https://drive2.cscloud12.online/server4/',
            },
            {
                search: ['https://google.com/server5/1:/'],
                replace: 'https://drive2.cscloud12.online/server5/',
            },
        ];

        for (const mapping of serverMap) {
            for (const searchUrl of mapping.search) {
                if (primaryDownloadLink.includes(searchUrl)) {
                    primaryDownloadLink = primaryDownloadLink.replace(searchUrl, mapping.replace);
                    break;
                }
            }
        }

        if (primaryDownloadLink.includes('.mp4?bot=cscloud2bot&code=')) {
            primaryDownloadLink = primaryDownloadLink.replace('.mp4?bot=cscloud2bot&code=', '?ext=mp4&bot=cscloud2bot&code=');
        } else if (primaryDownloadLink.includes('.mp4')) {
            primaryDownloadLink = primaryDownloadLink.replace('.mp4', '?ext=mp4');
        } else if (primaryDownloadLink.includes('.mkv?bot=cscloud2bot&code=')) {
            primaryDownloadLink = primaryDownloadLink.replace('.mkv?bot=cscloud2bot&code=', '?ext=mkv&bot=cscloud2bot&code=');
        } else if (primaryDownloadLink.includes('.mkv')) {
            primaryDownloadLink = primaryDownloadLink.replace('.mkv', '?ext=mkv');
        } else if (primaryDownloadLink.includes('.zip')) {
            primaryDownloadLink = primaryDownloadLink.replace('.zip', '?ext=zip');
        }

        if (primaryDownloadLink.includes('srilank222')) {
            primaryDownloadLink = primaryDownloadLink.replace('srilank222', 'srilanka2222');
        }
        if (primaryDownloadLink.includes('https://tsadsdaas.me/')) {
            primaryDownloadLink = primaryDownloadLink.replace('https://tsadsdaas.me/', 'http://tdsdfasdaddd.me/');
        }

        return await getdl(primaryDownloadLink);
    } catch (error) {
        console.error('Error in cinedl:', error.message);
        throw error;
    }
};

module.exports = { 
    name: 'film2',
    category: 'movie',
    desc: 'Download movies from Cinesubz directly to chat',
    async execute(sock, msg, args, extra) {
        if (!args[0]) return extra.reply('Please provide a Cinesubz URL');
        
        await extra.reply('📥 *Infinity MD is fetching your movie... Please wait.*');
        
        try {
            const results = await cinedl(args[0]);
            if (!results || results.length === 0) return extra.reply('No download links found.');
            
            // Try to find a direct or pixeldrain link for auto-upload
            let downloadUrl = null;
            let fileName = 'movie.mp4';
            
            // Priority: direct > pixeldrain > others
            const priority = ['direct', 'pixeldrain', 'pixeldrain2', 'gdrive', 'gdrive2'];
            
            for (const type of priority) {
                const found = results.find(res => res[type] && res[type].url);
                if (found) {
                    downloadUrl = found[type].url;
                    break;
                }
            }

            if (!downloadUrl) {
                return extra.reply('Could not find a direct download link for automatic upload. Please use the links from .cinesubz command.');
            }

            // Sending document (movie) to chat
            await sock.sendMessage(extra.from, { 
                document: { url: downloadUrl }, 
                fileName: fileName,
                mimetype: 'video/mp4',
                caption: '> *ᴘᴏᴡᴇʀᴇᴅ ʙʏ Infinity MD*'
            }, { quoted: msg });

        } catch (e) {
            extra.reply('Error: ' + e.message);
        }
    }
};
