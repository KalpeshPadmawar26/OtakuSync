const express = require('express');
const router = express.Router();
const axios = require('axios');

const JIKAN_API = 'https://api.jikan.moe/v4';

const normalizeAnime = (item) => {
    return {
        id: item.mal_id,
        title: item.title_english || item.title,
        image: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url,
        genres: item.genres ? item.genres.map(g => g.name) : [],
        score: item.score,
        episodes: item.episodes,
        status: item.status,
        airing: item.airing,
        aired: item.aired?.string,
        synopsis: item.synopsis,
        trailer: item.trailer?.youtube_id
    };
};

router.get('/top', async (req, res) => {
    try {
        const page = req.query.page || 1;
        const resp = await axios.get(`${JIKAN_API}/top/anime?limit=15&page=${page}`);
        const data = resp.data.data.map(normalizeAnime);
        res.json({ data, hasNextPage: resp.data.pagination.has_next_page });
    } catch (e) { res.status(500).json({ error: "Failed to fetch top anime" }); }
});

router.get('/airing', async (req, res) => {
    try {
        const page = req.query.page || 1;
        const resp = await axios.get(`${JIKAN_API}/seasons/now?limit=15&page=${page}`);
        const data = resp.data.data.map(normalizeAnime);
        res.json({ data, hasNextPage: resp.data.pagination.has_next_page });
    } catch (e) { res.status(500).json({ error: "Failed to fetch airing anime" }); }
});

router.get('/upcoming', async (req, res) => {
    try {
        const page = req.query.page || 1;
        const resp = await axios.get(`${JIKAN_API}/seasons/upcoming?limit=15&page=${page}`);
        const data = resp.data.data.map(normalizeAnime);
        res.json({ data, hasNextPage: resp.data.pagination.has_next_page });
    } catch (e) { res.status(500).json({ error: "Failed to fetch upcoming anime" }); }
});

router.get('/search', async (req, res) => {
    try {
        const q = req.query.q;
        if (!q) return res.json({ data: [] });
        const resp = await axios.get(`${JIKAN_API}/anime?q=${encodeURIComponent(q)}&limit=15`);
        const data = resp.data.data.map(normalizeAnime);
        res.json({ data });
    } catch (e) { res.status(500).json({ error: "Search failed" }); }
});

router.get('/:id', async (req, res) => {
    try {
        const resp = await axios.get(`${JIKAN_API}/anime/${req.params.id}`);
        // Fetch recommendations natively from Jikan for related section
        const relResp = await axios.get(`${JIKAN_API}/anime/${req.params.id}/recommendations`);
        
        let related = relResp.data.data.slice(0, 10).map(r => ({
            id: r.entry.mal_id,
            title: r.entry.title,
            image: r.entry.images?.jpg?.large_image_url || r.entry.images?.jpg?.image_url,
            genres: [], // Missing in rec endpoint usually, but we keep format
            score: null
        }));

        res.json({
            details: normalizeAnime(resp.data.data),
            related: related
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to fetch anime details" });
    }
});

module.exports = router;
