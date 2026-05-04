// LocalStorage Keys
const WATCHED_KEY = "otakusync_watched";
const WATCHLIST_KEY = "otakusync_watchlist";
const USER_KEY = "otakusync_user_logged_in";

class App {
    constructor() {
        this.watched = JSON.parse(localStorage.getItem(WATCHED_KEY)) || [];
        this.watchlist = JSON.parse(localStorage.getItem(WATCHLIST_KEY)) || [];
        this.isLoggedIn = localStorage.getItem(USER_KEY) === "true";
        this.currentPage = 'home';
        
        window.addEventListener('DOMContentLoaded', () => {
             this.init();
        });
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.updateLoginState();
        this.renderHome();
    }

    cacheDOM() {
        // Nav elements
        this.homePage = document.getElementById('homePage');
        this.dashboardPage = document.getElementById('dashboardPage');
        this.navHome = document.getElementById('navHome');
        this.navDashboard = document.getElementById('navDashboard');
        this.navLogo = document.getElementById('navLogo');
        this.loginBtn = document.getElementById('loginBtn');
        this.logoutBtn = document.getElementById('logoutBtn');
        
        // Home Secitons
        this.trendingList = document.getElementById('trendingList');
        this.topAiringList = document.getElementById('topAiringList');
        this.upcomingList = document.getElementById('upcomingList');

        // Dashboard Sections
        this.dashboardWatchedList = document.getElementById('dashboardWatchedList');
        this.dashboardWatchlist = document.getElementById('dashboardWatchlist');
        this.recommendationsList = document.getElementById('recommendationsList');
        this.genreInsightsChart = document.getElementById('genreInsightsChart');
        this.watchedEmpty = document.getElementById('watchedEmpty');
        this.watchlistEmpty = document.getElementById('watchlistEmpty');
    }

    bindEvents() {
        this.loginBtn.addEventListener('click', () => {
            this.isLoggedIn = true;
            localStorage.setItem(USER_KEY, "true");
            this.updateLoginState();
            this.showNotification("Successfully logged in!");
        });

        this.logoutBtn.addEventListener('click', () => {
            this.isLoggedIn = false;
            localStorage.setItem(USER_KEY, "false");
            this.updateLoginState();
            this.switchPage('home');
            this.showNotification("Logged out successfully.");
        });

        this.navHome.addEventListener('click', () => this.switchPage('home'));
        this.navLogo.addEventListener('click', () => this.switchPage('home'));
        this.navDashboard.addEventListener('click', () => this.switchPage('dashboard'));
    }

    updateLoginState() {
        if (this.isLoggedIn) {
            this.loginBtn.classList.add('hidden');
            this.logoutBtn.classList.remove('hidden');
            this.navDashboard.classList.remove('hidden');
        } else {
            this.loginBtn.classList.remove('hidden');
            this.logoutBtn.classList.add('hidden');
            this.navDashboard.classList.add('hidden');
        }
    }

    switchPage(page) {
        if (page === 'dashboard' && !this.isLoggedIn) {
            this.showNotification("Please login to access the dashboard");
            return;
        }

        this.currentPage = page;
        
        if (page === 'home') {
            this.homePage.classList.remove('hidden');
            this.dashboardPage.classList.add('hidden');
            this.navHome.classList.add('active');
            this.navDashboard.classList.remove('active');
            this.renderHome();
        } else {
            this.homePage.classList.add('hidden');
            this.dashboardPage.classList.remove('hidden');
            this.navHome.classList.remove('active');
            this.navDashboard.classList.add('active');
            this.renderDashboard();
        }
        
        // Scroll to top
        window.scrollTo(0,0);
    }

    // --- RENDER LOGIC ---

    createAnimeCard(anime, isDashboard = false, reason = "") {
        const isWatched = this.watched.some(a => a.id === anime.id);
        const isWatchlisted = this.watchlist.some(a => a.id === anime.id);

        let actionsHtml = '';
        
        if (isDashboard) {
            if (isWatched) {
                actionsHtml = `<button onclick="app.removeFromWatched(${anime.id})">Remove from Watched</button>`;
            } else if (isWatchlisted) {
                actionsHtml = `
                    <button class="active" onclick="app.moveToWatched(${anime.id})">Move to Watched</button>
                    <button onclick="app.removeFromWatchlist(${anime.id})">Remove</button>
                `;
            } else {
                actionsHtml = `
                <button class="${isWatchlisted ? 'active' : ''}" onclick="app.toggleWatchlist(${anime.id})">${isWatchlisted ? 'In Watchlist' : '+ Watchlist'}</button>
                <button class="${isWatched ? 'active' : ''}" onclick="app.toggleWatched(${anime.id})">${isWatched ? 'Watched' : '+ Watched'}</button>
                `;
            }
        } else {
            actionsHtml = `
                <button class="${isWatchlisted ? 'active' : ''}" onclick="app.toggleWatchlist(${anime.id})">${isWatchlisted ? 'In Watchlist' : '+ Watchlist'}</button>
                <button class="${isWatched ? 'active' : ''}" onclick="app.toggleWatched(${anime.id})">${isWatched ? 'Watched' : '+ Watched'}</button>
            `;
        }

        const reasonHtml = reason ? `<span class="reason-text">${reason}</span>` : '';

        return `
            <div class="anime-card">
                <div class="anime-img-wrapper">
                    <img src="${anime.image}" alt="${anime.title}" />
                </div>
                <div class="card-info">
                    <h3>${anime.title}</h3>
                    <p>${anime.genres.join(', ')}</p>
                    ${reasonHtml}
                    <div class="card-actions">
                        ${actionsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    renderHome() {
        const trending = allAnime.filter(a => a.category === "Trending");
        const topAiring = allAnime.filter(a => a.category === "Top Airing");
        const upcoming = allAnime.filter(a => a.category === "Upcoming");

        this.trendingList.innerHTML = trending.map(a => this.createAnimeCard(a)).join('');
        this.topAiringList.innerHTML = topAiring.map(a => this.createAnimeCard(a)).join('');
        this.upcomingList.innerHTML = upcoming.map(a => this.createAnimeCard(a)).join('');
    }

    renderDashboard() {
        // Render Lists
        if (this.watched.length === 0) {
            this.dashboardWatchedList.innerHTML = '';
            this.watchedEmpty.classList.remove('hidden');
        } else {
            this.watchedEmpty.classList.add('hidden');
            this.dashboardWatchedList.innerHTML = this.watched.map(a => this.createAnimeCard(a, true)).join('');
        }

        if (this.watchlist.length === 0) {
            this.dashboardWatchlist.innerHTML = '';
            this.watchlistEmpty.classList.remove('hidden');
        } else {
            this.watchlistEmpty.classList.add('hidden');
            this.dashboardWatchlist.innerHTML = this.watchlist.map(a => this.createAnimeCard(a, true)).join('');
        }

        this.renderInsightsAndRecommendations();
    }

    // --- DATA MUTATION ---

    toggleWatchlist(id) {
        if (!this.isLoggedIn) return this.showNotification("Please login first to add to Watchlist");
        
        const anime = allAnime.find(a => a.id === id);
        if (!anime) return;
        
        const index = this.watchlist.findIndex(a => a.id === id);
        
        if (index > -1) {
            this.watchlist.splice(index, 1);
            this.showNotification(`Removed ${anime.title} from Watchlist`);
        } else {
            this.watchlist.push(anime);
            this.showNotification(`Added ${anime.title} to Watchlist`);
            // Automatically remove from watched if added to watchlist
            this.watched = this.watched.filter(a => a.id !== id);
        }
        
        this.saveData();
        if (this.currentPage === 'home') this.renderHome();
        else this.renderDashboard();
    }

    toggleWatched(id) {
        if (!this.isLoggedIn) return this.showNotification("Please login first to mark as Watched");

        const anime = allAnime.find(a => a.id === id);
        if (!anime) return;

        const index = this.watched.findIndex(a => a.id === id);
        
        if (index > -1) {
            this.watched.splice(index, 1);
            this.showNotification(`Removed ${anime.title} from Watched`);
        } else {
            this.watched.push(anime);
            this.showNotification(`Marked ${anime.title} as Watched`);
            // Automatically remove from watchlist
            this.watchlist = this.watchlist.filter(a => a.id !== id);
        }
        
        this.saveData();
        if (this.currentPage === 'home') this.renderHome();
        else this.renderDashboard();
    }

    removeFromWatched(id) {
        this.watched = this.watched.filter(a => a.id !== id);
        this.saveData();
        this.renderDashboard();
        this.showNotification("Removed from watched list");
    }

    removeFromWatchlist(id) {
        this.watchlist = this.watchlist.filter(a => a.id !== id);
        this.saveData();
        this.renderDashboard();
        this.showNotification("Removed from watchlist");
    }

    moveToWatched(id) {
        const anime = allAnime.find(a => a.id === id);
        this.watchlist = this.watchlist.filter(a => a.id !== id);
        this.watched.push(anime);
        this.saveData();
        this.renderDashboard();
        this.showNotification(`Moved ${anime.title} to Watched`);
    }

    saveData() {
        localStorage.setItem(WATCHED_KEY, JSON.stringify(this.watched));
        localStorage.setItem(WATCHLIST_KEY, JSON.stringify(this.watchlist));
    }

    showNotification(msg) {
        const notif = document.createElement('div');
        notif.className = 'notification';
        notif.innerText = msg;
        document.body.appendChild(notif);
        
        setTimeout(() => notif.classList.add('show'), 10);
        setTimeout(() => {
            notif.classList.remove('show');
            setTimeout(() => notif.remove(), 400);
        }, 3000);
    }

    // --- RECOMMENDATION ENGINE ---
    
    getGenreFrequency(animeList) {
        const freq = {};
        animeList.forEach(anime => {
            anime.genres.forEach(genre => {
                freq[genre] = (freq[genre] || 0) + 1;
            });
        });
        return freq;
    }

    calculateGenreScore(animeGenres, userGenreFreq) {
        let score = 0;
        animeGenres.forEach(genre => {
            if (userGenreFreq[genre]) {
                score += userGenreFreq[genre];
            }
        });
        return score;
    }

    getRecommendations() {
        const watchedFreq = this.getGenreFrequency(this.watched);
        const watchlistFreq = this.getGenreFrequency(this.watchlist);

        const watchedIds = new Set([
            ...this.watched.map(a => a.id),
            ...this.watchlist.map(a => a.id)
        ]);

        const recommendations = [];

        allAnime.forEach(anime => {
            if (watchedIds.has(anime.id)) return;

            const watchedScore = this.calculateGenreScore(anime.genres, watchedFreq);
            const watchlistScore = this.calculateGenreScore(anime.genres, watchlistFreq);
            const popularityBoost = anime.popularity || 0;

            const finalScore = (0.7 * watchedScore) + (0.3 * watchlistScore) + (0.1 * popularityBoost);

            if (finalScore > 0) {
                recommendations.push({
                    ...anime,
                    score: finalScore
                });
            }
        });

        recommendations.sort((a, b) => b.score - a.score);
        return recommendations.slice(0, 10);
    }

    getRecommendationReason(anime, userGenreFreq) {
        const matchedGenres = anime.genres.filter(g => userGenreFreq[g]);
        if (matchedGenres.length === 0) return "Because it's popular";
        return `Because you like ${matchedGenres.slice(0, 2).join(" & ")}`;
    }

    renderInsightsAndRecommendations() {
        const watchedFreq = this.getGenreFrequency(this.watched);
        const watchlistFreq = this.getGenreFrequency(this.watchlist);
        
        const combinedFreq = {};
        Object.keys(watchedFreq).forEach(k => combinedFreq[k] = (combinedFreq[k] || 0) + (watchedFreq[k] * 0.7));
        Object.keys(watchlistFreq).forEach(k => combinedFreq[k] = (combinedFreq[k] || 0) + (watchlistFreq[k] * 0.3));

        // Render Chart
        const keys = Object.keys(combinedFreq).sort((a, b) => combinedFreq[b] - combinedFreq[a]).slice(0, 5);
        
        if (keys.length === 0) {
            this.genreInsightsChart.innerHTML = '<div class="empty-state">Add anime to your lists to see insights.</div>';
            this.recommendationsList.innerHTML = '<div class="empty-state" style="grid-column: 1/-1">Add anime to your watched/watchlist to get recommendations!</div>';
            return;
        }

        const maxVal = Math.max(...keys.map(k => combinedFreq[k]));
        
        let chartHtml = '';
        keys.forEach(genre => {
            const count = combinedFreq[genre];
            const percent = Math.max(15, (count / maxVal) * 100);
            chartHtml += `
                <div class="bar-row">
                    <div class="bar-label">${genre}</div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${percent}%">${count.toFixed(1)}</div>
                    </div>
                </div>
            `;
        });
        
        this.genreInsightsChart.innerHTML = chartHtml;

        // Render Recommendations
        const recs = this.getRecommendations();
        if (recs.length === 0) {
            this.recommendationsList.innerHTML = '<div class="empty-state" style="grid-column: 1/-1">Wow, you have watched everything in our database!</div>';
        } else {
            this.recommendationsList.innerHTML = recs.map(a => {
                const reason = this.getRecommendationReason(a, combinedFreq);
                return this.createAnimeCard(a, false, reason);
            }).join('');
        }
    }
}

// Initialize application
const app = new App();
