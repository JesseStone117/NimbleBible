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
        let progressCleanup;

        const start = (e) => {
            // Start progress circle
            progressCleanup = this.showProgress(element, 500);

            pressTimer = setTimeout(() => {
                this.startNimbleMode(testament);
                // Important: Don't cancel progress here, let it finish or be removed by the mode switch?
                // Actually, startNimbleMode will show the overlay.
                // The user is still holding.
            }, 500); // 500ms long press
        };

        const cancel = () => {
            clearTimeout(pressTimer);
            if (progressCleanup) progressCleanup();
        };

        // Touch Events
        element.addEventListener('touchstart', start, { passive: true });
        element.addEventListener('touchend', cancel);

        // Continuous Gesture: Handle move on the BUTTON itself
        // Because if we start here, events keep bubbling to here even if we move off
        element.addEventListener('touchmove', (e) => {
            if (this.state.nimble.active) {
                // Delegate to nimble handler
                this.handleNimbleMove(e);
            } else {
                // If we move too much before activation, cancel?
                // For now, let's be lenient.
                // cancel(); // Optional: cancel on drag
            }
        }, { passive: false });

        // Mouse support for testing
        element.addEventListener('mousedown', (e) => {
            progressCleanup = this.showProgress(element, 500);
            pressTimer = setTimeout(() => {
                this.startNimbleMode(testament);
            }, 500);
        });
        element.addEventListener('mouseup', cancel);
        element.addEventListener('mouseleave', cancel);
    },

    // --- Visual Feedback (Progress Circle) ---

    showProgress(target, duration) {
        // Create SVG
        const size = target.classList.contains('nimble-item') ? 30 : 60;
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

        // Position relative to target if it's a nimble item, or center if button
        // CSS handles centering for .progress-container

        target.appendChild(container);

        // Force reflow
        container.getBoundingClientRect();

        // Animate
        const circle = container.querySelector('circle');
        circle.style.transition = `stroke-dashoffset ${duration}ms linear`;
        circle.style.strokeDashoffset = '0';

        // Cleanup function
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
        if (this.state.nimble.active) return;

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

        // If we are over a nimble item
        let itemEl = target;
        if (target && !target.classList.contains('nimble-item')) {
            itemEl = target.closest('.nimble-item');
        }

        if (!itemEl) {
            // If we moved off an item, maybe cancel the current hover?
            if (this.state.nimble.currentItem) {
                this.cancelHover();
            }
            return;
        }

        // Find the data item
        const item = this.state.nimble.listItems.find(i => i.el === itemEl);
        if (!item) return;

        if (this.state.nimble.currentItem !== item) {
            // New item hovered
            this.highlightNimbleItem(item);
            this.startHoverTimer(item);
        }
    },

    highlightNimbleItem(item) {
        // Cancel previous
        this.cancelHover();

        // Remove old active
        this.state.nimble.listItems.forEach(i => i.el.classList.remove('active'));

        // Set new active
        item.el.classList.add('active');
        this.state.nimble.currentItem = item;

        // Update preview
        this.els.nimblePreview.textContent = item.data.name || item.data.number || item.data;

        // Scroll into view if needed
        item.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    startHoverTimer(item) {
        // Start progress
        this.state.nimble.progressCleanup = this.showProgress(item.el, 1000);

        this.state.nimble.timer = setTimeout(() => {
            this.handleHoverComplete(item);
        }, 1000); // 1 second hover
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

        // Cleanup progress
        if (this.state.nimble.progressCleanup) {
            this.state.nimble.progressCleanup();
            this.state.nimble.progressCleanup = null;
        }

        if (this.state.nimble.level === 'book') {
            // Selected a Book -> Show Chapters
            this.state.book = item.data;
            this.state.nimble.level = 'chapter';

            const chapters = item.data.chapters;
            this.renderNimbleList(chapters.map(c => ({ label: `Ch ${c.number}`, data: c })));

            this.els.nimblePreview.textContent = `${this.state.book.name}`;

            // Reset current item so we can select again
            this.state.nimble.currentItem = null;

        } else if (this.state.nimble.level === 'chapter') {
            // Selected a Chapter -> Go to Verse View
            this.state.chapter = item.data;

            this.endNimbleMode();
            this.openVerseView(this.state.chapter);
        }
    },

    handleNimbleEnd(e) {
        if (!this.state.nimble.active) return;

        // If we lift finger, we just close the mode?
        // Or do we select if we were hovering?
        // User said "without lifting my finger... show me verses".
        // If they lift, let's just close for now, or maybe select if they were close?
        // Let's stick to: Lift = Cancel/Close, unless we want to support "Tap to select" in nimble mode too?
        // But nimble mode is overlay.
        // Let's just close.
        this.endNimbleMode();
    },

    endNimbleMode() {
        this.state.nimble.active = false;
        this.els.nimbleOverlay.classList.add('hidden');
        this.cancelHover();
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
