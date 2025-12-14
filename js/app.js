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
            progressDelayTimer: null
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
        toolbarExpanded: false
    },

    // Book abbreviations for tabs
    bookAbbreviations: {
        'Genesis': 'GEN', 'Exodus': 'EXO', 'Leviticus': 'LEV', 'Numbers': 'NUM',
        'Deuteronomy': 'DEU', 'Joshua': 'JOS', 'Judges': 'JDG', 'Ruth': 'RUT',
        '1 Samuel': '1SA', '2 Samuel': '2SA', '1 Kings': '1KI', '2 Kings': '2KI',
        '1 Chronicles': '1CH', '2 Chronicles': '2CH', 'Ezra': 'EZR', 'Nehemiah': 'NEH',
        'Esther': 'EST', 'Job': 'JOB', 'Psalms': 'PSA', 'Proverbs': 'PRO',
        'Ecclesiastes': 'ECC', 'Song of Solomon': 'SOS', 'Isaiah': 'ISA', 'Jeremiah': 'JER',
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

    async init() {
        const loaded = await DataManager.init();
        if (!loaded) {
            alert('Failed to load Bible data.');
            return;
        }

        this.cacheElements();
        this.bindEvents();
        this.setupHistory();
        this.renderHome();
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
            newTabBtn: document.getElementById('new-tab-btn')
        };
    },

    bindEvents() {
        // Back buttons
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', () => this.goBack());
        });

        // Home buttons
        document.querySelectorAll('.home-btn').forEach(btn => {
            btn.addEventListener('click', () => this.goHome());
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

            // Long press for nimble navigation
            this.bindNimbleTrigger(this.els.newTabBtn, { fromNewTab: true });
        }

        // Audio controls
        this.bindAudioControls();
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

    bindNimbleTrigger(element, context) {
        let pressTimer, progressCleanup;

        const start = () => {
            progressCleanup = this.showProgress(element, 500);
            pressTimer = setTimeout(() => {
                this.startNimbleMode(context);
            }, 500);
        };

        const cancel = () => {
            clearTimeout(pressTimer);
            if (progressCleanup) progressCleanup();
        };

        element.addEventListener('touchstart', start, { passive: true });
        element.addEventListener('touchend', cancel);
        element.addEventListener('mousedown', start);
        element.addEventListener('mouseup', cancel);
        element.addEventListener('mouseleave', cancel);
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
        document.querySelectorAll('.view').forEach(v => {
            v.classList.add('hidden');
            v.classList.remove('active');
        });
        this.els[viewId].classList.remove('hidden');
        this.els[viewId].classList.add('active');
        this.state.currentView = viewId;

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
            return;
        }

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
            div.onclick = () => this.openChapterList(book);
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
            div.onclick = () => this.openVerseList(chapter);
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
            div.onclick = () => this.openVerseView(chapter, verse.number);
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

    openVerseView(chapter, targetVerseNum = 1, skipHistory = false) {
        this.state.chapter = chapter;
        this.state.targetVerseNum = targetVerseNum; // Track for tab labels
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

            if (verse.number === targetVerseNum && targetVerseNum !== 1) {
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

        this.switchView('verseView', skipHistory);

        setTimeout(() => {
            const el = document.getElementById(`verse-${targetVerseNum}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);

        // Initialize audio for this chapter
        this.initAudioForChapter();

        // Update tab state
        this.updateCurrentTabFromNavigation();
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

        // Auto-scroll logic for grid lists
        const activeList = document.querySelector('.view.active .grid-list');
        if (activeList) {
            const listRect = activeList.getBoundingClientRect();
            const scrollThreshold = 80;
            const scrollSpeed = 8;

            if (touch.clientY > listRect.bottom - scrollThreshold) {
                activeList.scrollTop += scrollSpeed;
            } else if (touch.clientY < listRect.top + scrollThreshold) {
                activeList.scrollTop -= scrollSpeed;
            }
        }

        const target = document.elementFromPoint(touch.clientX, touch.clientY);

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
            this.endNimbleMode();
            this.openVerseView(this.state.chapter, data.number);
        }

        this.state.nimble.currentItem = null;
    },

    endNimbleMode() {
        this.state.nimble.active = false;
        this.cancelHover();
        document.querySelectorAll('.grid-item.active').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.big-btn.active').forEach(el => el.classList.remove('active'));
    },

    bindVerseSelection(verseEl, verse) {
        let pressTimer;
        let isLongPress = false;
        let startX = 0;
        let startY = 0;
        let hasMoved = false;

        const handleStart = (e) => {
            // Don't prevent default - allow scrolling
            hasMoved = false;
            isLongPress = false;

            // Get starting position
            if (e.touches && e.touches.length > 0) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            } else if (e.clientX !== undefined) {
                startX = e.clientX;
                startY = e.clientY;
            }

            pressTimer = setTimeout(() => {
                // Long press detected - execute immediately
                if (!hasMoved) {
                    isLongPress = true;
                    this.handleVerseLongPress(verseEl, verse);
                }
            }, 500); // 500ms for long press
        };

        const handleMove = (e) => {
            // Check if user has moved significantly (scrolling)
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

            // If moved more than 10px, consider it scrolling
            if (deltaX > 10 || deltaY > 10) {
                hasMoved = true;
                clearTimeout(pressTimer);
            }
        };

        const handleEnd = (e) => {
            clearTimeout(pressTimer);

            // Only handle single tap if there was no movement and no long press occurred
            if (!hasMoved && !isLongPress) {
                e.preventDefault();
                e.stopPropagation();
                this.handleVerseSingleTap(verseEl, verse);
            }

            // Reset flags for next interaction
            isLongPress = false;
            hasMoved = false;
        };

        const handleCancel = () => {
            clearTimeout(pressTimer);
            hasMoved = false;
        };

        // Touch events
        verseEl.addEventListener('touchstart', handleStart, { passive: true });
        verseEl.addEventListener('touchmove', handleMove, { passive: true });
        verseEl.addEventListener('touchend', handleEnd, { passive: false });
        verseEl.addEventListener('touchcancel', handleCancel, { passive: true });

        // Mouse events (for desktop/testing)
        verseEl.addEventListener('mousedown', handleStart);
        verseEl.addEventListener('mousemove', handleMove);
        verseEl.addEventListener('mouseup', handleEnd);
        verseEl.addEventListener('mouseleave', handleCancel);

        // Prevent context menu
        verseEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Prevent text selection via CSS and JS
        verseEl.addEventListener('selectstart', (e) => {
            e.preventDefault();
        });
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

    handleVerseLongPress(verseEl, verse) {
        const verseNum = parseInt(verseEl.dataset.verseNumber);
        const singleSelected = this.state.verseSelection.singleSelected;

        // If no single selection exists, just select this verse as single
        if (singleSelected === null) {
            this.handleVerseSingleTap(verseEl, verse);
            return;
        }

        // Clear single selection and create range
        const prevEl = document.getElementById(`verse-${singleSelected}`);
        if (prevEl) prevEl.classList.remove('selected');

        this.state.verseSelection.singleSelected = null;
        this.state.verseSelection.rangeStart = Math.min(singleSelected, verseNum);
        this.state.verseSelection.rangeEnd = Math.max(singleSelected, verseNum);

        // Highlight all verses in range
        this.updateVerseRangeSelection();
        this.showToolbar();
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
                });
            } else {
                // Fallback for older browsers
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
            }
        }
    },

    // === TAB MANAGEMENT ===

    getBookAbbreviation(bookName) {
        return this.bookAbbreviations[bookName] || bookName.substring(0, 3).toUpperCase();
    },

    getTabLabel(tab) {
        if (!tab.bookName || !tab.chapterNumber) {
            return 'Home';
        }
        let label = `${this.getBookAbbreviation(tab.bookName)}${tab.chapterNumber}`;
        if (tab.verseNumber) {
            label += `:${tab.verseNumber}`;
        }
        return label;
    },

    createNewTab() {
        // Save current tab state before creating new one
        this.saveCurrentTabState();

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

        // Save scroll position if in verse view
        if (this.state.currentView === 'verseView' && this.els.verseContent) {
            currentTab.scrollPosition = this.els.verseContent.scrollTop;
        }
    },

    switchTab(tabId) {
        if (tabId === this.state.activeTabId) return;

        // Save current tab state
        this.saveCurrentTabState();

        // Switch to new tab
        const tab = this.state.tabs.find(t => t.id === tabId);
        if (!tab) return;

        this.state.activeTabId = tabId;

        // Restore tab state
        if (tab.bookName && tab.chapterNumber) {
            // Need to restore the full navigation state
            this.state.testament = tab.testament;

            // Find book and chapter from the data
            const books = DataManager.getTestamentBooks(tab.testament);
            const book = books.find(b => b.name === tab.bookName);
            if (book) {
                this.state.book = book;
                const chapter = book.chapters.find(c => c.number === tab.chapterNumber);
                if (chapter) {
                    this.openVerseView(chapter, 1, true);

                    // Restore scroll position
                    if (tab.scrollPosition && this.els.verseContent) {
                        setTimeout(() => {
                            this.els.verseContent.scrollTop = tab.scrollPosition;
                        }, 100);
                    }
                }
            }
        } else {
            // Tab is on home
            this.goHome();
        }

        this.renderTabs();
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
                    this.showDeleteTabConfirmation(tab);
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

    showDeleteTabConfirmation(tab) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'delete-tab-overlay';
        overlay.innerHTML = `
            <div class="delete-tab-popup">
                <p>Delete tab "${this.getTabLabel(tab)}"?</p>
                <div class="delete-tab-buttons">
                    <button class="delete-tab-cancel">Cancel</button>
                    <button class="delete-tab-confirm">Delete</button>
                </div>
            </div>
        `;

        // Cancel button
        overlay.querySelector('.delete-tab-cancel').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        // Delete button
        overlay.querySelector('.delete-tab-confirm').addEventListener('click', () => {
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
                        this.openVerseView(chapter, 1, true);
                    }
                }
            } else {
                this.goHome();
            }
        }

        this.renderTabs();
    },

    updateTabsBarVisibility() {
        if (!this.els.tabsBar) return;

        if (this.state.tabs.length > 0) {
            this.els.tabsBar.classList.remove('hidden');
        } else {
            this.els.tabsBar.classList.add('hidden');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
