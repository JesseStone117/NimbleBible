const App = {
    state: {
        currentView: 'home',
        testament: null,
        book: null,
        chapter: null,
        nimble: {
            active: false,
            timer: null,
            level: null, // 'book', 'chapter'
            currentItem: null,
            listItems: []
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
            verseView: document.getElementById('verse-view'),
            bookList: document.getElementById('book-list'),
            chapterList: document.getElementById('chapter-list'),
            verseContent: document.getElementById('verse-content'),
            testamentTitle: document.getElementById('testament-title'),
            bookTitle: document.getElementById('book-title'),
            chapterTitle: document.getElementById('chapter-title'),
            nimbleOverlay: document.getElementById('nimble-overlay'),
            nimbleList: document.getElementById('nimble-list'),
            nimblePreview: document.getElementById('nimble-preview'),
            btnOT: document.getElementById('btn-ot'),
            btnNT: document.getElementById('btn-nt')
        };
    },

    bindEvents() {
        // Global Back Buttons
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', () => this.goBack());
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

        const start = (e) => {
            // e.preventDefault(); // Don't prevent default immediately, allow click
            pressTimer = setTimeout(() => {
                this.startNimbleMode(testament);
            }, 500); // 500ms long press
        };

        const cancel = () => {
            clearTimeout(pressTimer);
        };

        element.addEventListener('touchstart', start, { passive: true });
        element.addEventListener('touchend', cancel);
        element.addEventListener('touchmove', cancel);
        element.addEventListener('mousedown', (e) => {
            // Mouse support for testing
            pressTimer = setTimeout(() => {
                this.startNimbleMode(testament);
            }, 500);
        });
        element.addEventListener('mouseup', cancel);
        element.addEventListener('mouseleave', cancel);
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
    },

    goBack() {
        if (this.state.currentView === 'verse-view') {
            this.switchView('chapterView');
        } else if (this.state.currentView === 'chapter-view') {
            this.switchView('bookView');
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
            div.onclick = () => this.openVerseView(chapter);
            this.els.chapterList.appendChild(div);
        });

        this.switchView('chapterView');
    },

    openVerseView(chapter) {
        this.state.chapter = chapter;
        this.els.chapterTitle.textContent = `${this.state.book.name} ${chapter.number}`;

        this.els.verseContent.innerHTML = '';
        chapter.verses.forEach(verse => {
            const p = document.createElement('div');
            p.className = 'verse';
            p.innerHTML = `<span class="verse-num">${verse.number}</span>${verse.text}`;
            this.els.verseContent.appendChild(p);
        });

        this.switchView('verseView');
    },

    // --- Nimble Navigation Logic ---

    startNimbleMode(testament) {
        this.state.nimble.active = true;
        this.state.nimble.level = 'book';
        this.state.testament = testament;

        // Populate Overlay with Books
        const books = DataManager.getTestamentBooks(testament);
        this.renderNimbleList(books.map(b => ({ label: b.name, data: b })));

        this.els.nimbleOverlay.classList.remove('hidden');

        // Haptic feedback if available
        if (navigator.vibrate) navigator.vibrate(50);
    },

    renderNimbleList(items) {
        this.els.nimbleList.innerHTML = '';
        this.state.nimble.listItems = [];

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'nimble-item';
            div.textContent = item.label;
            div.dataset.value = item.label; // For identification
            this.els.nimbleList.appendChild(div);

            // Store ref for easy access
            this.state.nimble.listItems.push({
                el: div,
                data: item.data
            });
        });
    },

    handleNimbleMove(e) {
        if (!this.state.nimble.active) return;
        e.preventDefault(); // Prevent scrolling

        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);

        if (!target || !target.classList.contains('nimble-item')) return;

        // Find the data item
        const item = this.state.nimble.listItems.find(i => i.el === target);
        if (!item) return;

        if (this.state.nimble.currentItem !== item) {
            // New item hovered
            this.highlightNimbleItem(item);
            this.startHoverTimer(item);
        }
    },

    highlightNimbleItem(item) {
        // Remove old active
        this.state.nimble.listItems.forEach(i => i.el.classList.remove('active'));

        // Set new active
        item.el.classList.add('active');
        this.state.nimble.currentItem = item;

        // Update preview
        this.els.nimblePreview.textContent = item.data.name || item.data.number || item.data;

        // Scroll into view if needed (optional, might be jarring during drag)
        item.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    startHoverTimer(item) {
        if (this.state.nimble.timer) clearTimeout(this.state.nimble.timer);

        this.state.nimble.timer = setTimeout(() => {
            this.handleHoverComplete(item);
        }, 1000); // 1 second hover
    },

    handleHoverComplete(item) {
        if (navigator.vibrate) navigator.vibrate(20);

        if (this.state.nimble.level === 'book') {
            // Selected a Book -> Show Chapters
            this.state.book = item.data;
            this.state.nimble.level = 'chapter';

            const chapters = item.data.chapters;
            this.renderNimbleList(chapters.map(c => ({ label: `Ch ${c.number}`, data: c })));

            this.els.nimblePreview.textContent = `${this.state.book.name}`;

        } else if (this.state.nimble.level === 'chapter') {
            // Selected a Chapter -> Go to Verse View
            this.state.chapter = item.data;

            this.endNimbleMode();
            this.openVerseView(this.state.chapter);
        }
    },

    handleNimbleEnd(e) {
        if (!this.state.nimble.active) return;

        // If we lift finger without completing the hover, what happens?
        // Maybe we just select whatever is highlighted?
        // Or we cancel?
        // User said: "without lifting my finger... hover... show me verses".
        // If they lift, maybe we should just select the current item if it's a valid selection?
        // Let's assume lift = select current.

        if (this.state.nimble.currentItem) {
            this.handleHoverComplete(this.state.nimble.currentItem);
        } else {
            this.endNimbleMode();
        }
    },

    endNimbleMode() {
        this.state.nimble.active = false;
        this.els.nimbleOverlay.classList.add('hidden');
        if (this.state.nimble.timer) clearTimeout(this.state.nimble.timer);
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
