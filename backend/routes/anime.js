const express = require('express');
const router = express.Router();
const axios = require('axios');

const JIKAN_API = 'https://api.jikan.moe/v4';

// 1-minute API Cache
const apiCache = new Map();
const fetchWithCache = async (url) => {
    if(apiCache.has(url)) {
        if(Date.now() - apiCache.get(url).time < 60000) return apiCache.get(url).data;
    }
    const res = await axios.get(url);
    apiCache.set(url, { time: Date.now(), data: res });
    return res;
};

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
        const resp = await fetchWithCache(`${JIKAN_API}/top/anime?limit=15&page=${page}`);
        const data = resp.data.data.map(normalizeAnime);
        res.json({ data, hasNextPage: resp.data.pagination.has_next_page });
    } catch (e) { res.status(500).json({ error: "Failed to fetch top anime" }); }
});

router.get('/airing', async (req, res) => {
    try {
        const page = req.query.page || 1;
        const resp = await fetchWithCache(`${JIKAN_API}/seasons/now?limit=15&page=${page}`);
        const data = resp.data.data.map(normalizeAnime);
        res.json({ data, hasNextPage: resp.data.pagination.has_next_page });
    } catch (e) { res.status(500).json({ error: "Failed to fetch airing anime" }); }
});

router.get('/upcoming', async (req, res) => {
    try {
        const page = req.query.page || 1;
        const resp = await fetchWithCache(`${JIKAN_API}/seasons/upcoming?limit=15&page=${page}`);
        const data = resp.data.data.map(normalizeAnime);
        res.json({ data, hasNextPage: resp.data.pagination.has_next_page });
    } catch (e) { res.status(500).json({ error: "Failed to fetch upcoming anime" }); }
});

router.get('/starters', async (req, res) => {
    try {
        const action = await fetchWithCache(`${JIKAN_API}/anime?genres=1&order_by=members&sort=desc&limit=8`);
        await new Promise(r => setTimeout(r, 350));
        const romance = await fetchWithCache(`${JIKAN_API}/anime?genres=22&order_by=members&sort=desc&limit=8`);
        await new Promise(r => setTimeout(r, 350));
        const comedy = await fetchWithCache(`${JIKAN_API}/anime?genres=4&order_by=members&sort=desc&limit=8`);
        await new Promise(r => setTimeout(r, 350));
        const thriller = await fetchWithCache(`${JIKAN_API}/anime?genres=41&order_by=members&sort=desc&limit=8`);
        
        res.json({
            action: action.data.data.map(normalizeAnime),
            romance: romance.data.data.map(normalizeAnime),
            comedy: comedy.data.data.map(normalizeAnime),
            thriller: thriller.data.data.map(normalizeAnime)
        });
    } catch(e) {
        console.error(e);
        res.status(500).json({ error: "Failed to fetch starter anime" });
    }
});

router.get('/search', async (req, res) => {
    try {
        const q = req.query.q;
        if (!q) return res.json({ data: [] });
        const resp = await fetchWithCache(`${JIKAN_API}/anime?q=${encodeURIComponent(q)}&limit=15`);
        const data = resp.data.data.map(normalizeAnime);
        res.json({ data });
    } catch (e) { res.status(500).json({ error: "Search failed" }); }
});

router.get('/:id', async (req, res) => {
    if(req.params.id === 'search' || req.params.id === 'starters' || req.params.id === 'genre') return;
    try {
        const resp = await fetchWithCache(`${JIKAN_API}/anime/${req.params.id}`);
        // Fetch recommendations natively from Jikan for related section
        const relResp = await fetchWithCache(`${JIKAN_API}/anime/${req.params.id}/recommendations`);
        
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

router.get('/genre/explore', async (req, res) => {
    try {
        const genreName = req.query.name || '';
        
        const topRes = await fetchWithCache(`${JIKAN_API}/anime?q=${encodeURIComponent(genreName)}&order_by=score&sort=desc&limit=15`);
        await new Promise(r => setTimeout(r, 350));
        
        const airingRes = await fetchWithCache(`${JIKAN_API}/anime?q=${encodeURIComponent(genreName)}&status=airing&order_by=popularity&limit=15`);
        await new Promise(r => setTimeout(r, 350));
        
        const recRes = await fetchWithCache(`${JIKAN_API}/anime?q=${encodeURIComponent(genreName)}&order_by=members&sort=desc&limit=15`);
        
        res.json({
            top: topRes.data.data.map(normalizeAnime),
            airing: airingRes.data.data.map(normalizeAnime),
            recommended: recRes.data.data.map(normalizeAnime)
        });
    } catch(e) {
        console.error("Genre API failed:", e.message);
        res.status(500).json({ error: "Failed to fetch genre data" });
    }
});

module.exports = router;
