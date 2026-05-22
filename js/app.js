const DataManager = globalThis.DataManager || (typeof window !== 'undefined' ? window.DataManager : undefined);
const AudioManager = globalThis.AudioManager || (typeof window !== 'undefined' ? window.AudioManager : undefined);

const App = {
    state: {
        currentView: 'home',
        testament: null,
        book: null,
        chapter: null,
        nimble: {
            active: false,
            timer: null,
            currentItem: null,
            progressCleanup: null,
            progressDelayTimer: null,
            verseAnchor: null,
            verseDragEnd: null
        },
        verseSelection: {
            singleSelected: null,
            rangeStart: null,
            rangeEnd: null
        },
        // Tabs state
        tabs: [],
        activeTabId: null,
        nextTabId: 1,
        toolbarExpanded: false,
        // Search state
        search: {
            query: '',
            matches: [],
            renderedCount: 0,
            batchSize: 60,
            scrollTop: 0
        },
        // Nimble scroll state for smooth scrolling
        nimbleScrollDirection: 0,
        nimbleScrollAnimationId: null,
        // Navigation cooldown to prevent accidental verse selection
        navigationCooldown: false
    },

    // Book abbreviations for tabs
    bookAbbreviations: {
        'Genesis': 'GEN', 'Exodus': 'EXO', 'Leviticus': 'LEV', 'Numbers': 'NUM',
        'Deuteronomy': 'DEU', 'Joshua': 'JOS', 'Judges': 'JDG', 'Ruth': 'RUT',
        '1 Samuel': '1SA', '2 Samuel': '2SA', '1 Kings': '1KI', '2 Kings': '2KI',
        '1 Chronicles': '1CH', '2 Chronicles': '2CH', 'Ezra': 'EZR', 'Nehemiah': 'NEH',
        'Esther': 'EST', 'Job': 'JOB', 'Psalm': 'PSA', 'Proverbs': 'PRO',
        'Ecclesiastes': 'ECC', 'Song Of Solomon': 'SOS', 'Isaiah': 'ISA', 'Jeremiah': 'JER',
        'Lamentations': 'LAM', 'Ezekiel': 'EZE', 'Daniel': 'DAN', 'Hosea': 'HOS',
        'Joel': 'JOE', 'Amos': 'AMO', 'Obadiah': 'OBA', 'Jonah': 'JON',
        'Micah': 'MIC', 'Nahum': 'NAH', 'Habakkuk': 'HAB', 'Zephaniah': 'ZEP',
        'Haggai': 'HAG', 'Zechariah': 'ZEC', 'Malachi': 'MAL',
        'Matthew': 'MAT', 'Mark': 'MAR', 'Luke': 'LUK', 'John': 'JON',
        'Acts': 'ACT', 'Romans': 'ROM', '1 Corinthians': '1CO', '2 Corinthians': '2CO',
        'Galatians': 'GAL', 'Ephesians': 'EPH', 'Philippians': 'PHP', 'Colossians': 'COL',
        '1 Thessalonians': '1TH', '2 Thessalonians': '2TH', '1 Timothy': '1TI', '2 Timothy': '2TI',
        'Titus': 'TIT', 'Philemon': 'PHM', 'Hebrews': 'HEB', 'James': 'JAM',
        '1 Peter': '1PE', '2 Peter': '2PE', '1 John': '1JO', '2 John': '2JO',
        '3 John': '3JO', 'Jude': 'JUD', 'Revelation': 'REV'
    },
    searchEventsBound: false,
    storageKey: 'nimbleBibleState',

    // === LOCAL STORAGE STATE PERSISTENCE ===

    saveStateToLocalStorage() {
        try {
            const stateToSave = {
                tabs: this.state.tabs,
                activeTabId: this.state.activeTabId,
                nextTabId: this.state.nextTabId
            };
            localStorage.setItem(this.storageKey, JSON.stringify(stateToSave));
        } catch (error) {
            console.error('Failed to save state to localStorage:', error);
        }
    },

    loadStateFromLocalStorage() {
        try {
            const savedData = localStorage.getItem(this.storageKey);
            if (savedData) {
                const parsed = JSON.parse(savedData);
                if (parsed.tabs && parsed.tabs.length > 0) {
                    this.state.tabs = parsed.tabs;
                    this.state.activeTabId = parsed.activeTabId;
                    this.state.nextTabId = parsed.nextTabId;
                    return true;
                }
            }
        } catch (error) {
            console.error('Failed to load state from localStorage:', error);
        }
        return false;
    },

    async init() {
        const loaded = await DataManager.init();
        if (!loaded) {
            alert('Failed to load Bible data.');
            return;
        }

        this.cacheElements();
        this.bindEvents();
        this.setupHistory();

        // Attempt to load saved tabs from local storage (if user returns to app)
        const hasSavedState = this.loadStateFromLocalStorage();

        if (hasSavedState && this.state.tabs.length > 0) {
            // Render tabs and restore the specific active tab's view
            this.renderTabs();
            // Automatically switch to the active tab which handles rendering the specific verse hierarchy natively
            this.switchTab(this.state.activeTabId, true);
        } else {
            // New user session: No saved state found
            this.renderHome();

            // Create initial Home tab
            if (this.state.tabs.length === 0) {
                this.state.tabs.push({
                    id: this.state.nextTabId++,
                    testament: null,
                    bookName: null,
                    chapterNumber: null,
                    verseNumber: null,
                    scrollPosition: 0
                });
                this.state.activeTabId = this.state.tabs[0].id;
                this.renderTabs();
            }
        }
    },

    setupHistory() {
        // Push initial state
        history.replaceState({
            view: 'homeView',
            testament: null,
            book: null,
            chapter: null
        }, '', '');

        // Browser back button handler
        window.addEventListener('popstate', (e) => {
            // If search is open, close it (the 'search' state was just popped)
            if (this.els.searchModal && this.els.searchModal.classList.contains('active')) {
                this.closeSearch();
                return;
            }
            this.restoreFromHistory(e.state);
        });
    },

    cacheElements() {
        this.els = {
            app: document.getElementById('app'),
            homeView: document.getElementById('home-view'),
            bookView: document.getElementById('book-view'),
            chapterView: document.getElementById('chapter-view'),
            verseListView: document.getElementById('verse-list-view'),
            verseView: document.getElementById('verse-view'),

            bookList: document.getElementById('book-list'),
            chapterList: document.getElementById('chapter-list'),
            verseList: document.getElementById('verse-list'),
            verseContent: document.getElementById('verse-content'),
            copyVerseBtn: document.getElementById('copy-verse-btn'),

            testamentTitle: document.getElementById('testament-title'),
            bookTitle: document.getElementById('book-title'),
            verseListTitle: document.getElementById('verse-list-title'),
            chapterTitle: document.getElementById('chapter-title'),

            btnOT: document.getElementById('btn-ot'),
            btnNT: document.getElementById('btn-nt'),

            // Toolbar elements
            audioToolbar: document.getElementById('audio-toolbar'),
            toolbarToggleBtn: document.getElementById('toolbar-toggle-btn'),
            audioPlayBtn: document.getElementById('audio-play-btn'),
            audioRange: document.getElementById('audio-range'),
            scrubberProgress: document.getElementById('scrubber-progress'),
            audioTime: document.getElementById('audio-time'),

            // Tabs elements
            tabsBar: document.getElementById('tabs-bar'),
            tabsContainer: document.getElementById('tabs-container'),
            newTabBtn: document.getElementById('new-tab-btn'),
            tabOptionsBtn: document.getElementById('tab-options-btn'),

            // Search elements
            searchModal: document.getElementById('search-modal'),
            searchInput: document.getElementById('search-input'),
            searchDismissBtn: document.getElementById('search-dismiss-btn'),
            searchClearBtn: document.getElementById('search-clear-btn'),
            searchResults: document.getElementById('search-results')
        };
    },

    bindEvents() {
        // Back buttons
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', () => this.goBack());
        });

        // Search buttons
        document.querySelectorAll('.search-btn').forEach(btn => {
            btn.addEventListener('click', () => this.openSearch());
        });

        // Home buttons (tap)
        this.els.btnOT.addEventListener('click', () => this.openBookList('Old Testament'));
        this.els.btnNT.addEventListener('click', () => this.openBookList('New Testament'));

        // Nimble triggers (long press) for home buttons
        this.bindNimbleTrigger(this.els.btnOT, { testament: 'Old Testament' });
        this.bindNimbleTrigger(this.els.btnNT, { testament: 'New Testament' });

        // Global touch handlers for nimble mode
        document.addEventListener('touchmove', (e) => {
            if (this.state.nimble.active) this.handleNimbleMove(e);
        }, { passive: false });

        document.addEventListener('touchend', () => {
            if (this.state.nimble.active) this.endNimbleMode();
        });

        // Prevent text selection globally
        this.preventTextSelection();

        // Toolbar toggle handler
        if (this.els.toolbarToggleBtn) {
            this.els.toolbarToggleBtn.addEventListener('click', () => {
                this.toggleToolbar();
            });
        }

        // Copy button handler (with disabled check)
        if (this.els.copyVerseBtn) {
            this.els.copyVerseBtn.addEventListener('click', () => {
                if (!this.els.copyVerseBtn.classList.contains('disabled')) {
                    this.copySelectedVerses();
                }
            });
        }

        // New tab button - tap creates tab, long press starts nimble nav
        if (this.els.newTabBtn) {
            // Tap handler
            this.els.newTabBtn.addEventListener('click', () => {
                this.createNewTab();
            });

            // Long press for nimble navigation (skip progress to avoid toolbar visual glitch)
            this.bindNimbleTrigger(this.els.newTabBtn, { fromNewTab: true }, { skipProgress: true });
        }

        // Tab options button
        if (this.els.tabOptionsBtn) {
            this.els.tabOptionsBtn.addEventListener('click', () => {
                this.showAllTabsOptionsMenu();
            });
        }

        // Audio controls
        this.bindAudioControls();

        // Toolbar swipe gesture handler
        this.bindToolbarSwipe();
    },

    // Toolbar swipe gestures
    bindToolbarSwipe() {
        if (!this.els.audioToolbar) return;

        let startY = 0;
        let startTime = 0;
        let isTouchingToolbar = false;

        this.els.audioToolbar.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            startTime = Date.now();
            isTouchingToolbar = true;
        }, { passive: true });

        // Prevent scrolling while touching toolbar
        this.els.audioToolbar.addEventListener('touchmove', (e) => {
            if (isTouchingToolbar) {
                e.preventDefault();
            }
        }, { passive: false });

        this.els.audioToolbar.addEventListener('touchend', (e) => {
            const endY = e.changedTouches[0].clientY;
            const deltaY = endY - startY;
            const duration = Date.now() - startTime;

            // Only register as swipe if it's quick (< 300ms) and moved enough (> 30px)
            if (duration < 300 && Math.abs(deltaY) > 30) {
                if (deltaY > 0 && !this.els.audioToolbar.classList.contains('minimized')) {
                    // Swipe down - collapse
                    this.state.toolbarExpanded = false;
                    this.els.audioToolbar.classList.add('minimized');
                } else if (deltaY < 0 && this.els.audioToolbar.classList.contains('minimized')) {
                    // Swipe up - expand
                    this.state.toolbarExpanded = true;
                    this.els.audioToolbar.classList.remove('minimized');
                }
            }
            isTouchingToolbar = false;
        }, { passive: true });
    },

    // Toolbar expand/collapse
    toggleToolbar() {
        this.state.toolbarExpanded = !this.state.toolbarExpanded;
        if (this.els.audioToolbar) {
            if (this.state.toolbarExpanded) {
                this.els.audioToolbar.classList.remove('minimized');
            } else {
                this.els.audioToolbar.classList.add('minimized');
            }
        }
    },

    // Update copy button disabled state
    updateCopyButtonState() {
        if (!this.els.copyVerseBtn) return;

        const hasSelection = this.state.verseSelection.singleSelected !== null ||
            (this.state.verseSelection.rangeStart !== null && this.state.verseSelection.rangeEnd !== null);

        if (hasSelection) {
            this.els.copyVerseBtn.classList.remove('disabled');
        } else {
            this.els.copyVerseBtn.classList.add('disabled');
        }
    },

    bindAudioControls() {
        // Play/pause button
        if (this.els.audioPlayBtn) {
            this.els.audioPlayBtn.addEventListener('click', () => {
                AudioManager.togglePlayPause();
            });
        }

        // Scrubber seek
        if (this.els.audioRange) {
            this.els.audioRange.addEventListener('input', (e) => {
                const percent = parseInt(e.target.value);
                const verseIndex = AudioManager.getVerseIndexFromProgress(percent);
                AudioManager.seekToVerse(verseIndex);
            });
        }

        // AudioManager callbacks
        AudioManager.onVerseChange = (verseNumber, verseIndex) => {
            this.handleAudioVerseChange(verseNumber);
            this.updateAudioUI();
        };

        AudioManager.onProgressUpdate = (progress, verseIndex) => {
            this.updateAudioUI();
        };

        AudioManager.onPlayStateChange = (isPlaying, isPaused) => {
            this.updateAudioPlayButton(isPlaying);
        };
    },

    handleAudioVerseChange(verseNumber) {
        if (verseNumber === null) return;

        // Remove previous audio-active
        document.querySelectorAll('.verse.audio-active').forEach(el => {
            el.classList.remove('audio-active');
        });

        // Add audio-active to current verse
        const verseEl = document.getElementById(`verse-${verseNumber}`);
        if (verseEl) {
            verseEl.classList.add('audio-active');
            verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    updateAudioUI() {
        const progress = AudioManager.getProgress();

        // Update scrubber
        if (this.els.audioRange) {
            this.els.audioRange.value = progress;
        }
        if (this.els.scrubberProgress) {
            this.els.scrubberProgress.style.width = `${progress}%`;
        }

        // Update time display
        if (this.els.audioTime) {
            this.els.audioTime.textContent = AudioManager.getTimeDisplay();
        }
    },

    updateAudioPlayButton(isPlaying) {
        if (this.els.audioPlayBtn) {
            if (isPlaying) {
                this.els.audioPlayBtn.classList.add('playing');
            } else {
                this.els.audioPlayBtn.classList.remove('playing');
            }
        }
    },

    initAudioForChapter() {
        if (this.state.chapter && this.state.chapter.verses) {
            AudioManager.setVerses(this.state.chapter.verses);
            this.updateAudioUI();
        }
    },

    stopAudio() {
        AudioManager.stop();
        document.querySelectorAll('.verse.audio-active').forEach(el => {
            el.classList.remove('audio-active');
        });
    },

    preventTextSelection() {
        // Prevent text selection via various events
        document.addEventListener('selectstart', (e) => {
            e.preventDefault();
        }, { passive: false });

        document.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });

        // Prevent text selection on double click
        document.addEventListener('mousedown', (e) => {
            if (e.detail > 1) {
                e.preventDefault();
            }
        });
    },

    bindNimbleTrigger(element, context, options = {}) {
        let pressTimer, progressCleanup, progressDelayTimer;
        let hasMoved = false;
        let startX = 0, startY = 0;

        const start = (e) => {
            hasMoved = false;
            if (e.touches && e.touches.length > 0) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            }

            // Skip progress indicator if specified (e.g., for new tab button)
            // Add 100ms delay before showing progress so single taps don't flash it
            if (!options.skipProgress) {
                progressDelayTimer = setTimeout(() => {
                    progressCleanup = this.showProgress(element, 400);
                }, 100);
            }
            pressTimer = setTimeout(() => {
                if (!hasMoved) {
                    this.startNimbleMode(context);
                }
            }, 500);
        };

        const move = (e) => {
            if (!e.touches || e.touches.length === 0) return;
            const deltaX = Math.abs(e.touches[0].clientX - startX);
            const deltaY = Math.abs(e.touches[0].clientY - startY);
            if (deltaX > 10 || deltaY > 10) {
                hasMoved = true;
                cancel();
            }
        };

        const cancel = () => {
            clearTimeout(pressTimer);
            clearTimeout(progressDelayTimer);
            if (progressCleanup) progressCleanup();
        };

        element.addEventListener('touchstart', start, { passive: true });
        element.addEventListener('touchmove', move, { passive: true });
        element.addEventListener('touchend', cancel);
        element.addEventListener('mousedown', start);
        element.addEventListener('mouseup', cancel);
        element.addEventListener('mouseleave', cancel);
    },

    // Scroll-aware tap handler to prevent accidental navigation while scrolling
    bindScrollAwareTap(element, callback) {
        let startX = 0, startY = 0;
        let hasMoved = false;

        const touchStart = (e) => {
            hasMoved = false;
            if (e.touches && e.touches.length > 0) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            }
        };

        const touchMove = (e) => {
            if (!e.touches || e.touches.length === 0) return;
            const deltaX = Math.abs(e.touches[0].clientX - startX);
            const deltaY = Math.abs(e.touches[0].clientY - startY);
            if (deltaX > 10 || deltaY > 10) {
                hasMoved = true;
            }
        };

        const touchEnd = (e) => {
            // Ignore if in navigation cooldown (prevents accidental taps on new views)
            if (this.state.navigationCooldown) {
                return;
            }
            if (!hasMoved) {
                callback();
            }
        };

        element.addEventListener('touchstart', touchStart, { passive: true });
        element.addEventListener('touchmove', touchMove, { passive: true });
        element.addEventListener('touchend', touchEnd);

        // Keep click for mouse users
        element.addEventListener('click', (e) => {
            // Only trigger if not a touch event
            if (e.pointerType !== 'touch') {
                callback();
            }
        });
    },

    showProgress(target, duration) {
        const rect = target.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        // Match CSS border-radius: big-btn uses 20px, grid-item uses 10px
        const borderRadius = target.classList.contains('big-btn') ? 20 : 10;
        const stroke = 4;
        const halfStroke = stroke / 2; // Half stroke width to center stroke on edge

        // Calculate the perimeter of the rounded rectangle
        // Perimeter = 2*(width - 2*r) + 2*(height - 2*r) + 2*π*r
        const straightWidth = width - 2 * borderRadius;
        const straightHeight = height - 2 * borderRadius;
        const arcLength = Math.PI * borderRadius;
        const perimeter = 2 * straightWidth + 2 * straightHeight + 2 * arcLength;

        // Create SVG path for rounded rectangle perimeter
        // Path follows the outside edge, offset inward by half stroke width
        // Starting from top-left (after corner), going clockwise
        // Coordinates are relative to the expanded SVG (accounting for stroke overflow)
        const svgWidth = width + stroke;
        const svgHeight = height + stroke;
        const pathData = `
            M ${borderRadius + halfStroke},${halfStroke}
            L ${svgWidth - borderRadius - halfStroke},${halfStroke}
            A ${borderRadius} ${borderRadius} 0 0 1 ${svgWidth - halfStroke},${borderRadius + halfStroke}
            L ${svgWidth - halfStroke},${svgHeight - borderRadius - halfStroke}
            A ${borderRadius} ${borderRadius} 0 0 1 ${svgWidth - borderRadius - halfStroke},${svgHeight - halfStroke}
            L ${borderRadius + halfStroke},${svgHeight - halfStroke}
            A ${borderRadius} ${borderRadius} 0 0 1 ${halfStroke},${svgHeight - borderRadius - halfStroke}
            L ${halfStroke},${borderRadius + halfStroke}
            A ${borderRadius} ${borderRadius} 0 0 1 ${borderRadius + halfStroke},${halfStroke}
        `.trim();

        const container = document.createElement('div');
        container.className = 'progress-container';
        // Adjust container positioning to account for stroke overflow on all sides
        container.style.top = `-${halfStroke}px`;
        container.style.left = `-${halfStroke}px`;
        container.style.width = `calc(100% + ${stroke}px)`;
        container.style.height = `calc(100% + ${stroke}px)`;
        container.innerHTML = `
            <svg class="progress-border" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
                <path class="progress-border__path" stroke="white" stroke-width="${stroke}"
                    fill="transparent" d="${pathData}"
                    style="stroke-dasharray: ${perimeter} ${perimeter}; stroke-dashoffset: ${perimeter};" />
            </svg>`;

        target.appendChild(container);
        container.getBoundingClientRect();

        const path = container.querySelector('path');
        path.style.transition = `stroke-dashoffset ${duration}ms linear`;
        path.style.strokeDashoffset = '0';

        return () => {
            if (container.parentNode) container.parentNode.removeChild(container);
        };
    },

    switchView(viewId, skipHistory = false) {
        // Set navigation cooldown to prevent tap events from affecting the new view
        this.state.navigationCooldown = true;
        setTimeout(() => {
            this.state.navigationCooldown = false;
        }, 100);

        document.querySelectorAll('.view').forEach(v => {
            v.classList.add('hidden');
            v.classList.remove('active');
        });
        this.els[viewId].classList.remove('hidden');
        this.els[viewId].classList.add('active');
        this.state.currentView = viewId;

        // Temporarily disable pointer events on grid-list to prevent CSS :active flash
        const gridList = this.els[viewId].querySelector('.grid-list');
        if (gridList) {
            gridList.style.pointerEvents = 'none';
            setTimeout(() => {
                gridList.style.pointerEvents = '';
            }, 100);
        }

        // Set data attribute for CSS-based toolbar/tabs visibility
        this.els.app.setAttribute('data-current-view', viewId);

        // Ensure headers are always visible for non-home views (CSS handles this, but explicit check)
        if (viewId !== 'homeView') {
            const currentHeader = this.els[viewId].querySelector('.header');
            if (currentHeader) {
                currentHeader.style.display = 'flex';
            }
        }

        // Hide toolbar when leaving verse view
        if (viewId !== 'verseView') {
            this.hideToolbar();
            this.stopAudio();
        }

        // Push state for browser back button (except home and when restoring from history)
        if (!skipHistory && viewId !== 'homeView') {
            history.pushState({
                view: viewId,
                testament: this.state.testament,
                book: this.state.book ? { name: this.state.book.name } : null,
                chapter: this.state.chapter ? { number: this.state.chapter.number } : null
            }, '', '');
        }
    },

    rebuildHistoryStack(tab) {
        // Base case: always start at home in the background stack
        history.replaceState({
            view: 'homeView',
            testament: null,
            book: null,
            chapter: null
        }, '', '');

        if (!tab || (!tab.testament && !tab.bookName)) return;

        // Push bookView (Testament selection)
        history.pushState({
            view: 'bookView',
            testament: tab.testament,
            book: null,
            chapter: null
        }, '', '');

        if (!tab.bookName) return;

        // Push chapterView (Book selected, viewing chapters)
        history.pushState({
            view: 'chapterView',
            testament: tab.testament,
            book: { name: tab.bookName },
            chapter: null
        }, '', '');

        if (!tab.chapterNumber) return;

        // Push verseListView (Chapter selected, viewing verses)
        history.pushState({
            view: 'verseListView',
            testament: tab.testament,
            book: { name: tab.bookName },
            chapter: { number: tab.chapterNumber }
        }, '', '');

        // Note: The final verseView state will be pushed naturally by switchView
        // inside the openVerseView call later in the chain.
    },

    goBack() {
        // Don't go back if we're already on home
        if (this.state.currentView === 'homeView') {
            return;
        }

        // Use browser history back when possible
        if (history.length > 1) {
            history.back();
        } else {
            // Fallback to manual navigation if no history
            this.navigateToPreviousView();
        }
    },

    goHome() {
        // Don't navigate if we're already on home
        if (this.state.currentView === 'homeView') {
            return;
        }

        // Reset state
        this.state.testament = null;
        this.state.book = null;
        this.state.chapter = null;
        this.state.verseSelection = {
            singleSelected: null,
            rangeStart: null,
            rangeEnd: null
        };
        this.hideToolbar();

        // Navigate to home
        this.switchView('homeView', true);

        // Replace history state to avoid cluttering browser history
        history.replaceState({
            view: 'homeView',
            testament: null,
            book: null,
            chapter: null
        }, '', '');
    },

    navigateToPreviousView() {
        if (this.state.currentView === 'verseView') {
            if (this.state.chapter && this.state.book) {
                this.openVerseList(this.state.chapter, true);
            } else {
                this.switchView('homeView', true);
            }
        } else if (this.state.currentView === 'verseListView') {
            if (this.state.book) {
                this.openChapterList(this.state.book, true);
            } else {
                this.switchView('homeView', true);
            }
        } else if (this.state.currentView === 'chapterView') {
            if (this.state.testament) {
                this.openBookList(this.state.testament, true);
            } else {
                this.switchView('homeView', true);
            }
        } else if (this.state.currentView === 'bookView') {
            this.switchView('homeView', true);
        }
    },

    restoreFromHistory(state) {
        if (!state || state.view === 'homeView') {
            this.state.testament = null;
            this.state.book = null;
            this.state.chapter = null;
            this.switchView('homeView', true);
            this.closeSearch();
            return;
        }

        // Close search if we are navigating somewhere else
        this.closeSearch();

        // Restore state
        this.state.testament = state.testament || null;

        // Restore book if we have testament
        if (state.testament && state.book) {
            const books = DataManager.getTestamentBooks(state.testament);
            this.state.book = books.find(b => b.name === state.book.name) || null;
        } else {
            this.state.book = null;
        }

        // Restore chapter if we have book
        if (this.state.book && state.chapter) {
            this.state.chapter = this.state.book.chapters.find(c => c.number === state.chapter.number) || null;
        } else {
            this.state.chapter = null;
        }

        // Navigate to the appropriate view
        if (state.view === 'verseView' && this.state.chapter) {
            this.openVerseView(this.state.chapter, 1, true);
        } else if (state.view === 'verseListView' && this.state.chapter) {
            this.openVerseList(this.state.chapter, true);
        } else if (state.view === 'chapterView' && this.state.book) {
            this.openChapterList(this.state.book, true);
        } else if (state.view === 'bookView' && this.state.testament) {
            this.openBookList(this.state.testament, true);
        } else {
            this.switchView('homeView', true);
        }
    },

    renderHome() {
        this.switchView('homeView');
    },

    openBookList(testament, skipHistory = false) {
        this.state.testament = testament;
        this.els.testamentTitle.textContent = testament;

        const books = DataManager.getTestamentBooks(testament);
        this.els.bookList.innerHTML = '';

        books.forEach((book, index) => {
            const div = document.createElement('div');
            div.className = 'grid-item';
            div.textContent = book.name;
            this.bindScrollAwareTap(div, () => this.openChapterList(book));
            div.dataset.index = index;
            div.dataset.type = 'book';
            div.data = book;

            // Bind nimble trigger for long press navigation
            this.bindNimbleTrigger(div, {
                testament: testament,
                book: book
            });

            this.els.bookList.appendChild(div);
        });

        this.switchView('bookView', skipHistory);
    },

    openChapterList(book, skipHistory = false) {
        this.state.book = book;
        this.els.bookTitle.textContent = book.name;

        this.els.chapterList.innerHTML = '';
        book.chapters.forEach((chapter, index) => {
            const div = document.createElement('div');
            div.className = 'grid-item';
            div.textContent = `ch. ${chapter.number}`;
            this.bindScrollAwareTap(div, () => this.openVerseList(chapter));
            div.dataset.index = index;
            div.dataset.type = 'chapter';
            div.data = chapter;

            // Bind nimble trigger for long press navigation
            this.bindNimbleTrigger(div, {
                testament: this.state.testament,
                book: book,
                chapter: chapter
            });

            this.els.chapterList.appendChild(div);
        });

        this.switchView('chapterView', skipHistory);
    },

    openVerseList(chapter, skipHistory = false) {
        this.state.chapter = chapter;
        this.els.verseListTitle.textContent = `${this.state.book.name} ${chapter.number}`;

        this.els.verseList.innerHTML = '';
        chapter.verses.forEach((verse, index) => {
            const div = document.createElement('div');
            div.className = 'grid-item';
            div.textContent = `v. ${verse.number}`;
            this.bindScrollAwareTap(div, () => this.openVerseView(chapter, verse.number));
            div.dataset.index = index;
            div.dataset.type = 'verse';
            div.data = verse;

            // Bind nimble trigger for long press navigation
            this.bindNimbleTrigger(div, {
                testament: this.state.testament,
                book: this.state.book,
                chapter: chapter,
                verse: verse.number
            });

            this.els.verseList.appendChild(div);
        });

        this.switchView('verseListView', skipHistory);
    },

    openVerseView(chapter, targetVerseNum = 1, skipHistory = false, skipAutoScroll = false, highlightRange = null) {
        this.state.chapter = chapter;
        this.state.targetVerseNum = targetVerseNum; // Track for tab labels
        this.state.targetVerseRangeEnd = null; // Reset range end
        this.els.chapterTitle.textContent = `${this.state.book.name} ${chapter.number}`;

        // Reset verse selection
        this.state.verseSelection = {
            singleSelected: null,
            rangeStart: null,
            rangeEnd: null
        };
        this.hideToolbar();

        this.els.verseContent.innerHTML = '';
        chapter.verses.forEach(verse => {
            const p = document.createElement('div');
            p.className = 'verse';
            p.id = `verse-${verse.number}`;
            p.dataset.verseNumber = verse.number;
            p.innerHTML = `<span class="verse-num">${verse.number}</span>${verse.text}`;

            if (!highlightRange && verse.number === targetVerseNum && targetVerseNum !== 1) {
                // Use nimble target styling for navigated-to verses (not default verse 1)
                p.classList.add('nimble-target');
                // After animation completes, switch to visited state with just the stripe
                setTimeout(() => {
                    p.classList.remove('nimble-target');
                    p.classList.add('nimble-target-visited');
                }, 1000);
            }

            // Add verse selection handlers
            this.bindVerseSelection(p, verse);

            this.els.verseContent.appendChild(p);
        });

        // Apply highlight range if provided (from nimble verse range drag)
        if (highlightRange) {
            const rangeStart = Math.min(highlightRange.start, highlightRange.end);
            const rangeEnd = Math.max(highlightRange.start, highlightRange.end);
            this.state.targetVerseRangeEnd = rangeEnd;
            // Use the white stripe style (nimble-target-visited) for range highlight
            for (let i = rangeStart; i <= rangeEnd; i++) {
                const el = document.getElementById(`verse-${i}`);
                if (el) {
                    el.classList.add('nimble-target-visited');
                }
            }
        }

        // Set navigation cooldown to prevent the tap that triggered navigation
        // from also selecting a verse in the newly rendered view
        this.state.navigationCooldown = true;
        setTimeout(() => {
            this.state.navigationCooldown = false;
        }, 150);

        this.switchView('verseView', skipHistory);

        // Only auto-scroll if not restoring tab scroll position
        if (!skipAutoScroll) {
            setTimeout(() => {
                const scrollTarget = targetVerseNum;
                const el = document.getElementById(`verse-${scrollTarget}`);
                if (el && this.els.verseContent) {
                    // Safe scrolling that doesn't trigger mobile browser top-bar hide bugs
                    // by strictly scrolling the container, not the document.
                    const container = this.els.verseContent;

                    // Calculate center position relative to the container
                    const targetTop = el.offsetTop;
                    const centerOffset = (container.clientHeight / 2) - (el.clientHeight / 2);

                    container.scrollTo({
                        top: Math.max(0, targetTop - centerOffset),
                        behavior: 'smooth'
                    });
                }
            }, 100);
        }

        // Initialize audio for this chapter
        this.initAudioForChapter();

        // Update tab state (skip if restoring from tab switch to avoid overwriting)
        if (!skipAutoScroll) {
            this.updateCurrentTabFromNavigation();
        }
    },

    // NIMBLE NAVIGATION - Uses standard views directly
    startNimbleMode(context) {
        if (this.state.nimble.active) return;

        this.state.nimble.active = true;

        // If starting from new tab button, create tab first then go to home
        if (context.fromNewTab) {
            this.createNewTab();
            // Now start nimble from home with no preset testament
            // User needs to pick OT or NT first, but we're already on home
            // The nimble mode is now active and will respond to touch moves
            if (navigator.vibrate) navigator.vibrate(50);
            return;
        }

        // Determine starting view based on context
        if (context.testament && !context.book) {
            // Starting from home: open book list
            this.openBookList(context.testament);
        } else if (context.book && !context.chapter) {
            // Starting from book view: open chapter list
            this.openChapterList(context.book);
        } else if (context.chapter && !context.verse) {
            // Starting from chapter view: open verse list
            this.openVerseList(context.chapter);
        } else if (context.chapter && context.verse) {
            // Starting from verse list: open verse view
            this.openVerseView(context.chapter, context.verse);
        } else {
            // Fallback: if we have testament, start from book list
            if (context.testament) {
                this.openBookList(context.testament);
            } else if (this.state.testament) {
                // Use current state if available
                if (this.state.chapter) {
                    this.openVerseList(this.state.chapter);
                } else if (this.state.book) {
                    this.openChapterList(this.state.book);
                } else {
                    this.openBookList(this.state.testament);
                }
            }
        }

        if (navigator.vibrate) navigator.vibrate(50);
    },

    handleNimbleMove(e) {
        e.preventDefault();

        const touch = e.touches[0];

        // === Verse drag sub-mode: track which verse grid item the finger is over ===
        if (this.state.nimble.verseAnchor !== null) {
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            const itemEl = target?.closest('.grid-item');
            if (itemEl && itemEl.dataset.type === 'verse' && itemEl.data) {
                const verseNum = itemEl.data.number;
                if (verseNum !== this.state.nimble.verseDragEnd) {
                    this.state.nimble.verseDragEnd = verseNum;
                    // Highlight range visually on the grid
                    this.highlightNimbleVerseRange();
                    if (navigator.vibrate) navigator.vibrate(10);
                }
            }
            return;
        }

        // Auto-scroll logic using requestAnimationFrame for smooth scrolling
        const activeList = document.querySelector('.view.active .grid-list');
        if (activeList) {
            const listRect = activeList.getBoundingClientRect();
            const scrollThreshold = 80;

            let newDirection = 0;
            if (touch.clientY > listRect.bottom - scrollThreshold) {
                // Calculate speed based on how far into the threshold (faster at edge)
                const depth = (touch.clientY - (listRect.bottom - scrollThreshold)) / scrollThreshold;
                newDirection = Math.min(1, depth); // 0 to 1
            } else if (touch.clientY < listRect.top + scrollThreshold) {
                const depth = ((listRect.top + scrollThreshold) - touch.clientY) / scrollThreshold;
                newDirection = -Math.min(1, depth); // -1 to 0
            }

            if (newDirection !== 0 && this.state.nimbleScrollDirection === 0) {
                // Start scrolling - cancel any hover state and remove visual highlight
                this.cancelHover();
                document.querySelectorAll('.grid-item.active').forEach(el => el.classList.remove('active'));
                document.querySelectorAll('.big-btn.active').forEach(el => el.classList.remove('active'));
                this.state.nimbleScrollDirection = newDirection;
                this.startNimbleScroll(activeList);
            } else if (newDirection === 0 && this.state.nimbleScrollDirection !== 0) {
                // Stop scrolling
                this.stopNimbleScroll();
            } else {
                // Update direction/speed
                this.state.nimbleScrollDirection = newDirection;
            }
        }

        // Skip element detection while scrolling
        if (this.state.nimbleScrollDirection !== 0) {
            return;
        }

        const target = document.elementFromPoint(touch.clientX, touch.clientY);

        // Exclude toolbar and tabs bar from nimble navigation
        if (target?.closest('.audio-toolbar') || target?.closest('.tabs-bar')) {
            if (this.state.nimble.currentItem) this.cancelHover();
            return;
        }

        // Check for grid items (book/chapter/verse lists)
        let itemEl = target?.closest('.grid-item');

        // Also check for home view big buttons (OT/NT)
        if (!itemEl) {
            itemEl = target?.closest('.big-btn');
        }

        if (!itemEl) {
            if (this.state.nimble.currentItem) this.cancelHover();
            return;
        }

        // Verify the element is in the active view
        const activeView = document.querySelector('.view.active');
        if (!activeView?.contains(itemEl)) return;

        if (this.state.nimble.currentItem !== itemEl) {
            this.highlightItem(itemEl);
            this.startHoverTimer(itemEl);
        }
    },

    highlightItem(itemEl) {
        this.cancelHover();

        // Clear active state from grid items
        const activeList = document.querySelector('.view.active .grid-list');
        if (activeList) {
            activeList.querySelectorAll('.grid-item').forEach(el => el.classList.remove('active'));
        }

        // Clear active state from big buttons (home view)
        document.querySelectorAll('.big-btn.active').forEach(el => el.classList.remove('active'));

        itemEl.classList.add('active');
        this.state.nimble.currentItem = itemEl;
    },

    startHoverTimer(itemEl) {
        // Progress indicator starts after 200ms delay
        const progressDelayTimer = setTimeout(() => {
            this.state.nimble.progressCleanup = this.showProgress(itemEl, 400);
        }, 150);

        // Store progress delay timer for cleanup
        this.state.nimble.progressDelayTimer = progressDelayTimer;

        // Total hover time is still 1000ms
        this.state.nimble.timer = setTimeout(() => {
            this.handleHoverComplete(itemEl);
        }, 600);
    },

    cancelHover() {
        if (this.state.nimble.timer) {
            clearTimeout(this.state.nimble.timer);
            this.state.nimble.timer = null;
        }
        if (this.state.nimble.progressDelayTimer) {
            clearTimeout(this.state.nimble.progressDelayTimer);
            this.state.nimble.progressDelayTimer = null;
        }
        if (this.state.nimble.progressCleanup) {
            this.state.nimble.progressCleanup();
            this.state.nimble.progressCleanup = null;
        }
        this.state.nimble.currentItem = null;
    },

    handleHoverComplete(itemEl) {
        if (navigator.vibrate) navigator.vibrate(20);

        if (this.state.nimble.progressDelayTimer) {
            clearTimeout(this.state.nimble.progressDelayTimer);
            this.state.nimble.progressDelayTimer = null;
        }
        if (this.state.nimble.progressCleanup) {
            this.state.nimble.progressCleanup();
            this.state.nimble.progressCleanup = null;
        }

        const type = itemEl.dataset.type;
        const data = itemEl.data;

        // Handle home view big buttons (OT/NT)
        if (itemEl.classList.contains('big-btn')) {
            const testament = itemEl.dataset.testament;
            if (testament) {
                this.openBookList(testament);
            }
        } else if (type === 'book') {
            this.openChapterList(data);
        } else if (type === 'chapter') {
            this.openVerseList(data);
        } else if (type === 'verse') {
            // Enter verse drag sub-mode: store anchor and wait for drag or release
            this.state.nimble.verseAnchor = data.number;
            this.state.nimble.verseDragEnd = data.number;
            // Mark the anchor item visually
            itemEl.classList.add('nimble-anchor');
        }

        this.state.nimble.currentItem = null;
    },

    startNimbleScroll(list) {
        const baseSpeed = 15; // pixels per frame at max speed

        const scroll = () => {
            if (this.state.nimbleScrollDirection === 0) {
                this.state.nimbleScrollAnimationId = null;
                return;
            }

            // Speed is proportional to how far into the threshold zone
            const speed = baseSpeed * Math.abs(this.state.nimbleScrollDirection);
            list.scrollTop += speed * Math.sign(this.state.nimbleScrollDirection);

            this.state.nimbleScrollAnimationId = requestAnimationFrame(scroll);
        };

        if (!this.state.nimbleScrollAnimationId) {
            this.state.nimbleScrollAnimationId = requestAnimationFrame(scroll);
        }
    },

    stopNimbleScroll() {
        this.state.nimbleScrollDirection = 0;
        if (this.state.nimbleScrollAnimationId) {
            cancelAnimationFrame(this.state.nimbleScrollAnimationId);
            this.state.nimbleScrollAnimationId = null;
        }
    },

    endNimbleMode() {
        const wasActive = this.state.nimble.active;
        const verseAnchor = this.state.nimble.verseAnchor;
        const verseDragEnd = this.state.nimble.verseDragEnd;

        this.state.nimble.active = false;
        this.state.nimble.verseAnchor = null;
        this.state.nimble.verseDragEnd = null;
        this.cancelHover();
        this.stopNimbleScroll();
        document.querySelectorAll('.grid-item.active').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.grid-item.nimble-anchor').forEach(el => el.classList.remove('nimble-anchor'));
        document.querySelectorAll('.grid-item.nimble-range').forEach(el => el.classList.remove('nimble-range'));
        document.querySelectorAll('.big-btn.active').forEach(el => el.classList.remove('active'));

        if (!wasActive) return;

        // If we had a verse anchor (long-pressed a verse in the grid)
        if (verseAnchor !== null && this.state.chapter) {
            if (verseDragEnd !== null && verseDragEnd !== verseAnchor) {
                // Dragged to a different verse: open with range highlighted
                const rangeStart = Math.min(verseAnchor, verseDragEnd);
                const rangeEnd = Math.max(verseAnchor, verseDragEnd);
                this.openVerseView(this.state.chapter, rangeStart, false, false, {
                    start: rangeStart,
                    end: rangeEnd
                });
            } else {
                // Released on the same verse: open at that specific verse
                this.openVerseView(this.state.chapter, verseAnchor);
            }
            return;
        }

        // If on verse list view with no anchor, auto-open chapter at verse 1
        if (this.state.currentView === 'verseListView' && this.state.chapter) {
            this.openVerseView(this.state.chapter, 1);
        }
    },

    // Highlight verse grid items in the range during nimble verse drag
    highlightNimbleVerseRange() {
        const anchor = this.state.nimble.verseAnchor;
        const dragEnd = this.state.nimble.verseDragEnd;
        if (anchor === null || dragEnd === null) return;

        const rangeStart = Math.min(anchor, dragEnd);
        const rangeEnd = Math.max(anchor, dragEnd);

        // Clear all range highlights and anchor highlights
        document.querySelectorAll('.grid-item.nimble-range').forEach(el => el.classList.remove('nimble-range'));
        document.querySelectorAll('.grid-item.nimble-anchor').forEach(el => el.classList.remove('nimble-anchor'));
        document.querySelectorAll('.grid-item.active').forEach(el => el.classList.remove('active'));

        // Highlight all verse grid items in range
        const activeList = document.querySelector('.view.active .grid-list');
        if (!activeList) return;

        activeList.querySelectorAll('.grid-item').forEach(el => {
            if (el.dataset.type === 'verse' && el.data) {
                const num = el.data.number;
                if (num >= rangeStart && num <= rangeEnd) {
                    if (num === anchor) {
                        el.classList.add('nimble-anchor');
                    } else {
                        el.classList.add('nimble-range');
                    }
                }
            }
        });
    },

    bindVerseSelection(verseEl, verse) {
        let pressTimer;
        let isLongPress = false;
        let startX = 0;
        let startY = 0;
        let hasMoved = false;
        let isRangeDragActive = false;
        let rangeAnchorVerse = null;
        let lastDraggedVerse = null;
        let hasDraggedRange = false;
        let mouseTracking = false;

        const getPoint = (e) => {
            if (e.touches && e.touches.length > 0) {
                return { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
            if (e.changedTouches && e.changedTouches.length > 0) {
                return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
            }
            if (e.clientX !== undefined && e.clientY !== undefined) {
                return { x: e.clientX, y: e.clientY };
            }
            return null;
        };

        const handleStart = (e) => {
            hasMoved = false;
            isLongPress = false;
            isRangeDragActive = false;
            rangeAnchorVerse = null;
            lastDraggedVerse = null;
            hasDraggedRange = false;

            const point = getPoint(e);
            if (point) {
                startX = point.x;
                startY = point.y;
            }

            if (e.type === 'mousedown') {
                startMouseTracking();
            }

            pressTimer = setTimeout(() => {
                if (hasMoved) return;

                const anchorVerse = this.handleVerseLongPress(verseEl);
                if (anchorVerse !== null) {
                    isLongPress = true;
                    isRangeDragActive = true;
                    rangeAnchorVerse = anchorVerse;
                    lastDraggedVerse = anchorVerse;
                    hasDraggedRange = false;
                }
            }, 450);
        };

        const handleMove = (e) => {
            const point = getPoint(e);
            if (!point) return;

            if (isRangeDragActive && rangeAnchorVerse !== null) {
                const hoveredVerseEl = this.getVerseElementFromPoint(point.x, point.y);
                if (hoveredVerseEl) {
                    const hoveredVerseNum = parseInt(hoveredVerseEl.dataset.verseNumber, 10);
                    if (!Number.isNaN(hoveredVerseNum) && hoveredVerseNum !== lastDraggedVerse) {
                        this.setVerseRangeSelection(rangeAnchorVerse, hoveredVerseNum);
                        lastDraggedVerse = hoveredVerseNum;
                        if (hoveredVerseNum !== rangeAnchorVerse) {
                            hasDraggedRange = true;
                        }
                    }
                }

                if (e.cancelable) {
                    e.preventDefault();
                }
                return;
            }

            const deltaX = Math.abs(point.x - startX);
            const deltaY = Math.abs(point.y - startY);

            // If moved more than 10px before long press, treat as scroll intent.
            if (deltaX > 10 || deltaY > 10) {
                hasMoved = true;
                clearTimeout(pressTimer);
            }
        };

        const handleEnd = (e) => {
            clearTimeout(pressTimer);

            // Ignore if in navigation cooldown (prevents accidental selection when switching views)
            if (this.state.navigationCooldown) {
                stopMouseTracking();
                hasMoved = false;
                isLongPress = false;
                isRangeDragActive = false;
                rangeAnchorVerse = null;
                lastDraggedVerse = null;
                hasDraggedRange = false;
                return;
            }

            if (isRangeDragActive) {
                if (e.cancelable) {
                    e.preventDefault();
                }
                e.stopPropagation();

                if (!hasDraggedRange && rangeAnchorVerse !== null) {
                    this.clearVerseSelection();
                    const anchorEl = document.getElementById(`verse-${rangeAnchorVerse}`);
                    if (anchorEl) {
                        this.state.verseSelection.singleSelected = rangeAnchorVerse;
                        anchorEl.classList.add('selected');
                        this.showToolbar();
                    }
                }

                stopMouseTracking();
                hasMoved = false;
                isLongPress = false;
                isRangeDragActive = false;
                rangeAnchorVerse = null;
                lastDraggedVerse = null;
                hasDraggedRange = false;
                return;
            }

            // Only handle single tap if there was no movement and no long press occurred.
            if (!hasMoved && !isLongPress) {
                if (e.cancelable) {
                    e.preventDefault();
                }
                e.stopPropagation();
                this.handleVerseSingleTap(verseEl, verse);
            }

            // Reset flags for next interaction
            stopMouseTracking();
            isLongPress = false;
            hasMoved = false;
            isRangeDragActive = false;
            rangeAnchorVerse = null;
            lastDraggedVerse = null;
            hasDraggedRange = false;
        };

        const handleCancel = () => {
            clearTimeout(pressTimer);
            stopMouseTracking();
            hasMoved = false;
            isLongPress = false;
            isRangeDragActive = false;
            rangeAnchorVerse = null;
            lastDraggedVerse = null;
            hasDraggedRange = false;
        };

        const startMouseTracking = () => {
            if (mouseTracking) return;
            mouseTracking = true;
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleEnd);
        };

        const stopMouseTracking = () => {
            if (!mouseTracking) return;
            mouseTracking = false;
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
        };

        // Touch events
        verseEl.addEventListener('touchstart', handleStart, { passive: true });
        verseEl.addEventListener('touchmove', handleMove, { passive: false });
        verseEl.addEventListener('touchend', handleEnd, { passive: false });
        verseEl.addEventListener('touchcancel', handleCancel, { passive: true });

        // Mouse events (for desktop/testing)
        verseEl.addEventListener('mousedown', handleStart);

        // Prevent context menu
        verseEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Prevent text selection via CSS and JS
        verseEl.addEventListener('selectstart', (e) => {
            e.preventDefault();
        });
    },

    getVerseElementFromPoint(x, y) {
        const target = document.elementFromPoint(x, y);
        return target ? target.closest('.verse') : null;
    },

    setVerseRangeSelection(anchorVerse, endVerse) {
        if (anchorVerse === null || endVerse === null) return;

        this.state.verseSelection.singleSelected = null;
        this.state.verseSelection.rangeStart = Math.min(anchorVerse, endVerse);
        this.state.verseSelection.rangeEnd = Math.max(anchorVerse, endVerse);
        this.updateVerseRangeSelection();
        this.showToolbar();
    },

    handleVerseSingleTap(verseEl, verse) {
        const verseNum = parseInt(verseEl.dataset.verseNumber);

        // If we have a range selection, clear it first
        if (this.state.verseSelection.rangeStart !== null || this.state.verseSelection.rangeEnd !== null) {
            this.clearVerseSelection();
        }

        // If this verse is already selected, deselect it
        if (this.state.verseSelection.singleSelected === verseNum) {
            this.state.verseSelection.singleSelected = null;
            verseEl.classList.remove('selected');
            this.hideToolbar();
        } else {
            // Deselect previous single selection
            if (this.state.verseSelection.singleSelected !== null) {
                const prevEl = document.getElementById(`verse-${this.state.verseSelection.singleSelected}`);
                if (prevEl) prevEl.classList.remove('selected');
            }

            // Select this verse
            this.state.verseSelection.singleSelected = verseNum;
            verseEl.classList.add('selected');
            this.showToolbar();
        }
    },

    handleVerseLongPress(verseEl) {
        const verseNum = parseInt(verseEl.dataset.verseNumber, 10);
        if (Number.isNaN(verseNum)) {
            return null;
        }

        this.setVerseRangeSelection(verseNum, verseNum);
        return verseNum;
    },

    updateVerseRangeSelection() {
        // Clear all selections first
        document.querySelectorAll('.verse').forEach(el => {
            el.classList.remove('selected', 'range-selected');
        });

        const start = this.state.verseSelection.rangeStart;
        const end = this.state.verseSelection.rangeEnd;

        if (start !== null && end !== null) {
            for (let i = start; i <= end; i++) {
                const el = document.getElementById(`verse-${i}`);
                if (el) {
                    el.classList.add('range-selected');
                }
            }
        }
    },

    clearVerseSelection() {
        document.querySelectorAll('.verse').forEach(el => {
            el.classList.remove('selected', 'range-selected');
        });
        this.state.verseSelection = {
            singleSelected: null,
            rangeStart: null,
            rangeEnd: null
        };
        this.hideToolbar();
    },

    showToolbar() {
        // Update copy button state when showing toolbar context
        this.updateCopyButtonState();
    },

    hideToolbar() {
        // Update copy button state (will disable it)
        this.updateCopyButtonState();
    },

    copySelectedVerses() {
        const selection = this.state.verseSelection;
        let textToCopy = '';

        if (selection.singleSelected !== null) {
            const verse = this.state.chapter.verses.find(v => v.number === selection.singleSelected);
            if (verse) {
                textToCopy = `${this.state.book.name} ${this.state.chapter.number}:${verse.number} ${verse.text}`;
            }
        } else if (selection.rangeStart !== null && selection.rangeEnd !== null) {
            const verses = this.state.chapter.verses.filter(v =>
                v.number >= selection.rangeStart && v.number <= selection.rangeEnd
            );
            if (verses.length > 0) {
                const verseTexts = verses.map(v => `${v.number} ${v.text}`).join(' ');
                textToCopy = `${this.state.book.name} ${this.state.chapter.number}:${verses[0].number}-${verses[verses.length - 1].number} ${verseTexts}`;
            }
        }

        if (textToCopy) {
            // Copy to clipboard
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(textToCopy).catch(err => {
                    console.error('Failed to copy text:', err);
                    this.fallbackCopyText(textToCopy);
                });
            } else {
                this.fallbackCopyText(textToCopy);
            }
        }
    },

    fallbackCopyText(textToCopy) {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('Fallback copy failed:', err);
        }
        document.body.removeChild(textArea);
    },

    showAllTabsOptionsMenu() {
        if (!this.els.tabOptionsBtn) return;

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'tab-options-overlay';
        overlay.innerHTML = `
            <div class="tab-options-popup">
                <p>All Tabs Options</p>
                <div class="tab-options-buttons">
                    <button class="tab-options-action" id="copy-all-tabs-btn">Copy Passage References</button>
                    <button class="tab-options-danger" id="close-all-tabs-btn">Close All Open Tabs</button>
                    <button class="tab-options-cancel">Cancel</button>
                </div>
            </div>
        `;

        // Cancel button
        overlay.querySelector('.tab-options-cancel').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        // Copy All button
        overlay.querySelector('#copy-all-tabs-btn').addEventListener('click', () => {
            const passageTabs = this.state.tabs.filter(t => !this.isHomeTab(t));
            if (passageTabs.length > 0) {
                const textToCopy = passageTabs.map(t => this.getTabLabel(t)).join(', ');
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(textToCopy).catch(err => {
                        console.error('Failed to copy tabs text:', err);
                        this.fallbackCopyText(textToCopy);
                    });
                } else {
                    this.fallbackCopyText(textToCopy);
                }
            }
            document.body.removeChild(overlay);
        });

        // Close All button
        overlay.querySelector('#close-all-tabs-btn').addEventListener('click', () => {
            // Reset to a single home tab
            this.state.tabs = [{
                id: this.state.nextTabId++,
                testament: null,
                bookName: null,
                chapterNumber: null,
                scrollPosition: 0
            }];
            this.state.activeTabId = this.state.tabs[0].id;

            this.saveStateToLocalStorage(); // Persist

            this.goHome();
            this.renderTabs();
            document.body.removeChild(overlay);
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });

        document.body.appendChild(overlay);
    },

    // === TAB MANAGEMENT ===

    getBookAbbreviation(bookName) {
        return this.bookAbbreviations[bookName] || bookName.substring(0, 3).toUpperCase();
    },

    isHomeTab(tab) {
        return !!tab && !tab.bookName && !tab.chapterNumber;
    },

    dedupeHomeTabs() {
        const homeTabs = this.state.tabs.filter(tab => this.isHomeTab(tab));
        if (homeTabs.length <= 1) return;

        const activeTab = this.state.tabs.find(tab => tab.id === this.state.activeTabId);
        const keepHomeTabId = activeTab && this.isHomeTab(activeTab)
            ? activeTab.id
            : homeTabs[0].id;

        this.state.tabs = this.state.tabs.filter(tab => !this.isHomeTab(tab) || tab.id === keepHomeTabId);
    },

    getTabLabel(tab) {
        if (!tab.bookName || !tab.chapterNumber) {
            return 'Home';
        }
        let label = `${this.getBookAbbreviation(tab.bookName)}${tab.chapterNumber}`;
        if (tab.verseNumber) {
            label += `:${tab.verseNumber}`;
            if (tab.verseRangeEnd && tab.verseRangeEnd !== tab.verseNumber) {
                label += `-${tab.verseRangeEnd}`;
            }
        }
        return label;
    },

    createNewTab() {
        // Save current tab state before creating new one
        this.saveCurrentTabState();

        // Check if there's already a home tab (a tab with no book/chapter)
        const existingHomeTab = this.state.tabs.find(t => this.isHomeTab(t));
        if (existingHomeTab) {
            // Reuse existing home tab
            this.state.activeTabId = existingHomeTab.id;
            this.goHome();
            this.renderTabs();
            return;
        }

        // Create new tab
        const newTab = {
            id: this.state.nextTabId++,
            testament: null,
            bookName: null,
            chapterNumber: null,
            verseNumber: null,
            scrollPosition: 0
        };

        this.state.tabs.push(newTab);
        this.state.activeTabId = newTab.id;

        this.saveStateToLocalStorage(); // Persist

        // Navigate to home
        this.goHome();
        this.renderTabs();
    },

    saveCurrentTabState() {
        if (this.state.activeTabId === null) return;

        const currentTab = this.state.tabs.find(t => t.id === this.state.activeTabId);
        if (!currentTab) return;

        currentTab.testament = this.state.testament;
        currentTab.bookName = this.state.book?.name || null;
        currentTab.chapterNumber = this.state.chapter?.number || null;
        currentTab.verseNumber = this.state.targetVerseNum || null;
        currentTab.verseRangeEnd = this.state.targetVerseRangeEnd || null;

        // Save scroll position if in verse view
        if (this.state.currentView === 'verseView' && this.els.verseContent) {
            currentTab.scrollPosition = this.els.verseContent.scrollTop;
        }

        // Prevent duplicate home tabs from appearing
        this.dedupeHomeTabs();

        this.saveStateToLocalStorage(); // Persist
    },

    switchTab(tabId, restoreHistory = false) {
        if (tabId === this.state.activeTabId && !restoreHistory) return;

        // Save current tab state if we aren't bootstrapping
        if (!restoreHistory) {
            this.saveCurrentTabState();
        }

        // Switch to new tab
        const tab = this.state.tabs.find(t => t.id === tabId);
        if (!tab) return;

        this.state.activeTabId = tabId;

        // Restore tab state
        if (tab.bookName && tab.chapterNumber) {
            // Rebuild physical browser history tree if requested (e.g. app init)
            if (restoreHistory) {
                this.rebuildHistoryStack(tab);
            }

            // Need to restore the full navigation state
            this.state.testament = tab.testament;

            // Find book and chapter from the data
            const books = DataManager.getTestamentBooks(tab.testament);
            const book = books.find(b => b.name === tab.bookName);
            if (book) {
                this.state.book = book;
                const chapter = book.chapters.find(c => c.number === tab.chapterNumber);
                if (chapter) {
                    // Pass skipAutoScroll=true to prevent auto-scroll to verse
                    // Restore verse range highlight if this tab had one
                    const restoreRange = (tab.verseRangeEnd && tab.verseNumber && tab.verseRangeEnd !== tab.verseNumber)
                        ? { start: tab.verseNumber, end: tab.verseRangeEnd }
                        : null;
                    this.openVerseView(chapter, tab.verseNumber || 1, true, true, restoreRange);

                    // Restore scroll position with smooth animation after view is rendered
                    if (tab.scrollPosition !== undefined && this.els.verseContent) {
                        setTimeout(() => {
                            this.els.verseContent.scrollTo({
                                top: tab.scrollPosition,
                                behavior: 'smooth'
                            });
                        }, 50);
                    }
                }
            }
        } else {
            // Tab is on home
            this.goHome();
        }

        this.renderTabs();
        this.saveStateToLocalStorage(); // Persist
    },

    updateCurrentTabFromNavigation() {
        // Called when user navigates to update the current tab
        if (this.state.activeTabId === null) {
            // Create initial tab if none exists
            const initialTab = {
                id: this.state.nextTabId++,
                testament: this.state.testament,
                bookName: this.state.book?.name || null,
                chapterNumber: this.state.chapter?.number || null,
                verseNumber: this.state.targetVerseNum || null,
                scrollPosition: 0
            };
            this.state.tabs.push(initialTab);
            this.state.activeTabId = initialTab.id;
        } else {
            this.saveCurrentTabState();
        }
        this.renderTabs();
    },

    renderTabs() {
        if (!this.els.tabsContainer) return;

        this.dedupeHomeTabs();
        this.els.tabsContainer.innerHTML = '';

        this.state.tabs.forEach(tab => {
            const tabEl = document.createElement('button');
            tabEl.className = 'tab-item' + (tab.id === this.state.activeTabId ? ' active' : '');
            tabEl.textContent = this.getTabLabel(tab);

            // Single tap to switch
            tabEl.addEventListener('click', () => this.switchTab(tab.id));

            // Long press to delete
            this.bindTabLongPress(tabEl, tab);

            this.els.tabsContainer.appendChild(tabEl);
        });

        this.updateTabsBarVisibility();
    },

    bindTabLongPress(tabEl, tab) {
        let pressTimer = null;
        let isLongPress = false;
        let startX = 0;
        let startY = 0;
        let hasMoved = false;

        const startPress = (e) => {
            isLongPress = false;
            hasMoved = false;

            // Get starting position
            if (e.touches && e.touches.length > 0) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            } else if (e.clientX !== undefined) {
                startX = e.clientX;
                startY = e.clientY;
            }

            pressTimer = setTimeout(() => {
                if (!hasMoved) {
                    isLongPress = true;
                    this.showTabOptionsMenu(tab);
                }
            }, 600); // 600ms for long press
        };

        const moveHandler = (e) => {
            let currentX, currentY;
            if (e.touches && e.touches.length > 0) {
                currentX = e.touches[0].clientX;
                currentY = e.touches[0].clientY;
            } else if (e.clientX !== undefined) {
                currentX = e.clientX;
                currentY = e.clientY;
            } else {
                return;
            }

            const deltaX = Math.abs(currentX - startX);
            const deltaY = Math.abs(currentY - startY);

            // If moved more than 10px, consider it scrolling/swiping
            if (deltaX > 10 || deltaY > 10) {
                hasMoved = true;
                clearTimeout(pressTimer);
            }
        };

        const endPress = (e) => {
            clearTimeout(pressTimer);
            if (isLongPress) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        const cancelPress = () => {
            clearTimeout(pressTimer);
            hasMoved = false;
        };

        tabEl.addEventListener('touchstart', startPress, { passive: true });
        tabEl.addEventListener('touchmove', moveHandler, { passive: true });
        tabEl.addEventListener('touchend', endPress, { passive: false });
        tabEl.addEventListener('touchcancel', cancelPress);
        tabEl.addEventListener('mousedown', startPress);
        tabEl.addEventListener('mousemove', moveHandler);
        tabEl.addEventListener('mouseup', endPress);
        tabEl.addEventListener('mouseleave', cancelPress);
    },

    showTabOptionsMenu(tab) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'tab-options-overlay';
        overlay.innerHTML = `
            <div class="tab-options-popup">
                <p>Tab: ${this.getTabLabel(tab)}</p>
                <div class="tab-options-buttons">
                    <button class="tab-options-action" id="copy-single-tab-btn">Copy Passage Reference</button>
                    <button class="tab-options-danger" id="close-single-tab-btn">Close Tab</button>
                    <button class="tab-options-cancel">Cancel</button>
                </div>
            </div>
        `;

        // Cancel button
        overlay.querySelector('.tab-options-cancel').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        // Copy button
        overlay.querySelector('#copy-single-tab-btn').addEventListener('click', () => {
            if (!this.isHomeTab(tab)) {
                const textToCopy = this.getTabLabel(tab);
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(textToCopy).catch(err => {
                        console.error('Failed to copy tab text:', err);
                        this.fallbackCopyText(textToCopy);
                    });
                } else {
                    this.fallbackCopyText(textToCopy);
                }
            }
            document.body.removeChild(overlay);
        });

        // Delete (Close) button
        overlay.querySelector('#close-single-tab-btn').addEventListener('click', () => {
            this.deleteTab(tab.id);
            document.body.removeChild(overlay);
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });

        document.body.appendChild(overlay);
    },

    deleteTab(tabId) {
        const tabIndex = this.state.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;

        // Can't delete the last tab - just reset it instead
        if (this.state.tabs.length === 1) {
            this.state.tabs[0] = {
                id: this.state.nextTabId++,
                testament: null,
                bookName: null,
                chapterNumber: null,
                scrollPosition: 0
            };
            this.state.activeTabId = this.state.tabs[0].id;
            this.goHome();
            this.renderTabs();
            return;
        }

        // Remove the tab
        this.state.tabs.splice(tabIndex, 1);

        // If deleted tab was active, switch to another
        if (this.state.activeTabId === tabId) {
            const newActiveIndex = Math.min(tabIndex, this.state.tabs.length - 1);
            const newActiveTab = this.state.tabs[newActiveIndex];
            this.state.activeTabId = newActiveTab.id;

            // Navigate to the new active tab's content
            if (newActiveTab.bookName && newActiveTab.chapterNumber) {
                this.state.testament = newActiveTab.testament;
                const books = DataManager.getTestamentBooks(newActiveTab.testament);
                const book = books.find(b => b.name === newActiveTab.bookName);
                if (book) {
                    this.state.book = book;
                    const chapter = book.chapters.find(c => c.number === newActiveTab.chapterNumber);
                    if (chapter) {
                        // Pass skipAutoScroll=true to prevent auto-scroll to verse
                        // Restore verse range highlight if this tab had one
                        const restoreRange = (newActiveTab.verseRangeEnd && newActiveTab.verseNumber && newActiveTab.verseRangeEnd !== newActiveTab.verseNumber)
                            ? { start: newActiveTab.verseNumber, end: newActiveTab.verseRangeEnd }
                            : null;
                        this.openVerseView(chapter, newActiveTab.verseNumber || 1, true, true, restoreRange);

                        // Restore scroll position with smooth animation after view is rendered
                        if (newActiveTab.scrollPosition !== undefined && this.els.verseContent) {
                            setTimeout(() => {
                                this.els.verseContent.scrollTo({
                                    top: newActiveTab.scrollPosition,
                                    behavior: 'smooth'
                                });
                            }, 50);
                        }
                    }
                }
            } else {
                this.goHome();
            }
        }

        this.renderTabs();
        this.saveStateToLocalStorage(); // Persist
    },

    updateTabsBarVisibility() {
        if (!this.els.tabsBar) return;

        if (this.state.tabs.length > 0) {
            this.els.tabsBar.classList.remove('hidden');
        } else {
            this.els.tabsBar.classList.add('hidden');
        }
    },

    // === SEARCH FUNCTIONALITY ===

    openSearch() {
        if (!this.els.searchModal) return;
        if (this.els.searchModal.classList.contains('active')) return;

        // Restore last query/results state instead of resetting every open.
        this.els.searchInput.value = this.state.search.query;
        this.els.searchClearBtn.style.display = this.state.search.query ? 'flex' : 'none';

        if (this.state.search.query.length >= 2) {
            const targetCount = Math.max(this.state.search.renderedCount, this.state.search.batchSize);
            this.renderSearchResults(targetCount);
        } else if (!this.state.search.query) {
            this.els.searchResults.innerHTML = '';
        }

        // Show modal with slide-up animation
        this.els.searchModal.classList.remove('hidden');
        requestAnimationFrame(() => {
            this.els.searchModal.classList.add('active');
        });

        setTimeout(() => {
            this.els.searchInput.focus();

            if (this.state.search.query.length >= 2) {
                this.els.searchResults.scrollTop = this.state.search.scrollTop || 0;
                this.maybeLoadMoreSearchResults(true);
            }
        }, 400);

        // Push state for back-button dismissal
        history.pushState({ view: 'search' }, '', '');

        // Bind events if not already bound
        if (!this.searchEventsBound) {
            // Dismiss button (slides down)
            const dismissBtn = document.getElementById('search-dismiss-btn');
            if (dismissBtn) {
                dismissBtn.addEventListener('click', () => {
                    history.back();
                });
            }

            // Clear button
            if (this.els.searchClearBtn) {
                this.els.searchClearBtn.addEventListener('click', () => {
                    this.els.searchInput.value = '';
                    this.clearSearchState(true);
                    this.els.searchResults.innerHTML = '';
                    this.els.searchClearBtn.style.display = 'none';
                    this.els.searchInput.focus();
                });
            }

            let debounceTimer;
            this.els.searchInput.addEventListener('input', () => {
                const value = this.els.searchInput.value;

                // Show/hide clear button
                this.els.searchClearBtn.style.display = value ? 'flex' : 'none';

                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.performSearch(value);
                }, 300);
            });

            if (this.els.searchResults) {
                this.els.searchResults.addEventListener('click', (e) => {
                    const item = e.target.closest('.search-result-item');
                    if (!item) return;

                    this.openSearchResult(
                        item.dataset.testament,
                        item.dataset.book,
                        parseInt(item.dataset.chapter, 10),
                        parseInt(item.dataset.verse, 10)
                    );
                });

                this.els.searchResults.addEventListener('scroll', () => {
                    this.state.search.scrollTop = this.els.searchResults.scrollTop;
                    this.maybeLoadMoreSearchResults();
                });
            }

            this.searchEventsBound = true;
        }

        // Always bind/rebind swipe to ensure it works
        this.bindSearchSwipe();
    },

    bindSearchSwipe() {
        if (!this.els.searchModal) return;

        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        const modal = this.els.searchModal;
        const threshold = 100; // Drag distance to trigger dismissal

        // Handle swipe on the top areas (dismiss area and search header)
        const swipeAreas = [
            document.querySelector('.search-dismiss-container'),
            document.querySelector('.search-header')
        ];

        const handleStart = (e) => {
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            isDragging = true;
            modal.style.transition = 'none'; // Disable transition while dragging
        };

        const handleMove = (e) => {
            if (!isDragging) return;
            currentY = e.touches ? e.touches[0].clientY : e.clientY;
            const deltaY = currentY - startY;

            if (deltaY > 0) {
                // Dragging down
                modal.style.transform = `translateY(${deltaY}px)`;
                // Prevent scrolling when dragging down to dismiss
                if (e.cancelable) e.preventDefault();
            }
        };

        const handleEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            modal.style.transition = ''; // Restore transition

            const deltaY = currentY - startY;
            if (deltaY > threshold) {
                // Trigger dismissal
                history.back();
            } else {
                // Snap back
                modal.style.transform = '';
            }
            startY = 0;
            currentY = 0;
        };

        swipeAreas.forEach(area => {
            if (!area) return;
            // Remove old listeners if any (though searchEventsBound handles most)
            area.removeEventListener('touchstart', area._swipeStart);
            area.removeEventListener('touchmove', area._swipeMove);
            area.removeEventListener('touchend', area._swipeEnd);

            area._swipeStart = handleStart;
            area._swipeMove = handleMove;
            area._swipeEnd = handleEnd;

            area.addEventListener('touchstart', handleStart, { passive: false });
            area.addEventListener('touchmove', handleMove, { passive: false });
            area.addEventListener('touchend', handleEnd);

            // Mouse counterparts for easier dev testing
            area.addEventListener('mousedown', handleStart);
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleEnd);
        });
    },

    closeSearch() {
        if (!this.els.searchModal) return;

        if (this.els.searchResults) {
            this.state.search.scrollTop = this.els.searchResults.scrollTop;
        }

        this.els.searchModal.style.transform = ''; // Reset transform in case it was dragged
        this.els.searchModal.classList.remove('active');
        this.els.searchInput.blur();

        // Hide after animation finishes
        setTimeout(() => {
            if (!this.els.searchModal.classList.contains('active')) {
                this.els.searchModal.classList.add('hidden');
            }
        }, 400);
    },

    clearSearchState(clearQuery = false) {
        if (clearQuery) {
            this.state.search.query = '';
        }

        this.state.search.matches = [];
        this.state.search.renderedCount = 0;
        this.state.search.scrollTop = 0;
    },

    performSearch(query) {
        const trimmedQuery = (query || '').trim();
        this.state.search.query = trimmedQuery;

        if (!trimmedQuery || trimmedQuery.length < 2) {
            this.clearSearchState(false);
            this.state.search.query = trimmedQuery;
            this.els.searchResults.innerHTML = '';
            return;
        }

        const results = [];
        const queryLower = trimmedQuery.toLowerCase();

        for (let bookIndex = 0; bookIndex < DataManager.books.length; bookIndex++) {
            const book = DataManager.books[bookIndex];
            const testament = bookIndex < 39 ? 'Old Testament' : 'New Testament';
            for (const chapter of book.chapters) {
                for (const verse of chapter.verses) {
                    if (verse.text.toLowerCase().includes(queryLower)) {
                        results.push({
                            book: book,
                            chapter: chapter,
                            verse: verse,
                            testament: testament
                        });
                    }
                }
            }
        }

        this.state.search.matches = results;
        this.state.search.renderedCount = 0;
        this.state.search.scrollTop = 0;

        this.renderSearchResults(this.state.search.batchSize);
        this.maybeLoadMoreSearchResults(true);
    },

    renderSearchResults(targetCount = this.state.search.batchSize) {
        const query = this.state.search.query;
        const results = this.state.search.matches;

        this.els.searchResults.innerHTML = '';
        this.state.search.renderedCount = 0;

        if (!query || query.length < 2) {
            return;
        }

        if (results.length === 0) {
            this.els.searchResults.innerHTML = `<div class="search-no-results">No results found for "${query}"</div>`;
            return;
        }

        const desiredCount = Math.max(this.state.search.batchSize, targetCount);
        while (
            this.state.search.renderedCount < results.length &&
            this.state.search.renderedCount < desiredCount
        ) {
            this.appendSearchResultsBatch();
        }
    },

    appendSearchResultsBatch() {
        const start = this.state.search.renderedCount;
        if (start >= this.state.search.matches.length) {
            this.updateSearchResultsStatus();
            return;
        }

        const end = Math.min(start + this.state.search.batchSize, this.state.search.matches.length);
        const query = this.state.search.query;
        const html = this.state.search.matches
            .slice(start, end)
            .map(result => this.createSearchResultHtml(result, query))
            .join('');

        this.els.searchResults.insertAdjacentHTML('beforeend', html);
        this.state.search.renderedCount = end;
        this.updateSearchResultsStatus();
    },

    createSearchResultHtml(result, query) {
        const ref = `${result.book.name} ${result.chapter.number}:${result.verse.number}`;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const highlightedText = result.verse.text.replace(regex, '<mark>$1</mark>');

        return `
            <div class="search-result-item" data-book="${result.book.name}" data-chapter="${result.chapter.number}" data-verse="${result.verse.number}" data-testament="${result.testament}">
                <div class="search-result-ref">${ref}</div>
                <div class="search-result-text">${highlightedText}</div>
            </div>
        `;
    },

    updateSearchResultsStatus() {
        if (!this.els.searchResults) return;

        const existingStatus = this.els.searchResults.querySelector('.search-results-status');
        if (!this.state.search.query || this.state.search.matches.length === 0) {
            if (existingStatus) existingStatus.remove();
            return;
        }

        const statusEl = existingStatus || document.createElement('div');
        statusEl.className = 'search-results-status';

        const shown = this.state.search.renderedCount;
        const total = this.state.search.matches.length;
        statusEl.textContent = shown < total
            ? `Showing ${shown} of ${total} results. Scroll to load more.`
            : `Showing all ${total} results.`;

        this.els.searchResults.appendChild(statusEl);
    },

    maybeLoadMoreSearchResults(force = false) {
        if (!this.els.searchResults) return;
        if (this.state.search.matches.length === 0) return;

        let guard = 0;
        while (this.state.search.renderedCount < this.state.search.matches.length && guard < 12) {
            const nearBottom = this.els.searchResults.scrollTop + this.els.searchResults.clientHeight >=
                this.els.searchResults.scrollHeight - 240;
            const needsFill = this.els.searchResults.scrollHeight <= this.els.searchResults.clientHeight + 30;

            if (!force && !nearBottom && !needsFill) {
                break;
            }

            this.appendSearchResultsBatch();
            force = false;
            guard++;
        }
    },

    openSearchResult(testament, bookName, chapterNumber, verseNumber) {
        if (history.state && history.state.view === 'search') {
            this.closeSearch();
            history.back();
            setTimeout(() => {
                this._navigateToResult(testament, bookName, chapterNumber, verseNumber);
            }, 50);
        } else {
            this.closeSearch();
            this._navigateToResult(testament, bookName, chapterNumber, verseNumber);
        }
    },

    _navigateToResult(testament, bookName, chapterNumber, verseNumber) {
        this.saveCurrentTabState();

        const activeTab = this.state.tabs.find(t => t.id === this.state.activeTabId);
        if (this.isHomeTab(activeTab)) {
            activeTab.testament = testament;
            activeTab.bookName = bookName;
            activeTab.chapterNumber = chapterNumber;
            activeTab.verseNumber = verseNumber;
            activeTab.scrollPosition = 0;
        } else {
            const newTab = {
                id: this.state.nextTabId++,
                testament: testament,
                bookName: bookName,
                chapterNumber: chapterNumber,
                verseNumber: verseNumber,
                scrollPosition: 0
            };

            this.state.tabs.push(newTab);
            this.state.activeTabId = newTab.id;
        }

        this.state.testament = testament;
        const books = DataManager.getTestamentBooks(testament);
        const book = books.find(b => b.name === bookName);

        if (book) {
            this.state.book = book;
            const chapter = book.chapters.find(c => c.number === chapterNumber);
            if (chapter) {
                this.openVerseView(chapter, verseNumber, true);
            }
        }

        // Deduplicate home tabs before rendering
        this.dedupeHomeTabs();
        this.renderTabs();
    }
};

globalThis.App = App;

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
