const BACKEND_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.') || window.location.hostname.startsWith('10.')) 
    ? `${window.location.protocol}//${window.location.hostname}:5000` 
    : 'https://otakusync.onrender.com';
const API_URL = `${BACKEND_URL}/api`;

class App {
    constructor() {
        window.app = this;
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

        this.currentCategory = null;
        this.categoryPage = 1;

        // Chat
        this.socket = null;
        this.currentRoom = 'Action';

        // Clear cache on manual refresh if needed
        if (performance.getEntriesByType("navigation")[0]?.type === 'reload') {
            sessionStorage.clear();
            console.log("Manual refresh detected - Cache cleared.");
        }

        this._injectSkipLink();
        this.bindEvents();
        this.updateAuthUI();

        // Constants
        this.CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

        // Browser Notifications
        if ("Notification" in window && Notification.permission !== "denied" && this.token) {
            Notification.requestPermission();
        }
    }

    _injectSkipLink() {
        if (document.getElementById('skip-to-content')) return;
        const skip = document.createElement('a');
        skip.id = 'skip-to-content';
        skip.href = '#main-content';
        skip.className = 'skip-link';
        skip.textContent = 'Skip to main content';
        document.body.insertBefore(skip, document.body.firstChild);
    }

    refreshIcons() {
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    showToast(msg, isMention = false) {
        const toast = document.createElement('div');
        toast.className = `toast-notif ${isMention ? 'mention-toast' : ''}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span>${msg}</span>
            </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 5000);
    }

    showBrowserNotification(title, message) {
        console.log("Attempting browser notification. Permission:", Notification.permission);
        const notifyEnabled = JSON.parse(localStorage.getItem('notifyMentions')) ?? true;
        if (!notifyEnabled) {
            console.log("Notifications disabled via app settings.");
            return;
        }

        if (Notification.permission === "granted") {
            try {
                const n = new Notification(title, {
                    body: message,
                    tag: 'otakusync-mention', // Prevents flooding
                    renotify: true
                });
                n.onclick = () => {
                    window.focus();
                    n.close();
                };
            } catch (e) {
                console.error("Notification constructor failed:", e);
            }
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }

    async updateNotificationPreference(enabled) {
        localStorage.setItem('notifyMentions', JSON.stringify(enabled));
        if (this.token) {
            try {
                await this.fetchAPI('/user/notification-preference', {
                    method: 'POST',
                    body: JSON.stringify({ notifyMentions: enabled })
                });
            } catch (e) {
                console.error("Failed to sync preference to server");
            }
        }
    }

    // --- CACHING ---

    setCache(key, data) {
        try {
            sessionStorage.setItem(key, JSON.stringify({
                data,
                time: Date.now()
            }));
        } catch (e) {
            console.warn("Failed to set session cache", e);
        }
    }

    getCache(key) {
        try {
            const item = JSON.parse(sessionStorage.getItem(key));
            if (!item) return null;
            if (Date.now() - item.time > this.CACHE_EXPIRY) {
                sessionStorage.removeItem(key);
                return null;
            }
            return item.data;
        } catch (e) {
            return null;
        }
    }

    async fetchWithCache(endpoint, cacheKey) {
        const cached = this.getCache(cacheKey);
        if (cached) return cached;

        const data = await this.fetchAPI(endpoint);
        this.setCache(cacheKey, data);
        return data;
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
        const dropdownUser = document.getElementById('dropdownUser');
        const body = document.body;

        if (this.token) {
            if (authButtons) authButtons.classList.add('hidden');
            if (userMenu) userMenu.classList.remove('hidden');
            if (dropdownUser) dropdownUser.innerText = `${this.username}`;
            if (body) {
                body.classList.remove('auth-logged-out');
                body.classList.add('auth-logged-in');
            }
        } else {
            if (authButtons) authButtons.classList.remove('hidden');
            if (userMenu) userMenu.classList.add('hidden');
            if (body) {
                body.classList.remove('auth-logged-in');
                body.classList.add('auth-logged-out');
            }
        }

        this.renderBottomNav();
    }

    renderBottomNav() {
        const bottomNav = document.getElementById('bottomNav');
        if (!bottomNav) return;
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        const icons = {
            home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5.25v-6h-4.5v6H4.5A1.5 1.5 0 0 1 3 19.5v-9Z"/></svg>`,
            community: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11a3 3 0 1 0-2.999-3A3 3 0 0 0 16 11Zm-8 0a3 3 0 1 0-3-3A3 3 0 0 0 8 11Zm0 2c-2.67 0-8 1.34-8 4v2h10v-2c0-1.08.42-2.03 1.1-2.85C10.06 13.43 8.66 13 8 13Zm8 0c-.29 0-.62.02-.97.05A4.97 4.97 0 0 1 18 17v2h6v-2c0-2.66-5.33-4-8-4Z"/></svg>`,
            start: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 2.8 5.67L21 8.6l-4.5 4.38 1.06 6.2L12 16.2l-5.56 2.98 1.06-6.2L3 8.6l6.2-.93L12 2Z"/></svg>`,
            profile: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.01-8 4.5V21h16v-2.5C20 16.01 16.42 14 12 14Z"/></svg>`
        };

        const items = this.token 
            ? [
                { label: 'Home', icon: icons.home, action: 'app.goHome(event)', page: 'index.html' },
                { label: 'Community', icon: icons.community, action: 'app.goCommunity(event)', page: 'chat.html' },
                { label: 'Start Anime', icon: icons.start, action: 'app.goStart(event)', page: 'start.html' },
                { label: 'Profile', icon: icons.profile, action: 'app.showMobileProfileMenu(event)', page: null }
            ]
            : [
                { label: 'Home', icon: icons.home, action: 'app.goHome(event)', page: 'index.html' },
                { label: 'Start Anime', icon: icons.start, action: 'app.goStart(event)', page: 'start.html' },
                { label: 'Profile', icon: icons.profile, action: 'app.showMobileProfileMenu(event)', page: null }
            ];

        bottomNav.innerHTML = items.map(item => `
            <button class="bottom-nav-item ${item.page === currentPage ? 'active' : ''}" onclick="${item.action}">
                <span class="bottom-nav-icon">${item.icon}</span>
                <span>${item.label}</span>
            </button>
        `).join('');
    }

    goHome(e) {
        if(e) e.preventDefault();
        window.location.href = 'index.html';
    }

    goCommunity(e) {
        if(e) e.preventDefault();
        window.location.href = 'chat.html';
    }

    goStart(e) {
        if(e) e.preventDefault();
        window.location.href = 'start.html';
    }

    toggleProfileMenu(e) {
        if(e) e.stopPropagation();
        const menu = document.getElementById('profileDropdown');
        if (menu) {
            menu.classList.toggle('show');
        }
    }

    showMobileProfileMenu(e) {
        if (e) e.stopPropagation();
        const existing = document.getElementById('mobileProfileMenu');
        if (existing) {
            existing.remove();
            return;
        }

        const menu = document.createElement('div');
        menu.id = 'mobileProfileMenu';
        menu.className = 'mobile-profile-menu';

        if (this.token) {
            menu.innerHTML = `
                <div class="mobile-profile-title">${this.username || 'User'}</div>
                <button onclick="window.location.href='dashboard.html'; app.hideMobileProfileMenu();">My Dashboard</button>
                <button onclick="app.logout()">Logout</button>
            `;
        } else {
            menu.innerHTML = `
                <button onclick="app.showAuthModal('login'); app.hideMobileProfileMenu();">Login</button>
                <button onclick="app.showAuthModal('register'); app.hideMobileProfileMenu();">Register</button>
            `;
        }

        document.body.appendChild(menu);
    }

    hideMobileProfileMenu() {
        const menu = document.getElementById('mobileProfileMenu');
        if (menu) menu.remove();
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

        const searchInput = document.querySelector('.search-bar');
        if (searchInput) {
            let debounce;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounce);
                debounce = setTimeout(() => this.handleSearch(e.target.value), 500);
            });
        }
        
        document.addEventListener('click', (e) => {
            const res = document.getElementById('searchResults');
            if (res && !e.target.closest('.search-container')) {
                res.classList.add('hidden');
            }
            
            // Profile Dropdown close
            const dropdown = document.getElementById('profileDropdown');
            const profileContainer = document.getElementById('profileContainer');
            if (dropdown && dropdown.classList.contains('show') && profileContainer && !profileContainer.contains(e.target)) {
                dropdown.classList.remove('show');
            }

            if (!e.target.closest('#mobileProfileMenu') && !e.target.closest('.bottom-nav-item')) {
                this.hideMobileProfileMenu();
            }
        });
    }

    handleFormSearch() {
        const query = document.querySelector('.search-bar').value;
        if (query.trim()) {
            this.handleSearch(query);
        }
    }

    async logout() {
        this.hideMobileProfileMenu();
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
                        <img src="${anime.image}" alt="${anime.title} thumbnail" loading="lazy" width="38" height="52" decoding="async">
                        <div>
                            <h4>${anime.title}</h4>
                            <span style="font-size: 0.8rem; color: #aaa;">${anime.genres.slice(0, 2).join(', ')}</span>
                        </div>
                    </a>
                `).join('');
            }
            resultsBox.classList.remove('hidden');
            this.refreshIcons();
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
            if (data.notifyMentions !== undefined) {
                localStorage.setItem('notifyMentions', JSON.stringify(data.notifyMentions));
            }
            
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
        console.log("Initializing Home...");
        if (this.token) await this.fetchUserData();

        const trendingList = document.getElementById('trendingList');
        const airingList = document.getElementById('airingList');
        const upcomingList = document.getElementById('upcomingList');

        // Load each section independently
        if (trendingList) {
            this.fetchWithCache('/anime/top?page=1', 'topAnime_1')
                .then(res => {
                    if (res.data && res.data.length > 0) {
                        trendingList.innerHTML = res.data.map(a => this.createAnimeCard(a)).join('');
                        this.refreshIcons();
                    } else {
                        trendingList.innerHTML = '<div class="error-text">Rate limited by API. Please wait a moment and reload.</div>';
                    }
                })
                .catch(e => {
                    console.error("Top Anime Error:", e);
                    trendingList.innerHTML = '<div class="error-text">Network Error. Check console.</div>';
                });
        }

        if (airingList) {
            this.fetchWithCache('/anime/airing?page=1', 'airingAnime_1')
                .then(res => {
                    if (res.data && res.data.length > 0) {
                        airingList.innerHTML = res.data.map(a => this.createAnimeCard(a)).join('');
                        this.refreshIcons();
                    } else {
                        airingList.innerHTML = '<div class="error-text">Temporarily unavailable. Try loading more soon.</div>';
                    }
                })
                .catch(e => {
                    console.error("Airing Anime Error:", e);
                    airingList.innerHTML = '<div class="error-text">Network Error. Check console.</div>';
                });
        }

        if (upcomingList) {
            console.log("Fetching upcoming anime...");
            this.fetchWithCache('/anime/upcoming?page=1', 'upcomingAnime_1')
                .then(res => {
                    if (res && res.data && Array.isArray(res.data) && res.data.length > 0) {
                        upcomingList.innerHTML = res.data.map(a => this.createAnimeCard(a, "", true)).join('');
                        this.refreshIcons();
                    } else {
                        console.warn("Upcoming Anime empty or missing data:", res);
                        upcomingList.innerHTML = '<div class="error-text">No upcoming anime found at the moment.</div>';
                    }
                })
                .catch(e => {
                    console.error("Upcoming Anime Error:", e);
                    upcomingList.innerHTML = '<div class="error-text">Network Error. Check console if the issue persists on mobile.</div>';
                });
        }

        // "Your Genres" section — shown only for logged-in users with preferences

        // "Your Genres" section — shown only for logged-in users with preferences
        if(this.token && this.preferences && this.preferences.length > 0) {
            const topTwo = this.preferences.slice(0, 2);
            const yourGenresSection = document.getElementById('yourGenresSection');
            const yourGenresList = document.getElementById('yourGenresList');
            const yourGenresTitle = document.getElementById('yourGenresTitle');
            if(yourGenresSection && yourGenresList) {
                yourGenresSection.classList.remove('hidden');
                if(yourGenresTitle) yourGenresTitle.innerHTML = `<i data-lucide="target" class="title-icon"></i> Because You Like ${topTwo.join(' & ')}`;
                try {
                    const res = await this.fetchAPI(`/anime/search?q=${encodeURIComponent(topTwo[0])}`);
                    if(res && res.data && res.data.length > 0) {
                        yourGenresList.innerHTML = res.data.map(a => this.createAnimeCard(a)).join('');
                        this.refreshIcons();
                    } else {
                        yourGenresList.innerHTML = '<div class="loading">Generating picks...</div>';
                    }
                } catch(e) { 
                    console.error("Genres fetch error:", e);
                    yourGenresList.innerHTML = ''; 
                }
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
            this.refreshIcons();

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
                this.refreshIcons();
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
        const synopsis = anime.synopsis || 'No synopsis available.';

        const btnWatchlist = `<button class="btn-primary ${isWatchlisted ? 'active' : ''}" style="${isWatchlisted ? 'background:#e66a00;' : ''}" onclick='app.handleToggle("watchlist", ${safeAnime}, ${isWatchlisted}, event)'>${isWatchlisted ? 'In Watchlist' : 'Add to Watchlist'}</button>`;
        const btnWatched = `<button class="btn-secondary ${isWatched ? 'active' : ''}" style="${isWatched ? 'border-color:#e66a00; background:rgba(255,122,0,0.2)' : ''}" onclick='app.handleToggle("watched", ${safeAnime}, ${isWatched}, event)'>${isWatched ? 'Marked Watched' : 'Mark as Watched'}</button>`;

        const trailerHtml = (anime.trailer) 
            ? `<div class="anime-right">
                    <h3 class="section-title"><i data-lucide="play" class="title-icon"></i> Watch Trailer</h3>
                    <div class="trailer-container">
                        <iframe src="${anime.trailer}" loading="lazy" allowfullscreen></iframe>
                    </div>
               </div>`
            : '';

        const html = `
            <div class="detail-banner" style="background-image: url('${anime.image}');"></div>
            <div class="anime-container">
                <div class="anime-left">
                    <div class="detail-container">
                        <div class="detail-poster">
                            <img src="${anime.image}" alt="${anime.title} cover poster" width="240" height="340" fetchpriority="high" decoding="sync">
                        </div>
                        <div class="detail-info">
                            <h1 class="detail-title">${anime.title}</h1>
                            <div class="detail-genres">
                                ${anime.genres.map(g => `<span class="genre-badge">${g}</span>`).join('')}
                            </div>
                            <div class="detail-meta">
                                <span><i data-lucide="star" style="width:14px; height:14px; vertical-align:middle; fill:currentColor; margin-right:4px;"></i>${anime.score || 'N/A'}</span>
                                <span><i data-lucide="tv" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i>${anime.episodes || '?'} Episodes</span>
                                <span><i data-lucide="flame" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i>${anime.status}</span>
                                <span><i data-lucide="calendar" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i>${anime.aired || 'Unknown'}</span>
                            </div>
                            <div class="detail-desc" id="synopsisContainer">
                                ${synopsis.length > 350 ? `
                                    <div id="shortSynopsis">
                                        ${synopsis.slice(0, 350)}... 
                                        <span class="show-more-btn" onclick="app.toggleSynopsis(true)">Show More</span>
                                    </div>
                                    <div id="fullSynopsis" class="hidden expanded-box">
                                        ${synopsis}
                                        <div style="margin-top:12px; text-align:right;">
                                            <span class="show-more-btn" onclick="app.toggleSynopsis(false)">Show Less</span>
                                        </div>
                                    </div>
                                ` : synopsis}
                            </div>
                            <div class="detail-actions">
                                ${btnWatchlist}
                                ${btnWatched}
                            </div>
                        </div>
                    </div>
                </div>
                ${trailerHtml}
            </div>
        `;
        document.getElementById('animeDetailView').innerHTML = html;
        this.refreshIcons();

        // Inject JSON-LD structured data for Google SEO
        const ld = {
            "@context": "https://schema.org",
            "@type": "Movie",
            "name": anime.title,
            "image": anime.image,
            "description": synopsis,
            "genre": anime.genres,
            "aggregateRating": anime.score ? {
                "@type": "AggregateRating",
                "ratingValue": anime.score,
                "bestRating": "10"
            } : undefined
        };
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(ld);
        document.head.appendChild(script);

        // Update page title dynamically
        document.title = `${anime.title} | OtakuSync`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if(metaDesc) metaDesc.setAttribute('content', `${synopsis.slice(0, 155)}...`);

    }

    toggleSynopsis(expand) {
        const short = document.getElementById('shortSynopsis');
        const full = document.getElementById('fullSynopsis');
        if (expand) {
            short.classList.add('hidden');
            full.classList.remove('hidden');
        } else {
            short.classList.remove('hidden');
            full.classList.add('hidden');
        }
    }

    async initDashboard() {
        await this.fetchUserData();

        const watchedList = document.getElementById('dashboardWatchedList');
        const watchlistList = document.getElementById('dashboardWatchlist');
        const recList = document.getElementById('recommendationsList');

        if (!watchedList) return;

        if (this.watched.length === 0) watchedList.innerHTML = '<div class="loading">No watched anime yet.</div>';
        else {
            watchedList.innerHTML = this.watched.map(a => this.createAnimeCard(a)).join('');
            this.refreshIcons();
        }

        if (this.watchlist.length === 0) watchlistList.innerHTML = '<div class="loading">Watchlist is empty.</div>';
        else {
            watchlistList.innerHTML = this.watchlist.map(a => this.createAnimeCard(a)).join('');
            this.refreshIcons();
        }

        this.renderInsights();

        try {
            const recs = await this.fetchAPI('/recommendations');
            if (recs.length === 0) {
                recList.innerHTML = '<div class="loading">Add more anime to get recommendations!</div>';
            } else {
                recList.innerHTML = recs.map(a => this.createAnimeCard(a, a.reason)).join('');
                this.refreshIcons();
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
            reason = `Releases: ${ (anime.aired && typeof anime.aired === 'string') ? anime.aired.split('to')[0].trim() : 'TBA'}`;
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
        const topBadge = anime.score ? `<div class="card-rating-badge"><i data-lucide="star" style="width:10px; height:10px; fill:currentColor; vertical-align:middle; margin-right:2px;"></i>${Number(anime.score).toFixed(1)}</div>` : '';
        const genres = Array.isArray(anime.genres) ? anime.genres : [];
        const genreHtml = genres.slice(0, 2).map(g =>
            `<span class="genre-tag" onclick="event.stopPropagation(); window.location.href='genre.html?name=${encodeURIComponent(g)}'">${g}</span>`
        ).join('');

        return `
            <div class="anime-card" id="anime-${anime.id}" onclick="window.location.href='anime.html?id=${anime.id}'" role="article" aria-label="${anime.title}">
                ${topBadge}
                <div class="anime-img-wrapper">
                    <img src="${anime.image}" alt="${anime.title} poster" loading="lazy" width="160" height="240" decoding="async" onload="this.classList.add('img-loaded')" />
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
            this.socket.emit('identify', this.username);
            this.socket.emit('joinRoom', this.currentRoom);
        });

        this.socket.on('history', (messages) => {
            const chatBox = document.getElementById('chatMessages');
            chatBox.innerHTML = messages.map(m => this.createMessageUI(m)).join('');
            chatBox.scrollTop = chatBox.scrollHeight;
            this.refreshIcons();
        });

        this.socket.on('newMessage', (msg) => {
            const chatBox = document.getElementById('chatMessages');
            chatBox.innerHTML += this.createMessageUI(msg);
            chatBox.scrollTop = chatBox.scrollHeight;
            this.refreshIcons();
        });

        this.socket.on('mention', (data) => {
            this.showToast(`${data.from} mentioned you!`, true);
            this.showBrowserNotification("OtakuSync Mention", `@${data.from}: ${data.message}`);
        });

        const notifyToggle = document.getElementById('notifyToggle');
        if (notifyToggle) {
            notifyToggle.checked = JSON.parse(localStorage.getItem('notifyMentions')) ?? true;
        }

        this.setupMentionAutocomplete();
        this.bindChatMobileControls();
    }

    bindChatMobileControls() {
        const openBtn = document.getElementById('roomPickerBtn');
        const closeBtn = document.getElementById('closeRoomsBtn');
        const sidebar = document.getElementById('chatSidebar');
        const overlay = document.getElementById('chatOverlay');
        if (!openBtn || !sidebar || !overlay) return;

        openBtn.onclick = () => {
            sidebar.classList.add('open');
            overlay.classList.add('show');
        };

        const closeRooms = () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        };

        if (closeBtn) closeBtn.onclick = closeRooms;
        overlay.onclick = closeRooms;
    }

    joinChatRoom(genre, el = null) {
        if (el) {
            document.querySelectorAll('#genreList li').forEach(li => li.classList.remove('active'));
            el.classList.add('active');
        }
        this.currentRoom = genre;
        document.getElementById('currentRoomName').innerHTML = `<i data-lucide="message-square" class="title-icon"></i> ${genre} Room`;
        this.refreshIcons();
        const msgs = document.getElementById('chatMessages');
        if (msgs) msgs.innerHTML = '<div style="text-align:center;color:#666;padding:20px;">Fetching history...</div>';
        if (this.socket) {
            this.socket.emit('joinRoom', genre);
        }
        const sidebar = document.getElementById('chatSidebar');
        const overlay = document.getElementById('chatOverlay');
        if (window.innerWidth <= 768 && sidebar && overlay) {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        }
    }

    setupMentionAutocomplete() {
        const inp = document.getElementById('chatInput');
        if (!inp) return;

        const dropdown = document.createElement('div');
        dropdown.id = 'mentionDropdown';
        dropdown.className = 'mention-dropdown hidden';
        inp.parentElement.appendChild(dropdown);

        let debounce;
        inp.addEventListener('input', (e) => {
            const val = e.target.value;
            const lastAt = val.lastIndexOf('@');
            
            if (lastAt !== -1 && (lastAt === 0 || val[lastAt - 1] === ' ')) {
                const query = val.slice(lastAt + 1).split(' ')[0];
                clearTimeout(debounce);
                debounce = setTimeout(async () => {
                    try {
                        const users = await this.fetchAPI(`/user/search?q=${encodeURIComponent(query)}`);
                        if (users.length > 0) {
                            dropdown.innerHTML = users.map(u => `<div class="mention-item">${u}</div>`).join('');
                            dropdown.classList.remove('hidden');
                            
                            dropdown.querySelectorAll('.mention-item').forEach(item => {
                                item.onclick = () => {
                                    const before = val.slice(0, lastAt);
                                    const after = val.slice(lastAt + 1 + query.length);
                                    inp.value = `${before}@${item.innerText} ${after}`;
                                    dropdown.classList.add('hidden');
                                    inp.focus();
                                };
                            });
                        } else {
                            dropdown.classList.add('hidden');
                        }
                    } catch (e) { dropdown.classList.add('hidden'); }
                }, 300);
            } else {
                dropdown.classList.add('hidden');
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.chat-input-area')) dropdown.classList.add('hidden');
        });
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
        const dropdown = document.getElementById('mentionDropdown');
        if (dropdown) dropdown.classList.add('hidden');
    }

    createMessageUI(m) {
        const author = m.user || m.username || 'User';
        const isMe = author === this.username;
        const time = new Date(m.time || Date.now()).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        });
        
        // Highlight Mentions
        let msgHtml = (m.message || '').replace(/@(\w+)/g, '<span class="mention">@$1</span>');

        return `
            <div class="chat-msg ${isMe ? 'msg-sent' : 'msg-received'}">
                <div class="msg-bubble">
                    ${!isMe ? `<span class="msg-u">${author}</span>` : ''}
                    <div class="msg-c">
                        ${msgHtml}
                        <span class="msg-t">${time}</span>
                    </div>
                </div>
            </div>
        `;
    }

    async initStarters() {
        const container = document.getElementById('startersContainer');
        if(!container) return;

        // Use GENRE_GROUPS if available, else fallback
        const groups = (typeof GENRE_GROUPS !== 'undefined') ? GENRE_GROUPS : [
            { label: '<i data-lucide="zap" class="title-icon"></i> Action & Adventure', genres: ['Action', 'Adventure'] },
            { label: '<i data-lucide="heart" class="title-icon"></i> Romance & Drama',    genres: ['Romance', 'Drama'] },
            { label: '<i data-lucide="laugh" class="title-icon"></i> Comedy',             genres: ['Comedy', 'Parody'] },
            { label: '<i data-lucide="skull" class="title-icon"></i> Thriller & Horror',  genres: ['Thriller', 'Horror'] }
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
                        this.refreshIcons();
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
    async initCategoryPage() {
        const params = new URLSearchParams(window.location.search);
        const type = params.get('type') || 'trending';
        this.currentCategory = type;
        this.categoryPage = 1;

        const titles = {
            trending: '<i data-lucide="flame" class="title-icon"></i> Trending Now',
            airing: '<i data-lucide="star" class="title-icon"></i> Seasonal Hits',
            upcoming: '<i data-lucide="calendar" class="title-icon"></i> Highly Anticipated'
        };

        const titleEl = document.getElementById('categoryTitle');
        if (titleEl) titleEl.innerHTML = titles[type] || 'Explore';
        document.title = `${titles[type] || 'Explore'} | OtakuSync`;

        await this.loadCategoryData();
    }

    async loadCategoryData() {
        const grid = document.getElementById('categoryGrid');
        const btn = document.getElementById('loadMoreBtn');
        if (!grid) return;

        const endpoint = this.currentCategory === 'trending' ? '/anime/top' : 
                         this.currentCategory === 'airing' ? '/anime/airing' : '/anime/upcoming';

        try {
            const res = await this.fetchAPI(`${endpoint}?page=${this.categoryPage}`);
            if (this.categoryPage === 1) grid.innerHTML = '';

            if (res.data && res.data.length > 0) {
                grid.innerHTML += res.data.map(a => this.createAnimeCard(a)).join('');
                this.refreshIcons();
                if (btn) btn.style.display = 'block';
            } else {
                if (btn) btn.style.display = 'none';
            }
        } catch (e) {
            console.error("Category Load Error:", e);
        }
    }

    async loadMoreCategory() {
        this.categoryPage++;
        await this.loadCategoryData();
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
            
            this.refreshIcons();
        } catch(e) {
            if(topList) topList.innerHTML = '<div class="error-text">Failed to load. Try again.</div>';
        }
    }
}

const app = new App();
window.app = app;
