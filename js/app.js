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
            verseDragEnd: null,
            lastPoint: null,
            scrollCallback: null,
            rangeStartRef: null,
            rangeEndRef: null,
            boundaryNavigationTimer: null,
            boundaryNavigationDirection: 0,
            boundaryNavigationHint: null
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
        toolbarPinnedByUser: false,
        verseRangeDrag: {
            scrollDirection: 0,
            animationId: null,
            anchorVerse: null,
            lastPoint: null
        },
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
                this.toggleToolbar(true);
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
                    this.setToolbarExpanded(false, true);
                } else if (deltaY < 0 && this.els.audioToolbar.classList.contains('minimized')) {
                    // Swipe up - expand
                    this.setToolbarExpanded(true, true);
                }
            }
            isTouchingToolbar = false;
        }, { passive: true });
    },

toggleToolbar(userInitiated = false) {
        this.setToolbarExpanded(!this.state.toolbarExpanded, userInitiated);
    },

setToolbarExpanded(expanded, userInitiated = false) {
        this.state.toolbarExpanded = expanded;
        if (userInitiated) {
            this.state.toolbarPinnedByUser = expanded;
        }
        if (this.els.audioToolbar) {
            if (this.state.toolbarExpanded) {
                this.els.audioToolbar.classList.remove('minimized');
            } else {
                this.els.audioToolbar.classList.add('minimized');
            }
        }
    },

hasVerseSelection() {
        return this.state.verseSelection.singleSelected !== null ||
            (this.state.verseSelection.rangeStart !== null && this.state.verseSelection.rangeEnd !== null);
    },

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
    }
};

Object.assign(
    App,
    globalThis.AppNavigation,
    globalThis.AppNimble,
    globalThis.AppVerseSelection,
    globalThis.AppTabs,
    globalThis.AppSearch
);

globalThis.App = App;

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
