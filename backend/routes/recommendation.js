const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { generateRecommendations } = require('../recommender/recommender');

router.get('/', auth, async (req, res) => {
    try {
        const recommendations = await generateRecommendations(req.user.id);
        res.json(recommendations);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to generate recommendations" });
    }
});

module.exports = router;
