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
        history.replaceState({ view: 'home' }, '', '');

        // Browser back button handler
        window.addEventListener('popstate', () => {
            this.goBack();
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
        const isGridItem = target.classList.contains('grid-item');
        const size = isGridItem ? 40 : 60;
        const stroke = 4;
        const radius = (size - stroke) / 2;
        const circumference = radius * 2 * Math.PI;

        const container = document.createElement('div');
        container.className = 'progress-container';
        container.innerHTML = `
            <svg class="progress-ring" width="${size}" height="${size}">
                <circle class="progress-ring__circle" stroke="white" stroke-width="${stroke}"
                    fill="transparent" r="${radius}" cx="${size / 2}" cy="${size / 2}"
                    style="stroke-dasharray: ${circumference} ${circumference}; stroke-dashoffset: ${circumference};" />
            </svg>`;

        target.appendChild(container);
        container.getBoundingClientRect();

        const circle = container.querySelector('circle');
        circle.style.transition = `stroke-dashoffset ${duration}ms linear`;
        circle.style.strokeDashoffset = '0';

        return () => {
            if (container.parentNode) container.parentNode.removeChild(container);
        };
    },

    switchView(viewId) {
        document.querySelectorAll('.view').forEach(v => {
            v.classList.add('hidden');
            v.classList.remove('active');
        });
        this.els[viewId].classList.remove('hidden');
        this.els[viewId].classList.add('active');
        this.state.currentView = viewId;

        // Push state for browser back button (except home)
        if (viewId !== 'homeView') {
            history.pushState({ view: viewId }, '', '');
        }
    },

    goBack() {
        if (this.state.currentView === 'verse-view') {
            if (this.state.chapter) this.openVerseList(this.state.chapter);
            else this.switchView('homeView');
        } else if (this.state.currentView === 'verse-list-view') {
            if (this.state.book) this.openChapterList(this.state.book);
            else this.switchView('homeView');
        } else if (this.state.currentView === 'chapter-view') {
            if (this.state.testament) this.openBookList(this.state.testament);
            else this.switchView('homeView');
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

        this.switchView('bookView');
    },

    openChapterList(book) {
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

        this.switchView('chapterView');
    },

    openVerseList(chapter) {
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

        this.switchView('verseListView');
    },

    openVerseView(chapter, targetVerseNum = 1) {
        this.state.chapter = chapter;
        this.els.chapterTitle.textContent = `${this.state.book.name} ${chapter.number}`;

        this.els.verseContent.innerHTML = '';
        chapter.verses.forEach(verse => {
            const p = document.createElement('div');
            p.className = 'verse';
            p.id = `verse-${verse.number}`;
            p.innerHTML = `<span class="verse-num">${verse.number}</span>${verse.text}`;

            if (verse.number === targetVerseNum) {
                p.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
            }

            this.els.verseContent.appendChild(p);
        });

        this.switchView('verseView');

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
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
