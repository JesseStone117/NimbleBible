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
            progressCleanup: null
        },
        verseSelection: {
            singleSelected: null,
            rangeStart: null,
            rangeEnd: null
        }
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
            verseToolbar: document.getElementById('verse-toolbar'),
            copyVerseBtn: document.getElementById('copy-verse-btn'),

            testamentTitle: document.getElementById('testament-title'),
            bookTitle: document.getElementById('book-title'),
            verseListTitle: document.getElementById('verse-list-title'),
            chapterTitle: document.getElementById('chapter-title'),

            btnOT: document.getElementById('btn-ot'),
            btnNT: document.getElementById('btn-nt')
        };
    },

    bindEvents() {
        // Back buttons
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', () => this.goBack());
        });

        // Home buttons (tap)
        this.els.btnOT.addEventListener('click', () => this.openBookList('Old Testament'));
        this.els.btnNT.addEventListener('click', () => this.openBookList('New Testament'));

        // Nimble triggers (long press)
        this.bindNimbleTrigger(this.els.btnOT, 'Old Testament');
        this.bindNimbleTrigger(this.els.btnNT, 'New Testament');

        // Global touch handlers for nimble mode
        document.addEventListener('touchmove', (e) => {
            if (this.state.nimble.active) this.handleNimbleMove(e);
        }, { passive: false });

        document.addEventListener('touchend', () => {
            if (this.state.nimble.active) this.endNimbleMode();
        });

        // Prevent text selection globally
        this.preventTextSelection();

        // Copy button handler
        if (this.els.copyVerseBtn) {
            this.els.copyVerseBtn.addEventListener('click', () => {
                this.copySelectedVerses();
            });
        }
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

    bindNimbleTrigger(element, testament) {
        let pressTimer, progressCleanup;

        const start = () => {
            progressCleanup = this.showProgress(element, 500);
            pressTimer = setTimeout(() => {
                this.startNimbleMode(testament);
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
        const pathData = `
            M ${borderRadius + halfStroke},${halfStroke}
            L ${width - borderRadius - halfStroke},${halfStroke}
            A ${borderRadius} ${borderRadius} 0 0 1 ${width - halfStroke},${borderRadius + halfStroke}
            L ${width - halfStroke},${height - borderRadius - halfStroke}
            A ${borderRadius} ${borderRadius} 0 0 1 ${width - borderRadius - halfStroke},${height - halfStroke}
            L ${borderRadius + halfStroke},${height - halfStroke}
            A ${borderRadius} ${borderRadius} 0 0 1 ${halfStroke},${height - borderRadius - halfStroke}
            L ${halfStroke},${borderRadius + halfStroke}
            A ${borderRadius} ${borderRadius} 0 0 1 ${borderRadius + halfStroke},${halfStroke}
        `.trim();

        const container = document.createElement('div');
        container.className = 'progress-container';
        container.innerHTML = `
            <svg class="progress-border" width="${width}" height="${height}">
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

        // Hide toolbar when leaving verse view
        if (viewId !== 'verseView') {
            this.hideToolbar();
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
            div.textContent = chapter.number;
            div.onclick = () => this.openVerseList(chapter);
            div.dataset.index = index;
            div.dataset.type = 'chapter';
            div.data = chapter;
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
            div.textContent = verse.number;
            div.onclick = () => this.openVerseView(chapter, verse.number);
            div.dataset.index = index;
            div.dataset.type = 'verse';
            div.data = verse;
            this.els.verseList.appendChild(div);
        });

        this.switchView('verseListView', skipHistory);
    },

    openVerseView(chapter, targetVerseNum = 1, skipHistory = false) {
        this.state.chapter = chapter;
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

            if (verse.number === targetVerseNum) {
                p.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
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
    },

    // NIMBLE NAVIGATION - Uses standard views directly
    startNimbleMode(testament) {
        if (this.state.nimble.active) return;

        this.state.nimble.active = true;
        this.openBookList(testament);

        if (navigator.vibrate) navigator.vibrate(50);
    },

    handleNimbleMove(e) {
        e.preventDefault();

        const touch = e.touches[0];

        // Auto-scroll logic
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
        let itemEl = target?.closest('.grid-item');
        if (!itemEl) {
            if (this.state.nimble.currentItem) this.cancelHover();
            return;
        }

        const activeView = document.querySelector('.view.active .grid-list');
        if (!activeView?.contains(itemEl)) return;

        if (this.state.nimble.currentItem !== itemEl) {
            this.highlightItem(itemEl);
            this.startHoverTimer(itemEl);
        }
    },

    highlightItem(itemEl) {
        this.cancelHover();

        const activeList = document.querySelector('.view.active .grid-list');
        if (activeList) {
            activeList.querySelectorAll('.grid-item').forEach(el => el.classList.remove('active'));
        }

        itemEl.classList.add('active');
        this.state.nimble.currentItem = itemEl;
    },

    startHoverTimer(itemEl) {
        this.state.nimble.progressCleanup = this.showProgress(itemEl, 1000);
        this.state.nimble.timer = setTimeout(() => {
            this.handleHoverComplete(itemEl);
        }, 1000);
    },

    cancelHover() {
        if (this.state.nimble.timer) {
            clearTimeout(this.state.nimble.timer);
            this.state.nimble.timer = null;
        }
        if (this.state.nimble.progressCleanup) {
            this.state.nimble.progressCleanup();
            this.state.nimble.progressCleanup = null;
        }
        this.state.nimble.currentItem = null;
    },

    handleHoverComplete(itemEl) {
        if (navigator.vibrate) navigator.vibrate(20);

        if (this.state.nimble.progressCleanup) {
            this.state.nimble.progressCleanup();
            this.state.nimble.progressCleanup = null;
        }

        const type = itemEl.dataset.type;
        const data = itemEl.data;

        if (type === 'book') {
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
                isLongPress = true;
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
            
            // Only handle selection if there was no movement (not scrolling)
            if (!hasMoved) {
                e.preventDefault();
                e.stopPropagation();
                
                if (isLongPress) {
                    this.handleVerseLongPress(verseEl, verse);
                } else {
                    this.handleVerseSingleTap(verseEl, verse);
                }
            }
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
        if (this.els.verseToolbar) {
            this.els.verseToolbar.classList.add('visible');
        }
    },

    hideToolbar() {
        if (this.els.verseToolbar) {
            this.els.verseToolbar.classList.remove('visible');
        }
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
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
