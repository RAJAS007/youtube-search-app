import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        if (!url.includes('spotify.com')) {
            return res.status(400).json({ error: 'Invalid Spotify URL' });
        }

        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        let title = $('title').text()
            .replace('| Spotify', '')
            .replace('- song by', '-')
            .replace(' - Spotify', '')
            .trim();

        res.status(200).json({ title });

    } catch (error) {
        console.error('Resolve error:', error.message);
        res.status(500).json({ error: 'Could not resolve Spotify track' });
    }
}
