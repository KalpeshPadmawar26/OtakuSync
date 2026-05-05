const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/authMiddleware');

// Add or Remove from Watchlist
router.post('/watchlist', auth, async (req, res) => {
    try {
        const { anime, action } = req.body; 
        if (!anime || !anime.id) return res.status(400).json({error: "Anime data required"});

        if(action === 'add') {
            await db.query('INSERT IGNORE INTO watchlist (user_id, anime_id, anime_data) VALUES (?, ?, ?)', [req.user.id, anime.id, JSON.stringify(anime)]);
            await db.query('DELETE FROM watched WHERE user_id = ? AND anime_id = ?', [req.user.id, anime.id]);
        } else {
            await db.query('DELETE FROM watchlist WHERE user_id = ? AND anime_id = ?', [req.user.id, anime.id]);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Add or Remove from Watched list
router.post('/watched', auth, async (req, res) => {
    try {
        const { anime, action } = req.body;
        if (!anime || !anime.id) return res.status(400).json({error: "Anime data required"});

        if(action === 'add') {
            await db.query('INSERT IGNORE INTO watched (user_id, anime_id, anime_data) VALUES (?, ?, ?)', [req.user.id, anime.id, JSON.stringify(anime)]);
            await db.query('DELETE FROM watchlist WHERE user_id = ? AND anime_id = ?', [req.user.id, anime.id]);
        } else {
            await db.query('DELETE FROM watched WHERE user_id = ? AND anime_id = ?', [req.user.id, anime.id]);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get User Data
router.get('/data', auth, async (req, res) => {
    try {
        const [watchlistRaw] = await db.query('SELECT anime_data FROM watchlist WHERE user_id = ?', [req.user.id]);
        const [watchedRaw] = await db.query('SELECT anime_data FROM watched WHERE user_id = ?', [req.user.id]);
        const [users] = await db.query('SELECT preferences, notify_mentions FROM users WHERE id = ?', [req.user.id]);
        
        const watchlist = watchlistRaw.map(r => r.anime_data);
        const watched = watchedRaw.map(r => r.anime_data);
        const notifyMentions = users[0] ? !!users[0].notify_mentions : true;
        
        let preferences = null;
        if(users[0] && users[0].preferences) {
            try { preferences = typeof users[0].preferences === 'string' ? JSON.parse(users[0].preferences).genres : users[0].preferences.genres; } catch(e){}
        }

        res.json({ watchlist, watched, preferences, notifyMentions });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Post Preferences
router.post('/preferences', auth, async (req, res) => {
    try {
        const { genres } = req.body;
        await db.query('UPDATE users SET preferences = ? WHERE id = ?', [JSON.stringify({genres}), req.user.id]);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// Update Notification Preference
router.post('/notification-preference', auth, async (req, res) => {
    try {
        const { notifyMentions } = req.body;
        await db.query('UPDATE users SET notify_mentions = ? WHERE id = ?', [notifyMentions, req.user.id]);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// Search Users for Mentions
router.get('/search', auth, async (req, res) => {
    try {
        const { q } = req.query;
        if(!q) return res.json([]);
        const [rows] = await db.query('SELECT username FROM users WHERE username LIKE ? LIMIT 5', [`%${q}%`]);
        res.json(rows.map(r => r.username));
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// Feedback post API
router.post('/feedback', async (req, res) => {
    try {
        const { message } = req.body;
        if(!message) return res.status(400).json({ error: "Message is required." });
        
        await db.query('INSERT INTO feedback (message) VALUES (?)', [message]);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
