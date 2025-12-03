const App = {
    state: {
        currentView: 'home',
        testament: null,
        book: null,
        chapter: null,
        nimble: {
            active: false,
            timer: null,
            level: null, // 'book', 'chapter', 'verse'
            currentItem: null,
            listItems: [],
            progressCleanup: null
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
        this.renderHome();
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

            testamentTitle: document.getElementById('testament-title'),
            bookTitle: document.getElementById('book-title'),
            verseListTitle: document.getElementById('verse-list-title'),
            chapterTitle: document.getElementById('chapter-title'),

            nimbleOverlay: document.getElementById('nimble-overlay'),
            nimbleList: document.getElementById('nimble-list'),
            // nimblePreview removed

            btnOT: document.getElementById('btn-ot'),
            btnNT: document.getElementById('btn-nt')
        };
    },

    bindEvents() {
        // Global Back Buttons
        // Use event delegation or re-bind? Delegation is safer if elements change, but they are static here.
        // Let's verify we are catching them.
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent bubbling issues
                this.goBack();
            });
        });

        // Home Buttons (Tap)
        this.els.btnOT.addEventListener('click', () => this.openBookList('Old Testament'));
        this.els.btnNT.addEventListener('click', () => this.openBookList('New Testament'));

        // Nimble Navigation Triggers (Long Press)
        this.bindNimbleTrigger(this.els.btnOT, 'Old Testament');
        this.bindNimbleTrigger(this.els.btnNT, 'New Testament');

        // Nimble Overlay Events
        this.els.nimbleOverlay.addEventListener('touchmove', (e) => this.handleNimbleMove(e));
        this.els.nimbleOverlay.addEventListener('touchend', (e) => this.handleNimbleEnd(e));
    },

    bindNimbleTrigger(element, testament) {
        let pressTimer;
        let progressCleanup;

        const start = (e) => {
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

        element.addEventListener('touchmove', (e) => {
            if (this.state.nimble.active) {
                this.handleNimbleMove(e);
            }
        }, { passive: false });

        element.addEventListener('mousedown', (e) => {
            progressCleanup = this.showProgress(element, 500);
            pressTimer = setTimeout(() => {
                this.startNimbleMode(testament);
            }, 500);
        });
        element.addEventListener('mouseup', cancel);
        element.addEventListener('mouseleave', cancel);
    },

    showProgress(target, duration) {
        const isNimbleItem = target.classList.contains('nimble-item');
        const size = isNimbleItem ? 40 : 60; // Match CSS
        const stroke = 4;
        const radius = (size - stroke) / 2;
        const circumference = radius * 2 * Math.PI;

        const container = document.createElement('div');
        container.className = 'progress-container';
        container.innerHTML = `
            <svg class="progress-ring" width="${size}" height="${size}">
                <circle
                    class="progress-ring__circle"
                    stroke="white"
                    stroke-width="${stroke}"
                    fill="transparent"
                    r="${radius}"
                    cx="${size / 2}"
                    cy="${size / 2}"
                    style="stroke-dasharray: ${circumference} ${circumference}; stroke-dashoffset: ${circumference};"
                />
            </svg>
        `;

        target.appendChild(container);
        container.getBoundingClientRect(); // Force reflow

        const circle = container.querySelector('circle');
        circle.style.transition = `stroke-dashoffset ${duration}ms linear`;
        circle.style.strokeDashoffset = '0';

        return () => {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        };
    },

    // --- Navigation & Rendering ---

    switchView(viewId) {
        document.querySelectorAll('.view').forEach(v => {
            v.classList.add('hidden');
            v.classList.remove('active');
        });
        this.els[viewId].classList.remove('hidden');
        this.els[viewId].classList.add('active');
        this.state.currentView = viewId;

        // Scroll to top of new view
        const list = this.els[viewId].querySelector('.grid-list, .scroll-content');
        if (list) list.scrollTop = 0;
    },

    goBack() {
        console.log('Going back from', this.state.currentView);
        // Hierarchy: verseView -> verseListView -> chapterView -> bookView -> homeView
        if (this.state.currentView === 'verse-view') {
            // Go back to Verse List (re-render it)
            if (this.state.chapter) {
                this.openVerseList(this.state.chapter);
            } else {
                this.switchView('homeView'); // Fallback
            }
        } else if (this.state.currentView === 'verse-list-view') {
            if (this.state.book) {
                this.openChapterList(this.state.book);
            } else {
                this.switchView('homeView');
            }
        } else if (this.state.currentView === 'chapter-view') {
            if (this.state.testament) {
                this.openBookList(this.state.testament);
            } else {
                this.switchView('homeView');
            }
        } else if (this.state.currentView === 'book-view') {
            this.switchView('homeView');
        }
    },

    renderHome() {
        this.switchView('homeView');
    },

    openBookList(testament) {
        this.state.testament = testament;
        this.els.testamentTitle.textContent = testament;

        const books = DataManager.getTestamentBooks(testament);
        this.els.bookList.innerHTML = '';

        books.forEach(book => {
            const div = document.createElement('div');
            div.className = 'grid-item';
            div.textContent = book.name;
            div.onclick = () => this.openChapterList(book);
            this.els.bookList.appendChild(div);
        });

        this.switchView('bookView');
    },

    openChapterList(book) {
        this.state.book = book;
        this.els.bookTitle.textContent = book.name;

        this.els.chapterList.innerHTML = '';
        book.chapters.forEach(chapter => {
            const div = document.createElement('div');
            div.className = 'grid-item';
            div.textContent = chapter.number;
            div.onclick = () => this.openVerseList(chapter);
            this.els.chapterList.appendChild(div);
        });

        this.switchView('chapterView');
    },

    openVerseList(chapter) {
        this.state.chapter = chapter;
        this.els.verseListTitle.textContent = `${this.state.book.name} ${chapter.number}`;

        this.els.verseList.innerHTML = '';
        chapter.verses.forEach(verse => {
            const div = document.createElement('div');
            div.className = 'grid-item';
            div.textContent = verse.number;
            div.onclick = () => this.openVerseView(chapter, verse.number);
            this.els.verseList.appendChild(div);
        });

        this.switchView('verseListView');
    },

    openVerseView(chapter, targetVerseNum = 1) {
        this.state.chapter = chapter;
        this.els.chapterTitle.textContent = `${this.state.book.name} ${chapter.number}`;

        this.els.verseContent.innerHTML = '';
        chapter.verses.forEach(verse => {
            const p = document.createElement('div');
            p.className = 'verse';
            p.id = `verse-${verse.number}`; // Add ID for scrolling
            p.innerHTML = `<span class="verse-num">${verse.number}</span>${verse.text}`;

            // Highlight target verse?
            if (verse.number === targetVerseNum) {
                p.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
            }

            this.els.verseContent.appendChild(p);
        });

        this.switchView('verseView');

        // Scroll to verse
        setTimeout(() => {
            const el = document.getElementById(`verse-${targetVerseNum}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    },

    // --- Nimble Navigation Logic ---

    startNimbleMode(testament) {
        if (this.state.nimble.active) return;

        this.state.nimble.active = true;
        this.state.nimble.level = 'book';
        this.state.testament = testament;

        const books = DataManager.getTestamentBooks(testament);
        this.renderNimbleList(books.map(b => ({ label: b.name, data: b })));

        this.els.nimbleOverlay.classList.remove('hidden');
        if (navigator.vibrate) navigator.vibrate(50);
    },

    renderNimbleList(items) {
        this.els.nimbleList.innerHTML = '';
        this.state.nimble.listItems = [];

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'nimble-item';
            div.textContent = item.label;
            div.dataset.value = item.label;
            this.els.nimbleList.appendChild(div);

            this.state.nimble.listItems.push({
                el: div,
                data: item.data
            });
        });
    },

    handleNimbleMove(e) {
        if (!this.state.nimble.active) return;
        e.preventDefault();

        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);

        let itemEl = target;
        if (target && !target.classList.contains('nimble-item')) {
            itemEl = target.closest('.nimble-item');
        }

        if (!itemEl) {
            if (this.state.nimble.currentItem) {
                this.cancelHover();
            }
            return;
        }

        const item = this.state.nimble.listItems.find(i => i.el === itemEl);
        if (!item) return;

        if (this.state.nimble.currentItem !== item) {
            this.highlightNimbleItem(item);
            this.startHoverTimer(item);
        }
    },

    highlightNimbleItem(item) {
        this.cancelHover();
        this.state.nimble.listItems.forEach(i => i.el.classList.remove('active'));
        item.el.classList.add('active');
        this.state.nimble.currentItem = item;

        // No preview text update needed as requested
    },

    startHoverTimer(item) {
        this.state.nimble.progressCleanup = this.showProgress(item.el, 1000);
        this.state.nimble.timer = setTimeout(() => {
            this.handleHoverComplete(item);
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

    handleHoverComplete(item) {
        if (navigator.vibrate) navigator.vibrate(20);
        if (this.state.nimble.progressCleanup) {
            this.state.nimble.progressCleanup();
            this.state.nimble.progressCleanup = null;
        }

        if (this.state.nimble.level === 'book') {
            this.state.book = item.data;
            this.state.nimble.level = 'chapter';
            const chapters = item.data.chapters;
            this.renderNimbleList(chapters.map(c => ({ label: c.number, data: c })));
            this.state.nimble.currentItem = null;

        } else if (this.state.nimble.level === 'chapter') {
            this.state.chapter = item.data;
            this.state.nimble.level = 'verse';
            const verses = item.data.verses;
            this.renderNimbleList(verses.map(v => ({ label: v.number, data: v })));
            this.state.nimble.currentItem = null;

        } else if (this.state.nimble.level === 'verse') {
            // Selected a Verse -> Go to Verse View (scrolled)
            const verse = item.data;
            this.endNimbleMode();
            this.openVerseView(this.state.chapter, verse.number);
        }
    },

    handleNimbleEnd(e) {
        if (!this.state.nimble.active) return;
        this.endNimbleMode();
    },

    endNimbleMode() {
        this.state.nimble.active = false;
        this.els.nimbleOverlay.classList.add('hidden');
        this.cancelHover();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
