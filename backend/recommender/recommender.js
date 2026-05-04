const axios = require('axios');
const db = require('../db');

function getGenreFrequency(animeList) {
    const freq = {};
    animeList.forEach(anime => {
        if (!anime.genres) return;
        anime.genres.forEach(genre => {
            freq[genre] = (freq[genre] || 0) + 1;
        });
    });
    return freq;
}

function calculateGenreScore(animeGenres, userGenreFreq) {
    let score = 0;
    if (!animeGenres) return score;
    animeGenres.forEach(genre => {
        if (userGenreFreq[genre]) {
            score += userGenreFreq[genre];
        }
    });
    return score;
}

const normalizeAnime = (item) => {
    return {
        id: item.mal_id,
        title: item.title_english || item.title,
        image: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url,
        genres: item.genres ? item.genres.map(g => g.name) : [],
        score: item.score
    };
};

async function generateRecommendations(userId) {
    try {
        const [watchlistRaw] = await db.query('SELECT anime_data FROM watchlist WHERE user_id = ?', [userId]);
        const [watchedRaw] = await db.query('SELECT anime_data FROM watched WHERE user_id = ?', [userId]);
        
        const watchlist = watchlistRaw.map(r => r.anime_data);
        const watched = watchedRaw.map(r => r.anime_data);

        if(watchlist.length === 0 && watched.length === 0) {
            return []; // Cannot recommend
        }

        const watchedFreq = getGenreFrequency(watched);
        const watchlistFreq = getGenreFrequency(watchlist);

        // Fetch candidates (Top and Airing)
        let candidates = [];
        try {
            const top = await axios.get('https://api.jikan.moe/v4/top/anime?limit=25');
            const airing = await axios.get('https://api.jikan.moe/v4/seasons/now?limit=25');
            
            // Generate topic search based on top genre to augment candidates
            const combinedFreq = {};
            Object.keys(watchedFreq).forEach(k => combinedFreq[k] = (combinedFreq[k] || 0) + (watchedFreq[k] * 0.7));
            Object.keys(watchlistFreq).forEach(k => combinedFreq[k] = (combinedFreq[k] || 0) + (watchlistFreq[k] * 0.3));
            
            let genreSearchCandidates = [];
            const topGenres = Object.keys(combinedFreq).sort((a,b) => combinedFreq[b] - combinedFreq[a]).slice(0, 1);
            if (topGenres.length > 0) {
                const search = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(topGenres[0])}&limit=15`);
                genreSearchCandidates = search.data.data;
            }

            const allCandidates = [...top.data.data, ...airing.data.data, ...genreSearchCandidates];
            candidates = allCandidates.map(normalizeAnime);
        } catch(e) {
            console.error("Failed to fetch candidates from Jikan", e.message);
        }

        // Add some randomness and remove duplicates
        let uniqueCandidates = [];
        let candidateIds = new Set();
        for(let c of candidates) {
            if(!candidateIds.has(c.id)) {
                uniqueCandidates.push(c);
                candidateIds.add(c.id);
            }
        }

        const watchedIds = new Set([
            ...watched.map(a => a.id),
            ...watchlist.map(a => a.id)
        ]);

        const recommendations = [];

        // Score Candidates
        uniqueCandidates.forEach(anime => {
            // Remove already viewed
            if (watchedIds.has(anime.id)) return;

            const watchedScore = calculateGenreScore(anime.genres, watchedFreq);
            const watchlistScore = calculateGenreScore(anime.genres, watchlistFreq);

            const popularityBoost = anime.score || 0; // Jikan score

            const finalScore =
                (0.7 * watchedScore) +
                (0.3 * watchlistScore) +
                (0.1 * popularityBoost);
            
            // Add slight randomness to avoid repetitive arrays for identical profiles
            const randomFactor = 1 + (Math.random() * 0.1); 

            if (finalScore > 0) {
                // Why recommended
                const combinedFreq = {};
                Object.keys(watchedFreq).forEach(k => combinedFreq[k] = (combinedFreq[k] || 0) + (watchedFreq[k] * 0.7));
                Object.keys(watchlistFreq).forEach(k => combinedFreq[k] = (combinedFreq[k] || 0) + (watchlistFreq[k] * 0.3));

                const matchedGenres = anime.genres.filter(g => combinedFreq[g] > 0);
                
                // Sort matched by user preference weight
                matchedGenres.sort((a,b) => combinedFreq[b] - combinedFreq[a]);

                let reason = "Because it is highly rated";
                if(matchedGenres.length > 0) {
                    reason = `Because you like ${matchedGenres.slice(0, 2).join(' & ')}`;
                }

                recommendations.push({
                    ...anime,
                    score: finalScore * randomFactor,
                    reason
                });
            }
        });

        // Sort descending
        recommendations.sort((a, b) => b.score - a.score);

        return recommendations.slice(0, 10);
    } catch (e) {
        throw e;
    }
}

module.exports = {
    generateRecommendations
};
