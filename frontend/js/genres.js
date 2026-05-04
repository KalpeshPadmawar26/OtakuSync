const MASTER_GENRES = [
    "Action", "Adventure", "Cars", "Comedy", "Dementia", "Demons", "Drama", "Ecchi",
    "Fantasy", "Game", "Harem", "Historical", "Horror", "Josei", "Kids",
    "Magic", "Martial Arts", "Mecha", "Military", "Music", "Mystery", "Psychological",
    "Police", "Romance", "Sci-Fi", "Seinen", "Shoujo", "Shounen", "Slice of Life",
    "Sports", "Super Power", "Supernatural", "Thriller", "Vampire", "Isekai", "School",
    "Parody", "Space", "Samurai", "Time Travel", "Psychological Thriller"
];

// Grouped for Start Anime page
const GENRE_GROUPS = [
    { label: "💥 Action & Adventure",     genres: ["Action", "Adventure", "Super Power", "Martial Arts"] },
    { label: "❤️ Romance & Emotion",       genres: ["Romance", "Drama", "Slice of Life", "Josei", "Shoujo"] },
    { label: "😂 Comedy & Fun",            genres: ["Comedy", "Parody", "Kids", "School"] },
    { label: "🔮 Fantasy & Magic",         genres: ["Fantasy", "Magic", "Isekai", "Supernatural", "Demons"] },
    { label: "🔪 Dark & Thriller",         genres: ["Thriller", "Psychological", "Horror", "Mystery", "Psychological Thriller"] },
    { label: "🚀 Sci-Fi & Mecha",          genres: ["Sci-Fi", "Mecha", "Space", "Time Travel"] },
    { label: "⚔️ Historical & Samurai",   genres: ["Historical", "Samurai", "Military", "Police"] },
    { label: "🎵 Music & Sports",          genres: ["Music", "Sports", "Game"] }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MASTER_GENRES, GENRE_GROUPS };
}
