const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if(!username || !password || !email) return res.status(400).json({error: "Username, email, and password required"});

        const [existing] = await db.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
        if(existing.length > 0) return res.status(400).json({error: "Username or email already exists"});

        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(password, salt);

        await db.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashed]);
        res.status(201).json({ message: "Registration successful" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if(users.length === 0) return res.status(400).json({error: "Invalid username or password"});

        const validPass = await bcrypt.compare(password, users[0].password);
        if(!validPass) return res.status(400).json({error: "Invalid username or password"});

        const token = jwt.sign({ id: users[0].id, username: users[0].username }, process.env.JWT_SECRET || 'super_secret_jwt_key_otakusync_2026', { expiresIn: '7d' });
        res.json({ token, username });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get('/me', require('../middleware/authMiddleware'), (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
