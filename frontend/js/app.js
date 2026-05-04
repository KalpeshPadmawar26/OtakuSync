const BACKEND_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : 'https://otakusync.onrender.com';
const API_URL = `${BACKEND_URL}/api`;

class App {
    constructor() {
        this.token = localStorage.getItem('token') || null;
        this.username = localStorage.getItem('username') || null;
        this.watched = [];
        this.watchlist = [];
        this.preferences = null;

        this.authMode = 'login';

        this.pages = {
            top: 1,
            airing: 1,
            upcoming: 1
        };

        // Chat
        this.socket = null;
        this.currentRoom = 'Action';

        this.bindEvents();
        this.updateAuthUI();
    }

    // --- UTILS & UI ---

    showNotification(msg, isError = false) {
        const notif = document.createElement('div');
        notif.className = 'notification';
        if (isError) notif.style.backgroundColor = '#ff4d4d';
        notif.innerText = msg;
        document.body.appendChild(notif);

        setTimeout(() => notif.classList.add('show'), 10);
        setTimeout(() => {
            notif.classList.remove('show');
            setTimeout(() => notif.remove(), 400);
        }, 3000);
    }

    updateAuthUI() {
        const authButtons = document.getElementById('authButtons');
        const userMenu = document.getElementById('userMenu');
        const welcomeText = document.getElementById('welcomeText');
        const navDashboard = document.getElementById('navDashboard');

        if (this.token) {
            if (authButtons) authButtons.classList.add('hidden');
            if (userMenu) userMenu.classList.remove('hidden');
            if (welcomeText) welcomeText.innerText = `Hi, ${this.username}`;
            if (navDashboard) navDashboard.classList.remove('hidden');
        } else {
            // Keep links hidden and show auth
            if (authButtons) authButtons.classList.remove('hidden');
            if (userMenu) userMenu.classList.add('hidden');
            if (navDashboard) navDashboard.classList.add('hidden');
        }
    }

    toggleFloatingMenu() {
        const menu = document.getElementById('floatingMenu');
        if (menu) menu.classList.toggle('show');
    }

    scrollToId(id, event) {
        if(event) event.preventDefault();
        const el = document.getElementById(id);
        if(el) {
            const offset = 80;
            const elementPosition = el.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            this.toggleFloatingMenu();
        } else {
            window.location.href = `index.html#${id}`;
        }
    }

    scrollToId(id, event) {
        if(event) event.preventDefault();
        const el = document.getElementById(id);
        if(el) {
            const offset = 80;
            const elementPosition = el.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            this.toggleFloatingMenu();
        } else {
            window.location.href = `index.html#${id}`;
        }
    }

    // --- API CALLS ---

    async fetchAPI(endpoint, options = {}) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

        try {
            const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'API Error');
            return data;
        } catch (e) {
            if (e.message !== 'Failed to fetch') {
                this.showNotification(e.message, true);
            }
            throw e;
        }
    }

    // --- AUTHENTICATION ---

    showAuthModal(mode) {
        this.authMode = mode;
        document.getElementById('authModal').classList.remove('hidden');
        document.getElementById('modalTitle').innerText = mode === 'login' ? 'Login' : 'Register';
        document.getElementById('authError').innerText = '';

        const em = document.getElementById('authEmail');
        const cp = document.getElementById('authConfirmPassword');
        if (mode === 'register') {
            em.classList.remove('hidden');
            cp.classList.remove('hidden');
        } else {
            em.classList.add('hidden');
            cp.classList.add('hidden');
        }
    }

    hideAuthModal() {
        document.getElementById('authModal').classList.add('hidden');
    }

    bindEvents() {
        const authSubmit = document.getElementById('authSubmit');
        if (authSubmit) {
            authSubmit.addEventListener('click', async () => {
                const u = document.getElementById('authUsername').value;
                const p = document.getElementById('authPassword').value;
                const eMail = document.getElementById('authEmail').value;
                const cp = document.getElementById('authConfirmPassword').value;

                if (!u || !p) return;

                if (this.authMode === 'register') {
                    if (!eMail) return document.getElementById('authError').innerText = "Email is required";
                    if (p !== cp) return document.getElementById('authError').innerText = "Passwords do not match";
                }

                try {
                    const endpoint = this.authMode === 'login' ? '/auth/login' : '/auth/register';
                    const payload = this.authMode === 'register' ? { username: u, email: eMail, password: p } : { username: u, password: p };

                    const data = await this.fetchAPI(endpoint, {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });

                    if (this.authMode === 'register') {
                        this.showNotification('Registration successful! Please login.');
                        this.showAuthModal('login');
                    } else {
                        this.token = data.token;
                        this.username = data.username;
                        localStorage.setItem('token', data.token);
                        localStorage.setItem('username', data.username);
                        this.hideAuthModal();
                        this.updateAuthUI();
                        this.showNotification('Logged in successfully!');

                        if (window.location.pathname.includes('dashboard.html')) {
                            this.initDashboard();
                        } else if (window.location.pathname.includes('anime.html')) {
                            this.initAnimeDetails();
                        } else if (window.location.pathname.includes('chat.html')) {
                            this.initChat();
                        } else if (window.location.pathname.includes('start.html')) {
                            this.initStarters();
                        } else {
                            await this.fetchUserData();
                            this.initHome();
                        }
                    }
                } catch (e) {
                    document.getElementById('authError').innerText = e.message;
                }
            });
        }

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            let debounce;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounce);
                debounce = setTimeout(() => this.handleSearch(e.target.value), 500);
            });
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.search-container')) {
                    const res = document.getElementById('searchResults');
                    if (res) res.classList.add('hidden');
                }
            });
        }
    }

    handleFormSearch() {
        const query = document.getElementById('searchInput').value;
        if (query.trim()) {
            this.handleSearch(query);
            // Optionally redirect to search page, but user requested fetch-based dynamic grid
        }
    }

    async logout() {
        this.token = null;
        this.username = null;
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        this.updateAuthUI();
        if (window.location.pathname.includes('dashboard.html') || window.location.pathname.includes('chat.html')) {
            window.location.href = 'index.html';
        } else if (window.location.pathname.includes('anime.html')) {
            this.watched = [];
            this.watchlist = [];
            this.initAnimeDetails();
        } else {
            this.watched = [];
            this.watchlist = [];
            this.initHome();
        }
    }

    async handleSearch(query) {
        const resultsBox = document.getElementById('searchResults');
        if (!query.trim()) {
            resultsBox.classList.add('hidden');
            return;
        }

        try {
            const results = await this.fetchAPI(`/anime/search?q=${encodeURIComponent(query)}`);
            if (results.data.length === 0) {
                resultsBox.innerHTML = '<div style="padding: 10px; color: #888;">No results found...</div>';
            } else {
                resultsBox.innerHTML = results.data.slice(0, 10).map(anime => `
                    <a href="anime.html?id=${anime.id}" class="search-result-item" style="color:inherit; text-decoration:none;">
                        <img src="${anime.image}" alt="${anime.title}">
                        <div>
                            <h4>${anime.title}</h4>
                            <span style="font-size: 0.8rem; color: #aaa;">${anime.genres.slice(0, 2).join(', ')}</span>
                        </div>
                    </a>
                `).join('');
            }
            resultsBox.classList.remove('hidden');
        } catch (e) {
            console.error("Search failed");
        }
    }

    // --- SUBMIT FEEDBACK ---
    async submitFeedback() {
        const msg = document.getElementById('feedbackMsg').value;
        if (!msg.trim()) return;

        try {
            await this.fetchAPI('/user/feedback', {
                method: 'POST',
                body: JSON.stringify({ message: msg })
            });
            this.showNotification("Feedback submitted successfully!");
            document.getElementById('feedbackMsg').value = '';
        } catch (e) {
            this.showNotification("Failed to send feedback", true);
        }
    }

    // --- DATA FETCHING & RENDERING ---

    async fetchUserData() {
        if (!this.token) return;
        try {
            const data = await this.fetchAPI('/user/data');
            this.watchlist = data.watchlist || [];
            this.watched = data.watched || [];
            this.preferences = data.preferences || null;
            
            if(this.preferences) {
                localStorage.setItem('preferences', JSON.stringify(this.preferences));
            } else if (!this.preferences && (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('OtakuSync/frontend/'))) {
                this.checkOnboarding();
            }
        } catch (e) {
            console.error('Failed to fetch user data');
        }
    }

    checkOnboarding() {
        const modal = document.getElementById('onboardingModal');
        const grid = document.getElementById('onboardingGenreGrid');
        if(modal && !this.preferences) {
            // Populate from MASTER_GENRES if available
            if(grid && typeof MASTER_GENRES !== 'undefined') {
                grid.innerHTML = MASTER_GENRES.map(g =>
                    `<label class="genre-pill"><input type="checkbox" value="${g}"> ${g}</label>`
                ).join('');
            }
            modal.classList.remove('hidden');
        }
    }
    
    async submitOnboarding() {
        const checked = document.querySelectorAll('.genre-pill input:checked');
        if(checked.length === 0) return this.showNotification('Please select at least one genre.', true);
        
        const genres = Array.from(checked).map(i => i.value);
        try {
            await this.fetchAPI('/user/preferences', { method: 'POST', body: JSON.stringify({ genres }) });
            this.preferences = genres;
            localStorage.setItem('preferences', JSON.stringify(genres));
            document.getElementById('onboardingModal').classList.add('hidden');
            this.showNotification("Preferences saved! Generating picks...");
            
            const searchGenre = genres[Math.floor(Math.random() * genres.length)];
            const data = await this.fetchAPI(`/anime/search?q=${searchGenre}`);
            const picksModal = document.getElementById('picksModal');
            if(picksModal) {
                document.getElementById('picksList').innerHTML = data.data.slice(0, 10).map(a => this.createAnimeCard(a)).join('');
                picksModal.classList.remove('hidden');
            }
        } catch(e) {
            console.error(e);
            this.showNotification("Failed to save preferences", true);
        }
    }

    async initHome() {
        if (this.token) await this.fetchUserData();

        const trendingList = document.getElementById('trendingList');
        const airingList = document.getElementById('airingList');
        const upcomingList = document.getElementById('upcomingList');

        if (!trendingList || !airingList) return;

        try {
            // Fetch sequentially to prevent Jikan API HTTP 429 Rate Limits
            const top = await this.fetchAPI('/anime/top?page=1').catch(e => ({ data: [] }));
            if (top.data.length > 0) {
                trendingList.innerHTML = top.data.map(a => this.createAnimeCard(a)).join('');
            } else {
                trendingList.innerHTML = '<div class="error-text">Rate limited by API. Please wait a moment and reload.</div>';
            }

            const airing = await this.fetchAPI('/anime/airing?page=1').catch(e => ({ data: [] }));
            if (airing.data.length > 0) {
                airingList.innerHTML = airing.data.map(a => this.createAnimeCard(a)).join('');
            } else {
                airingList.innerHTML = '<div class="error-text">Temporarily unavailable. Try loading more soon.</div>';
            }

            const upcoming = await this.fetchAPI('/anime/upcoming?page=1').catch(e => ({ data: [] }));
            if (upcoming.data.length > 0) {
                upcomingList.innerHTML = upcoming.data.map(a => this.createAnimeCard(a, "", true)).join('');
            } else {
                upcomingList.innerHTML = '<div class="error-text">Temporarily unavailable. Try loading more soon.</div>';
            }
        } catch (e) {
            trendingList.innerHTML = '<div class="error-text">Network Error. Check console.</div>';
        }

        // "Your Genres" section — shown only for logged-in users with preferences
        if(this.token && this.preferences && this.preferences.length > 0) {
            const topTwo = this.preferences.slice(0, 2);
            const yourGenresSection = document.getElementById('yourGenresSection');
            const yourGenresList = document.getElementById('yourGenresList');
            const yourGenresTitle = document.getElementById('yourGenresTitle');
            if(yourGenresSection && yourGenresList) {
                yourGenresSection.classList.remove('hidden');
                if(yourGenresTitle) yourGenresTitle.innerText = `🎯 Because You Like ${topTwo.join(' & ')}`;
                try {
                    const res = await this.fetchAPI(`/anime/search?q=${encodeURIComponent(topTwo[0])}`);
                    yourGenresList.innerHTML = res.data.map(a => this.createAnimeCard(a)).join('');
                } catch(e) { yourGenresList.innerHTML = ''; }
            }
        }
    }

    async loadMore(section) {
        this.pages[section]++;
        const page = this.pages[section];

        const listMap = {
            top: { id: 'trendingList', endpoint: '/anime/top' },
            airing: { id: 'airingList', endpoint: '/anime/airing' },
            upcoming: { id: 'upcomingList', endpoint: '/anime/upcoming' }
        };

        const target = listMap[section];
        const container = document.getElementById(target.id);
        const isUp = section === 'upcoming';

        try {
            const res = await this.fetchAPI(`${target.endpoint}?page=${page}`);
            const newCards = res.data.map(a => this.createAnimeCard(a, "", isUp)).join('');
            container.innerHTML += newCards;

            if (!res.hasNextPage) {
                event.target.style.display = 'none';
            }
        } catch (e) {
            this.showNotification("Error loading more anime", true);
        }
    }

    async initAnimeDetails() {
        if (this.token) await this.fetchUserData();

        const urlParams = new URLSearchParams(window.location.search);
        const animeId = urlParams.get('id');

        if (!animeId) {
            document.getElementById('animeDetailView').innerHTML = '<h2 style="text-align:center; padding:100px;">Anime Not Found</h2>';
            return;
        }

        try {
            const res = await this.fetchAPI(`/anime/${animeId}`);
            this.renderAnimeDetails(res.details);

            const relatedContainer = document.getElementById('relatedAnimeList');
            if (res.related && res.related.length > 0) {
                relatedContainer.innerHTML = res.related.map(a => this.createAnimeCard(a)).join('');
            } else {
                relatedContainer.innerHTML = '<div style="color: grey;">No related anime found.</div>';
            }
        } catch (e) {
            document.getElementById('animeDetailView').innerHTML = '<h2 style="text-align:center; padding:100px;">Error Loading Anime Details</h2>';
        }
    }

    renderAnimeDetails(anime) {
        const isWatched = this.watched.some(a => a.id === anime.id);
        const isWatchlisted = this.watchlist.some(a => a.id === anime.id);
        const safeAnime = JSON.stringify(anime).replace(/'/g, "&#39;");

        const btnWatchlist = `<button class="btn-primary ${isWatchlisted ? 'active' : ''}" style="${isWatchlisted ? 'background:#e66a00;' : ''}" onclick='app.handleToggle("watchlist", ${safeAnime}, ${isWatchlisted}, event)'>${isWatchlisted ? 'In Watchlist' : 'Add to Watchlist'}</button>`;
        const btnWatched = `<button class="btn-secondary ${isWatched ? 'active' : ''}" style="${isWatched ? 'border-color:#e66a00; background:rgba(255,122,0,0.2)' : ''}" onclick='app.handleToggle("watched", ${safeAnime}, ${isWatched}, event)'>${isWatched ? 'Marked Watched' : 'Mark as Watched'}</button>`;

        const html = `
            <div class="detail-banner" style="background-image: url('${anime.image}');"></div>
            <div class="detail-container">
                <div class="detail-poster">
                    <img src="${anime.image}" alt="${anime.title}">
                </div>
                <div class="detail-info">
                    <h1 class="detail-title">${anime.title}</h1>
                    <div class="detail-genres">
                        ${anime.genres.map(g => `<span class="genre-badge">${g}</span>`).join('')}
                    </div>
                    <div class="detail-meta">
                        <span>⭐ ${anime.score || 'N/A'}</span>
                        <span>📺 ${anime.episodes || '?'} Episodes</span>
                        <span>🔥 ${anime.status}</span>
                        <span>📅 ${anime.aired || 'Unknown'}</span>
                    </div>
                    <div class="detail-desc">
                        ${anime.synopsis || 'No synopsis available.'}
                    </div>
                    <div class="detail-actions">
                        ${btnWatchlist}
                        ${btnWatched}
                    </div>
                </div>
            </div>
        `;
        document.getElementById('animeDetailView').innerHTML = html;
    }

    async initDashboard() {
        await this.fetchUserData();

        const watchedList = document.getElementById('dashboardWatchedList');
        const watchlistList = document.getElementById('dashboardWatchlist');
        const recList = document.getElementById('recommendationsList');

        if (!watchedList) return;

        if (this.watched.length === 0) watchedList.innerHTML = '<div class="loading">No watched anime yet.</div>';
        else watchedList.innerHTML = this.watched.map(a => this.createAnimeCard(a)).join('');

        if (this.watchlist.length === 0) watchlistList.innerHTML = '<div class="loading">Watchlist is empty.</div>';
        else watchlistList.innerHTML = this.watchlist.map(a => this.createAnimeCard(a)).join('');

        this.renderInsights();

        try {
            const recs = await this.fetchAPI('/recommendations');
            if (recs.length === 0) {
                recList.innerHTML = '<div class="loading">Add more anime to get recommendations!</div>';
            } else {
                recList.innerHTML = recs.map(a => this.createAnimeCard(a, a.reason)).join('');
            }
        } catch (e) {
            recList.innerHTML = '<div class="error-text">Failed to generate recommendations.</div>';
        }
    }

    renderInsights() {
        const container = document.getElementById('genreInsightsChart');
        if (!container) return;

        const freq = {};
        this.watched.forEach(a => a.genres.forEach(g => freq[g] = (freq[g] || 0) + 1));

        const keys = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).slice(0, 5);
        if (keys.length === 0) {
            container.innerHTML = '<div>Add to your watched list for insights!</div>';
            return;
        }

        const max = Math.max(...keys.map(k => freq[k]));
        container.innerHTML = keys.map(k => `
            <div class="bar-row">
                <div class="bar-label">${k}</div>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${Math.max(10, (freq[k] / max) * 100)}%">${freq[k]}</div>
                </div>
            </div>
        `).join('');
    }

    createAnimeCard(anime, reason = "", isUpcoming = false) {
        const isWatched = this.watched.some(a => a.id === anime.id);
        const isWatchlisted = this.watchlist.some(a => a.id === anime.id);
        const safeAnime = JSON.stringify(anime).replace(/'/g, "&#39;");

        let actionsHtml = '';
        if (isUpcoming) {
            actionsHtml = `
                <button class="${isWatchlisted ? 'active' : ''}" style="color:${isWatchlisted ? '#ff7a00' : 'white'}" onclick='app.handleToggle("watchlist", ${safeAnime}, ${isWatchlisted}, event)'>
                    ${isWatchlisted ? '- Watchlist' : '+ Watchlist'}
                </button>
            `;
            reason = `Releases on: ${anime.aired ? anime.aired.split('to')[0] : 'TBA'}`;
        } else {
            actionsHtml = `
                <button class="${isWatchlisted ? 'active' : ''}" style="color:${isWatchlisted ? '#ff7a00' : 'white'}" onclick='app.handleToggle("watchlist", ${safeAnime}, ${isWatchlisted}, event)'>
                    ${isWatchlisted ? '- Watchlist' : '+ Watchlist'}
                </button>
                <button class="${isWatched ? 'active' : ''}" style="color:${isWatched ? '#ff7a00' : 'white'}" onclick='app.handleToggle("watched", ${safeAnime}, ${isWatched}, event)'>
                    ${isWatched ? '- Watched' : '+ Watched'}
                </button>
            `;
        }

        const reasonHtml = reason ? `<span class="reason-text">${reason}</span>` : '';
        const topBadge = anime.score ? `<div class="card-rating-badge">⭐ ${Number(anime.score).toFixed(1)}</div>` : '';
        const genreHtml = anime.genres.slice(0, 2).map(g =>
            `<span class="genre-tag" onclick="event.stopPropagation(); window.location.href='genre.html?name=${encodeURIComponent(g)}'">${g}</span>`
        ).join('');

        return `
            <div class="anime-card" id="anime-${anime.id}" onclick="window.location.href='anime.html?id=${anime.id}'">
                ${topBadge}
                <div class="anime-img-wrapper">
                    <img src="${anime.image}" alt="${anime.title}" />
                </div>
                <div class="card-info">
                    <h3 title="${anime.title}">${anime.title}</h3>
                    <div class="card-genres">${genreHtml}</div>
                    ${reasonHtml}
                    <div class="card-actions">
                        ${actionsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    async handleToggle(listType, anime, isCurrentlyInList, event = null) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (!this.token) {
            this.showAuthModal('login');
            return;
        }

        const action = isCurrentlyInList ? 'remove' : 'add';
        const success = await this.toggleList(listType, action, anime);

        // Single Card Mutate Pattern (No Full Reload)
        if (success && event) {
            const btn = event.currentTarget;
            if (action === 'add') {
                btn.classList.add('active');
                if (listType === 'watchlist') {
                    btn.innerHTML = '- Watchlist';
                    btn.style.color = '#ff7a00';
                    btn.setAttribute('onclick', `app.handleToggle('watchlist', ${JSON.stringify(anime).replace(/'/g, "&#39;")}, true, event)`);
                } else {
                    btn.innerHTML = '- Watched';
                    btn.style.color = '#ff7a00';
                    btn.setAttribute('onclick', `app.handleToggle('watched', ${JSON.stringify(anime).replace(/'/g, "&#39;")}, true, event)`);
                }
            } else {
                btn.classList.remove('active');
                if (listType === 'watchlist') {
                    btn.innerHTML = '+ Watchlist';
                    btn.style.color = 'white';
                    btn.setAttribute('onclick', `app.handleToggle('watchlist', ${JSON.stringify(anime).replace(/'/g, "&#39;")}, false, event)`);
                } else {
                    btn.innerHTML = '+ Watched';
                    btn.style.color = 'white';
                    btn.setAttribute('onclick', `app.handleToggle('watched', ${JSON.stringify(anime).replace(/'/g, "&#39;")}, false, event)`);
                }
            }
        }
    }

    async toggleList(listType, action, anime) {
        try {
            await this.fetchAPI(`/user/${listType}`, {
                method: 'POST',
                body: JSON.stringify({ anime, action })
            });

            if (action === 'add') {
                this[listType].push(anime);
                if (listType === 'watched') this.watchlist = this.watchlist.filter(a => a.id !== anime.id);
                if (listType === 'watchlist') this.watched = this.watched.filter(a => a.id !== anime.id);
                this.showNotification(`Added ${anime.title}`);
            } else {
                this[listType] = this[listType].filter(a => a.id !== anime.id);
                this.showNotification(`Removed ${anime.title}`);
            }
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    }

    // --- CHAT SYSTEM ---
    initChat() {
        this.socket = io(BACKEND_URL);

        this.socket.on('connect', () => {
            document.getElementById('chatMessages').innerHTML = '';
            this.socket.emit('joinRoom', this.currentRoom);
        });

        this.socket.on('history', (messages) => {
            const chatBox = document.getElementById('chatMessages');
            chatBox.innerHTML = messages.map(m => this.createMessageUI(m)).join('');
            chatBox.scrollTop = chatBox.scrollHeight;
        });

        this.socket.on('newMessage', (msg) => {
            const chatBox = document.getElementById('chatMessages');
            chatBox.innerHTML += this.createMessageUI(msg);
            chatBox.scrollTop = chatBox.scrollHeight;
        });
    }

    joinChatRoom(genre, el = null) {
        if (el) {
            document.querySelectorAll('#genreList li').forEach(li => li.classList.remove('active'));
            el.classList.add('active');
        }
        this.currentRoom = genre;
        document.getElementById('currentRoomName').innerText = `🔥 ${genre} Room`;
        document.getElementById('chatMessages').innerHTML = '<div style="text-align:center;color:#666;padding:20px;">Fetching history...</div>';
        if (this.socket) {
            this.socket.emit('joinRoom', genre);
        }
    }

    sendChatMessage() {
        const inp = document.getElementById('chatInput');
        const text = inp.value;
        if (!text.trim() || !this.socket) return;

        this.socket.emit('sendMessage', {
            username: this.username,
            message: text
        });

        inp.value = '';
    }

    createMessageUI(m) {
        const time = new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
            <div class="chat-msg">
                <span class="msg-u">${m.user}</span>
                <span class="msg-t">${time}</span>
                <br>
                <div class="msg-c">${m.message}</div>
            </div>
        `;
    }

    async initStarters() {
        const container = document.getElementById('startersContainer');
        if(!container) return;

        // Use GENRE_GROUPS if available, else fallback
        const groups = (typeof GENRE_GROUPS !== 'undefined') ? GENRE_GROUPS : [
            { label: '💥 Action & Adventure', genres: ['Action', 'Adventure'] },
            { label: '❤️ Romance & Drama',    genres: ['Romance', 'Drama'] },
            { label: '😂 Comedy',             genres: ['Comedy', 'Parody'] },
            { label: '🔪 Thriller & Horror',  genres: ['Thriller', 'Horror'] }
        ];

        // Show skeleton
        container.innerHTML = groups.map(g => `
            <section class="section">
                <h2 class="section-title">${g.label}</h2>
                <div class="horizontal-scroll">
                    ${Array(5).fill('<div class="skeleton skeleton-card"></div>').join('')}
                </div>
            </section>
        `).join('');

        // Fetch one representative genre per group (sequentially to avoid 429)
        for(let i = 0; i < groups.length; i++) {
            const group = groups[i];
            const sectionId = `grp-${i}`;
            try {
                await new Promise(r => setTimeout(r, 400)); // rate limit buffer
                const primaryGenre = group.genres[0];
                const res = await this.fetchAPI(`/anime/search?q=${encodeURIComponent(primaryGenre)}`);
                const sectionEl = container.children[i];
                if(sectionEl) {
                    const scrollDiv = sectionEl.querySelector('.horizontal-scroll');
                    if(scrollDiv && res.data && res.data.length > 0) {
                        scrollDiv.innerHTML = res.data.slice(0, 10).map(a => this.createAnimeCard(a)).join('');
                    } else if(scrollDiv) {
                        scrollDiv.innerHTML = '<div class="loading">No results found.</div>';
                    }
                }
            } catch(e) {
                const sectionEl = container.children[i];
                if(sectionEl) {
                    const scrollDiv = sectionEl.querySelector('.horizontal-scroll');
                    if(scrollDiv) scrollDiv.innerHTML = '<div class="error-text">Failed to load.</div>';
                }
            }
        }
    }
    async initGenreDetails() {
        const urlParams = new URLSearchParams(window.location.search);
        const genreName = urlParams.get('name') || '';

        const title = document.getElementById('genreTitle');
        if(title) title.innerText = `${genreName} Anime`;
        document.title = `${genreName} | OtakuSync`;

        const topList = document.getElementById('genreTopList');
        const airingList = document.getElementById('genreAiringList');
        const recList = document.getElementById('genreRecommendedList');

        try {
            const data = await this.fetchAPI(`/anime/genre/explore?name=${encodeURIComponent(genreName)}`);

            topList.innerHTML = data.top.length > 0
                ? data.top.map(a => this.createAnimeCard(a)).join('')
                : '<div class="loading">No top picks found.</div>';

            airingList.innerHTML = data.airing.length > 0
                ? data.airing.map(a => this.createAnimeCard(a)).join('')
                : '<div class="loading">No airing anime found.</div>';

            recList.innerHTML = data.recommended.length > 0
                ? data.recommended.map(a => this.createAnimeCard(a)).join('')
                : '<div class="loading">No recommendations found.</div>';
        } catch(e) {
            if(topList) topList.innerHTML = '<div class="error-text">Failed to load. Try again.</div>';
        }
    }
}

const app = new App();
