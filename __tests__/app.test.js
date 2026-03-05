/**
 * @jest-environment jsdom
 */

/**
 * NimbleBible App — Comprehensive Jest Test Suite
 *
 * Tests cover:
 *   - Tab management (creation, deduplication, switching, labels, verse ranges)
 *   - Nimble navigation (verse-level behaviors, anchor/drag state)
 *   - Verse selection (single, range, clear)
 *   - Navigation flow (view switching, state management, history)
 *   - Search result navigation
 */

// ─── DOM & Global Mocks ────────────────────────────────────────────────────────

function buildMinimalDOM() {
    document.body.innerHTML = `
    <div id="app" data-current-view="homeView">
        <div id="home-view" class="view active">
            <div class="header"><button class="back-btn">←</button><h1>NimbleBible</h1></div>
            <div class="home-content">
                <button id="btn-ot" class="big-btn" data-testament="Old Testament">Old Testament</button>
                <button id="btn-nt" class="big-btn" data-testament="New Testament">New Testament</button>
            </div>
        </div>
        <div id="book-view" class="view hidden">
            <div class="header"><button class="back-btn">←</button><h1 id="testament-title">Testament</h1><button class="search-btn">🔍</button></div>
            <div id="book-list" class="grid-list"></div>
        </div>
        <div id="chapter-view" class="view hidden">
            <div class="header"><button class="back-btn">←</button><h1 id="book-title">Book</h1></div>
            <div id="chapter-list" class="grid-list"></div>
        </div>
        <div id="verse-list-view" class="view hidden">
            <div class="header"><button class="back-btn">←</button><h1 id="verse-list-title">Chapter</h1></div>
            <div id="verse-list" class="grid-list"></div>
        </div>
        <div id="verse-view" class="view hidden">
            <div class="header"><button class="back-btn">←</button><h1 id="chapter-title">Verses</h1></div>
            <div id="verse-content"></div>
        </div>
        <div id="search-modal" class="search-modal hidden">
            <div class="search-dismiss-container"><button id="search-dismiss-btn">Dismiss</button></div>
            <div class="search-header"><div class="search-input-wrapper">
                <input type="text" id="search-input" /><button id="search-clear-btn">×</button>
            </div></div>
            <div id="search-results" class="search-results"></div>
        </div>
        <div id="audio-toolbar" class="audio-toolbar minimized">
            <button id="toolbar-toggle-btn"><span class="toggle-arrow">^</span></button>
            <div class="toolbar-content">
                <button id="copy-verse-btn" class="toolbar-btn copy-btn disabled"></button>
                <button id="audio-play-btn" class="toolbar-btn audio-btn"></button>
                <div class="audio-scrubber">
                    <div class="scrubber-track"><div class="scrubber-progress" id="scrubber-progress"></div>
                    <input type="range" id="audio-range" min="0" max="100" value="0"></div>
                    <span class="audio-time" id="audio-time">Verse 1 of 1</span>
                </div>
            </div>
        </div>
        <div id="tabs-bar" class="tabs-bar">
            <div id="tabs-container" class="tabs-container"></div>
            <button id="new-tab-btn" class="new-tab-btn">+</button>
        </div>
    </div>`;
}

// ─── Mock global APIs ──────────────────────────────────────────────────────────

Object.defineProperty(navigator, 'vibrate', { value: jest.fn(), writable: true });

// Mock history
const origPushState = window.history.pushState;
const origReplaceState = window.history.replaceState;
window.history.pushState = jest.fn();
window.history.replaceState = jest.fn();
window.history.back = jest.fn();

// Mock speechSynthesis for AudioManager
window.speechSynthesis = {
    getVoices: () => [],
    speak: jest.fn(),
    cancel: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    onvoiceschanged: undefined,
};
window.SpeechSynthesisUtterance = jest.fn().mockImplementation((text) => ({
    text,
    voice: null,
    lang: 'en-US',
    rate: 1,
    pitch: 1,
    volume: 1,
    onend: null,
    onerror: null,
    onboundary: null,
}));

// ─── Load source files ─────────────────────────────────────────────────────────

beforeAll(() => {
    buildMinimalDOM();
});

// Load source files in dependency order
const fs = require('fs');
const path = require('path');

function loadScript(filePath) {
    const code = fs.readFileSync(path.resolve(__dirname, filePath), 'utf-8');
    // eslint-disable-next-line no-eval
    eval(code);
}

// data.js defines DataManager, audio.js defines AudioManager, app.js defines App
loadScript('../js/data.js');
loadScript('../js/audio.js');
loadScript('../js/app.js');

// ─── Test Data ─────────────────────────────────────────────────────────────────

const mockChapter = {
    number: 1,
    verses: [
        { number: 1, text: 'In the beginning God created the heaven and the earth.' },
        { number: 2, text: 'And the earth was without form, and void.' },
        { number: 3, text: 'And God said, Let there be light: and there was light.' },
        { number: 4, text: 'And God saw the light, that it was good.' },
        { number: 5, text: 'And God called the light Day, and the darkness Night.' },
        { number: 6, text: 'And God said, Let there be a firmament.' },
        { number: 7, text: 'And God made the firmament.' },
        { number: 8, text: 'And God called the firmament Heaven.' },
    ],
};

const mockBook = {
    name: 'Genesis',
    chapters: [mockChapter, { number: 2, verses: [{ number: 1, text: 'Thus the heavens were finished.' }] }],
};

const mockBooks = [mockBook];

// ─── Helper: reset App state ───────────────────────────────────────────────────

function resetApp() {
    buildMinimalDOM();
    App.cacheElements();

    App.state.currentView = 'homeView';
    App.state.testament = null;
    App.state.book = null;
    App.state.chapter = null;
    App.state.targetVerseNum = undefined;
    App.state.targetVerseRangeEnd = null;
    App.state.nimble = {
        active: false,
        timer: null,
        currentItem: null,
        progressCleanup: null,
        progressDelayTimer: null,
        verseAnchor: null,
        verseDragEnd: null,
    };
    App.state.verseSelection = { singleSelected: null, rangeStart: null, rangeEnd: null };
    App.state.tabs = [];
    App.state.activeTabId = null;
    App.state.nextTabId = 1;
    App.state.toolbarExpanded = false;
    App.state.navigationCooldown = false;
    App.state.nimbleScrollDirection = 0;
    App.state.nimbleScrollAnimationId = null;
    App.state.search = { query: '', matches: [], renderedCount: 0, batchSize: 60, scrollTop: 0 };
    App.searchEventsBound = false;

    // Stub DataManager for test
    DataManager.books = mockBooks;
    DataManager.getTestamentBooks = jest.fn((testament) => {
        if (testament === 'Old Testament') return mockBooks;
        return [];
    });
    DataManager.getBook = jest.fn((name) => mockBooks.find((b) => b.name === name) || null);
    DataManager.getChapter = jest.fn((bookName, chapterNum) => {
        const book = mockBooks.find((b) => b.name === bookName);
        return book ? book.chapters.find((c) => c.number === chapterNum) || null : null;
    });

    jest.clearAllMocks();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TAB MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe('Tab Management', () => {
    beforeEach(resetApp);

    // ── getTabLabel ──────────────────────────────────────────────────────

    describe('getTabLabel', () => {
        test('returns "Home" for tab without book/chapter', () => {
            const tab = { bookName: null, chapterNumber: null };
            expect(App.getTabLabel(tab)).toBe('Home');
        });

        test('returns abbreviation + chapter for a normal tab', () => {
            const tab = { bookName: 'Genesis', chapterNumber: 1, verseNumber: null };
            expect(App.getTabLabel(tab)).toBe('GEN1');
        });

        test('returns abbreviation + chapter:verse for specific verse', () => {
            const tab = { bookName: 'Genesis', chapterNumber: 1, verseNumber: 5 };
            expect(App.getTabLabel(tab)).toBe('GEN1:5');
        });

        test('returns abbreviation + chapter:start-end for verse range', () => {
            const tab = { bookName: 'Genesis', chapterNumber: 1, verseNumber: 5, verseRangeEnd: 8 };
            expect(App.getTabLabel(tab)).toBe('GEN1:5-8');
        });

        test('does not show range when verseRangeEnd equals verseNumber', () => {
            const tab = { bookName: 'Genesis', chapterNumber: 1, verseNumber: 5, verseRangeEnd: 5 };
            expect(App.getTabLabel(tab)).toBe('GEN1:5');
        });
    });

    // ── isHomeTab ────────────────────────────────────────────────────────

    describe('isHomeTab', () => {
        test('returns true for tab with no book and no chapter', () => {
            expect(App.isHomeTab({ bookName: null, chapterNumber: null })).toBe(true);
        });

        test('returns false for tab with book and chapter', () => {
            expect(App.isHomeTab({ bookName: 'Genesis', chapterNumber: 1 })).toBe(false);
        });

        test('returns false for null/undefined', () => {
            expect(App.isHomeTab(null)).toBe(false);
            expect(App.isHomeTab(undefined)).toBe(false);
        });
    });

    // ── dedupeHomeTabs ──────────────────────────────────────────────────

    describe('dedupeHomeTabs', () => {
        test('does nothing when there is zero or one home tab', () => {
            App.state.tabs = [
                { id: 1, bookName: null, chapterNumber: null },
                { id: 2, bookName: 'Genesis', chapterNumber: 1 },
            ];
            App.state.activeTabId = 1;
            App.dedupeHomeTabs();
            expect(App.state.tabs.length).toBe(2);
        });

        test('removes duplicate home tabs, keeping the active one', () => {
            App.state.tabs = [
                { id: 1, bookName: null, chapterNumber: null },
                { id: 2, bookName: null, chapterNumber: null },
                { id: 3, bookName: 'Genesis', chapterNumber: 1 },
            ];
            App.state.activeTabId = 2;
            App.dedupeHomeTabs();

            const homeTabs = App.state.tabs.filter((t) => App.isHomeTab(t));
            expect(homeTabs.length).toBe(1);
            expect(homeTabs[0].id).toBe(2); // keeps the active one
        });

        test('keeps first home tab when active tab is not home', () => {
            App.state.tabs = [
                { id: 1, bookName: null, chapterNumber: null },
                { id: 2, bookName: null, chapterNumber: null },
                { id: 3, bookName: 'Genesis', chapterNumber: 1 },
            ];
            App.state.activeTabId = 3;
            App.dedupeHomeTabs();

            const homeTabs = App.state.tabs.filter((t) => App.isHomeTab(t));
            expect(homeTabs.length).toBe(1);
            expect(homeTabs[0].id).toBe(1);
        });
    });

    // ── createNewTab ────────────────────────────────────────────────────

    describe('createNewTab', () => {
        test('reuses existing home tab instead of creating duplicate', () => {
            // Start with an existing home tab and a non-home tab
            App.state.tabs = [
                { id: 1, bookName: null, chapterNumber: null },
                { id: 2, bookName: 'Genesis', chapterNumber: 1 },
            ];
            App.state.activeTabId = 2;
            App.state.currentView = 'verseView';
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.state.chapter = mockChapter;

            App.createNewTab();

            // Should reuse the existing home tab, not create a new one
            expect(App.state.activeTabId).toBe(1);
            const homeTabs = App.state.tabs.filter((t) => App.isHomeTab(t));
            expect(homeTabs.length).toBe(1);
        });

        test('creates new home tab when none exists', () => {
            App.state.tabs = [{ id: 1, bookName: 'Genesis', chapterNumber: 1 }];
            App.state.activeTabId = 1;
            App.state.currentView = 'verseView';
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.state.chapter = mockChapter;

            App.createNewTab();

            expect(App.state.tabs.length).toBe(2);
            const newTab = App.state.tabs.find((t) => t.id === App.state.activeTabId);
            expect(App.isHomeTab(newTab)).toBe(true);
        });
    });

    // ── saveCurrentTabState ─────────────────────────────────────────────

    describe('saveCurrentTabState', () => {
        test('saves current state to the active tab', () => {
            App.state.tabs = [{ id: 1, bookName: null, chapterNumber: null, verseNumber: null }];
            App.state.activeTabId = 1;
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.state.chapter = mockChapter;
            App.state.targetVerseNum = 5;
            App.state.targetVerseRangeEnd = 8;
            App.state.currentView = 'verseView';

            App.saveCurrentTabState();

            const tab = App.state.tabs[0];
            expect(tab.bookName).toBe('Genesis');
            expect(tab.chapterNumber).toBe(1);
            expect(tab.verseNumber).toBe(5);
            expect(tab.verseRangeEnd).toBe(8);
        });

        test('deduplicates home tabs after saving', () => {
            // Simulate scenario: two home-looking tabs
            App.state.tabs = [
                { id: 1, bookName: null, chapterNumber: null },
                { id: 2, bookName: null, chapterNumber: null },
            ];
            App.state.activeTabId = 1;
            App.state.testament = null;
            App.state.book = null;
            App.state.chapter = null;

            App.saveCurrentTabState();

            const homeTabs = App.state.tabs.filter((t) => App.isHomeTab(t));
            expect(homeTabs.length).toBe(1);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  NIMBLE NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Nimble Navigation', () => {
    beforeEach(resetApp);

    // ── State management ────────────────────────────────────────────────

    describe('Nimble state fields', () => {
        test('initial state has verseAnchor and verseDragEnd as null', () => {
            expect(App.state.nimble.verseAnchor).toBeNull();
            expect(App.state.nimble.verseDragEnd).toBeNull();
        });
    });

    // ── startNimbleMode ─────────────────────────────────────────────────

    describe('startNimbleMode', () => {
        test('sets nimble active', () => {
            App.startNimbleMode({ testament: 'Old Testament' });
            expect(App.state.nimble.active).toBe(true);
        });

        test('does not start if already active', () => {
            App.state.nimble.active = true;
            App.startNimbleMode({ testament: 'Old Testament' });
            // Should not call openBookList again (would show error if DOM not set up)
            expect(App.state.nimble.active).toBe(true);
        });

        test('opens book list when context has testament only', () => {
            App.startNimbleMode({ testament: 'Old Testament' });
            expect(App.state.currentView).toBe('bookView');
        });

        test('opens chapter list when context has book', () => {
            App.state.testament = 'Old Testament';
            App.startNimbleMode({ testament: 'Old Testament', book: mockBook });
            expect(App.state.currentView).toBe('chapterView');
        });

        test('opens verse list when context has chapter', () => {
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.startNimbleMode({ testament: 'Old Testament', book: mockBook, chapter: mockChapter });
            expect(App.state.currentView).toBe('verseListView');
        });
    });

    // ── handleHoverComplete ─────────────────────────────────────────────

    describe('handleHoverComplete', () => {
        test('enters verse drag sub-mode for verse items', () => {
            const itemEl = document.createElement('div');
            itemEl.className = 'grid-item';
            itemEl.dataset.type = 'verse';
            itemEl.data = { number: 5 };

            App.state.nimble.active = true;

            App.handleHoverComplete(itemEl);

            expect(App.state.nimble.verseAnchor).toBe(5);
            expect(App.state.nimble.verseDragEnd).toBe(5);
            expect(itemEl.classList.contains('nimble-anchor')).toBe(true);
        });

        test('navigates to next level for book items', () => {
            const itemEl = document.createElement('div');
            itemEl.className = 'grid-item';
            itemEl.dataset.type = 'book';
            itemEl.data = mockBook;

            App.state.testament = 'Old Testament';
            App.state.nimble.active = true;

            App.handleHoverComplete(itemEl);

            expect(App.state.currentView).toBe('chapterView');
            expect(App.state.nimble.verseAnchor).toBeNull();
        });

        test('navigates to verse list for chapter items', () => {
            const itemEl = document.createElement('div');
            itemEl.className = 'grid-item';
            itemEl.dataset.type = 'chapter';
            itemEl.data = mockChapter;

            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.state.nimble.active = true;

            App.handleHoverComplete(itemEl);

            expect(App.state.currentView).toBe('verseListView');
        });
    });

    // ── endNimbleMode ───────────────────────────────────────────────────

    describe('endNimbleMode', () => {
        test('auto-opens chapter at verse 1 when on verse list with no anchor', () => {
            App.state.nimble.active = true;
            App.state.currentView = 'verseListView';
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.state.chapter = mockChapter;

            App.endNimbleMode();

            expect(App.state.nimble.active).toBe(false);
            expect(App.state.currentView).toBe('verseView');
        });

        test('opens at specific verse when anchor set but no drag', () => {
            App.state.nimble.active = true;
            App.state.nimble.verseAnchor = 5;
            App.state.nimble.verseDragEnd = 5;
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.state.chapter = mockChapter;

            App.endNimbleMode();

            expect(App.state.currentView).toBe('verseView');
            expect(App.state.targetVerseNum).toBe(5);
        });

        test('opens with range highlight when anchor and drag differ', () => {
            App.state.nimble.active = true;
            App.state.nimble.verseAnchor = 3;
            App.state.nimble.verseDragEnd = 6;
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.state.chapter = mockChapter;

            App.endNimbleMode();

            expect(App.state.currentView).toBe('verseView');
            expect(App.state.targetVerseNum).toBe(3);
            expect(App.state.targetVerseRangeEnd).toBe(6);

            // Verses 3-6 should have nimble-target-visited class
            for (let i = 3; i <= 6; i++) {
                const el = document.getElementById(`verse-${i}`);
                expect(el.classList.contains('nimble-target-visited')).toBe(true);
            }
            // Verse 2 and 7 should NOT have it
            expect(document.getElementById('verse-2').classList.contains('nimble-target-visited')).toBe(false);
            expect(document.getElementById('verse-7').classList.contains('nimble-target-visited')).toBe(false);
        });

        test('handles reverse drag (end < anchor)', () => {
            App.state.nimble.active = true;
            App.state.nimble.verseAnchor = 6;
            App.state.nimble.verseDragEnd = 3;
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.state.chapter = mockChapter;

            App.endNimbleMode();

            expect(App.state.targetVerseNum).toBe(3); // scrolls to start
            expect(App.state.targetVerseRangeEnd).toBe(6);
        });

        test('does nothing when nimble was not active', () => {
            App.state.nimble.active = false;
            App.state.currentView = 'verseListView';
            App.state.chapter = mockChapter;

            App.endNimbleMode();

            // Should remain on verse list view
            expect(App.state.currentView).toBe('verseListView');
        });

        test('cleans up nimble CSS classes on end', () => {
            // Create some grid items with nimble classes
            const container = document.querySelector('.grid-list');
            if (container) {
                const item1 = document.createElement('div');
                item1.className = 'grid-item nimble-anchor';
                const item2 = document.createElement('div');
                item2.className = 'grid-item nimble-range';
                container.appendChild(item1);
                container.appendChild(item2);
            }

            App.state.nimble.active = true;
            App.endNimbleMode();

            const anchors = document.querySelectorAll('.grid-item.nimble-anchor');
            const ranges = document.querySelectorAll('.grid-item.nimble-range');
            expect(anchors.length).toBe(0);
            expect(ranges.length).toBe(0);
        });
    });

    // ── highlightNimbleVerseRange ────────────────────────────────────────

    describe('highlightNimbleVerseRange', () => {
        test('highlights verse grid items in range', () => {
            // Set up verse list view with grid items
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.openVerseList(mockChapter);

            App.state.nimble.verseAnchor = 2;
            App.state.nimble.verseDragEnd = 4;

            App.highlightNimbleVerseRange();

            const items = document.querySelectorAll('.grid-item');
            // verse 2 = anchor, verse 3 & 4 = range
            let anchorCount = 0;
            let rangeCount = 0;
            items.forEach((el) => {
                if (el.classList.contains('nimble-anchor')) anchorCount++;
                if (el.classList.contains('nimble-range')) rangeCount++;
            });
            expect(anchorCount).toBe(1);
            expect(rangeCount).toBe(2);
        });

        test('does nothing when anchor is null', () => {
            App.state.nimble.verseAnchor = null;
            App.state.nimble.verseDragEnd = 3;
            App.highlightNimbleVerseRange();
            // No error thrown, no crashes
        });
    });

    // ── cancelHover ─────────────────────────────────────────────────────

    describe('cancelHover', () => {
        test('clears timer and progress cleanup', () => {
            const cleanup = jest.fn();
            App.state.nimble.timer = setTimeout(() => { }, 10000);
            App.state.nimble.progressDelayTimer = setTimeout(() => { }, 10000);
            App.state.nimble.progressCleanup = cleanup;
            App.state.nimble.currentItem = document.createElement('div');

            App.cancelHover();

            expect(App.state.nimble.timer).toBeNull();
            expect(App.state.nimble.progressDelayTimer).toBeNull();
            expect(App.state.nimble.progressCleanup).toBeNull();
            expect(App.state.nimble.currentItem).toBeNull();
            expect(cleanup).toHaveBeenCalled();
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  VERSE SELECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Verse Selection', () => {
    beforeEach(() => {
        resetApp();
        // Open verse view to populate verse elements
        App.state.testament = 'Old Testament';
        App.state.book = mockBook;
        App.openVerseView(mockChapter, 1);
    });

    describe('handleVerseSingleTap', () => {
        test('selects a verse on tap', () => {
            const verseEl = document.getElementById('verse-3');
            const verse = mockChapter.verses[2];

            App.state.navigationCooldown = false;
            App.handleVerseSingleTap(verseEl, verse);

            expect(App.state.verseSelection.singleSelected).toBe(3);
            expect(verseEl.classList.contains('selected')).toBe(true);
        });

        test('deselects verse on second tap', () => {
            const verseEl = document.getElementById('verse-3');
            const verse = mockChapter.verses[2];

            // First tap selects
            App.handleVerseSingleTap(verseEl, verse);
            expect(App.state.verseSelection.singleSelected).toBe(3);

            // Second tap deselects
            App.handleVerseSingleTap(verseEl, verse);
            expect(App.state.verseSelection.singleSelected).toBeNull();
            expect(verseEl.classList.contains('selected')).toBe(false);
        });

        test('switches selection between verses', () => {
            const verseEl3 = document.getElementById('verse-3');
            const verseEl5 = document.getElementById('verse-5');
            const verse3 = mockChapter.verses[2];
            const verse5 = mockChapter.verses[4];

            App.handleVerseSingleTap(verseEl3, verse3);
            App.handleVerseSingleTap(verseEl5, verse5);

            expect(App.state.verseSelection.singleSelected).toBe(5);
            expect(verseEl3.classList.contains('selected')).toBe(false);
            expect(verseEl5.classList.contains('selected')).toBe(true);
        });
    });

    describe('setVerseRangeSelection', () => {
        test('sets range correctly', () => {
            App.setVerseRangeSelection(3, 6);

            expect(App.state.verseSelection.rangeStart).toBe(3);
            expect(App.state.verseSelection.rangeEnd).toBe(6);
            expect(App.state.verseSelection.singleSelected).toBeNull();
        });

        test('normalizes reversed range', () => {
            App.setVerseRangeSelection(6, 3);

            expect(App.state.verseSelection.rangeStart).toBe(3);
            expect(App.state.verseSelection.rangeEnd).toBe(6);
        });

        test('marks verse elements with range-selected class', () => {
            App.setVerseRangeSelection(2, 5);

            for (let i = 2; i <= 5; i++) {
                const el = document.getElementById(`verse-${i}`);
                expect(el.classList.contains('range-selected')).toBe(true);
            }
            // Outside range should not be selected
            expect(document.getElementById('verse-1').classList.contains('range-selected')).toBe(false);
            expect(document.getElementById('verse-6').classList.contains('range-selected')).toBe(false);
        });
    });

    describe('clearVerseSelection', () => {
        test('clears all selection state', () => {
            App.state.verseSelection = { singleSelected: 3, rangeStart: 2, rangeEnd: 5 };
            App.clearVerseSelection();

            expect(App.state.verseSelection.singleSelected).toBeNull();
            expect(App.state.verseSelection.rangeStart).toBeNull();
            expect(App.state.verseSelection.rangeEnd).toBeNull();
        });

        test('removes CSS classes from verse elements', () => {
            App.setVerseRangeSelection(2, 5);
            App.clearVerseSelection();

            document.querySelectorAll('.verse').forEach((el) => {
                expect(el.classList.contains('selected')).toBe(false);
                expect(el.classList.contains('range-selected')).toBe(false);
            });
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  NAVIGATION FLOW
// ═══════════════════════════════════════════════════════════════════════════════

describe('Navigation Flow', () => {
    beforeEach(resetApp);

    describe('switchView', () => {
        test('switches to the specified view', () => {
            App.switchView('bookView');
            expect(App.state.currentView).toBe('bookView');

            const bookView = document.getElementById('book-view');
            expect(bookView.classList.contains('active')).toBe(true);
            expect(bookView.classList.contains('hidden')).toBe(false);
        });

        test('hides all other views', () => {
            App.switchView('bookView');

            const homeView = document.getElementById('home-view');
            expect(homeView.classList.contains('hidden')).toBe(true);
        });

        test('sets data-current-view attribute', () => {
            App.switchView('chapterView');
            expect(App.els.app.getAttribute('data-current-view')).toBe('chapterView');
        });
    });

    describe('openBookList', () => {
        test('renders book list items for a testament', () => {
            App.openBookList('Old Testament');

            expect(App.state.testament).toBe('Old Testament');
            expect(App.state.currentView).toBe('bookView');
            expect(App.els.bookList.children.length).toBe(mockBooks.length);
        });
    });

    describe('openChapterList', () => {
        test('renders chapter list for a book', () => {
            App.state.testament = 'Old Testament';
            App.openChapterList(mockBook);

            expect(App.state.book).toBe(mockBook);
            expect(App.state.currentView).toBe('chapterView');
            expect(App.els.chapterList.children.length).toBe(mockBook.chapters.length);
        });
    });

    describe('openVerseList', () => {
        test('renders verse number list for a chapter', () => {
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.openVerseList(mockChapter);

            expect(App.state.chapter).toBe(mockChapter);
            expect(App.state.currentView).toBe('verseListView');
            expect(App.els.verseList.children.length).toBe(mockChapter.verses.length);
        });
    });

    describe('openVerseView', () => {
        test('renders verse content for a chapter', () => {
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.openVerseView(mockChapter, 1);

            expect(App.state.chapter).toBe(mockChapter);
            expect(App.state.currentView).toBe('verseView');

            const verseEls = document.querySelectorAll('.verse');
            expect(verseEls.length).toBe(mockChapter.verses.length);
        });

        test('applies nimble-target style to non-verse-1 targets', () => {
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.openVerseView(mockChapter, 3);

            const targetEl = document.getElementById('verse-3');
            expect(targetEl.classList.contains('nimble-target')).toBe(true);
        });

        test('does NOT apply nimble-target style to verse 1', () => {
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.openVerseView(mockChapter, 1);

            const targetEl = document.getElementById('verse-1');
            expect(targetEl.classList.contains('nimble-target')).toBe(false);
        });

        test('applies nimble-target-visited range when highlightRange is provided', () => {
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.openVerseView(mockChapter, 2, false, false, { start: 2, end: 5 });

            for (let i = 2; i <= 5; i++) {
                const el = document.getElementById(`verse-${i}`);
                expect(el.classList.contains('nimble-target-visited')).toBe(true);
            }
            expect(document.getElementById('verse-1').classList.contains('nimble-target-visited')).toBe(false);
        });

        test('does NOT apply nimble-target when highlightRange is used', () => {
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.openVerseView(mockChapter, 3, false, false, { start: 3, end: 5 });

            // nimble-target should NOT be applied since highlightRange takes priority
            const el = document.getElementById('verse-3');
            expect(el.classList.contains('nimble-target')).toBe(false);
            expect(el.classList.contains('nimble-target-visited')).toBe(true);
        });
    });

    describe('goHome', () => {
        test('resets navigation state', () => {
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.state.chapter = mockChapter;
            App.state.currentView = 'verseView';

            App.goHome();

            expect(App.state.testament).toBeNull();
            expect(App.state.book).toBeNull();
            expect(App.state.chapter).toBeNull();
            expect(App.state.currentView).toBe('homeView');
        });

        test('does nothing if already on home', () => {
            App.state.currentView = 'homeView';
            const spy = jest.spyOn(App, 'switchView');

            App.goHome();

            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SEARCH RESULT NAVIGATION & DUPLICATE TAB PREVENTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Search Result Navigation', () => {
    beforeEach(resetApp);

    describe('_navigateToResult', () => {
        test('reuses home tab for search results', () => {
            App.state.tabs = [{ id: 1, bookName: null, chapterNumber: null }];
            App.state.activeTabId = 1;
            App.state.currentView = 'homeView';

            App._navigateToResult('Old Testament', 'Genesis', 1, 3);

            // Should have reused the home tab
            expect(App.state.tabs.length).toBe(1);
            expect(App.state.tabs[0].bookName).toBe('Genesis');
        });

        test('creates new tab when active tab is not home', () => {
            App.state.tabs = [
                { id: 1, bookName: 'Genesis', chapterNumber: 1, verseNumber: 1, testament: 'Old Testament' },
            ];
            App.state.activeTabId = 1;
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.state.chapter = mockChapter;
            App.state.currentView = 'verseView';
            App.state.targetVerseNum = 1;

            App._navigateToResult('Old Testament', 'Genesis', 2, 1);

            expect(App.state.tabs.length).toBe(2);
        });

        test('does not create duplicate home tabs', () => {
            App.state.tabs = [
                { id: 1, bookName: null, chapterNumber: null },
                { id: 2, bookName: 'Genesis', chapterNumber: 1, verseNumber: 1, testament: 'Old Testament' },
            ];
            App.state.activeTabId = 2;
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.state.chapter = mockChapter;
            App.state.targetVerseNum = 1;
            App.state.currentView = 'verseView';

            App._navigateToResult('Old Testament', 'Genesis', 2, 1);

            const homeTabs = App.state.tabs.filter((t) => App.isHomeTab(t));
            expect(homeTabs.length).toBeLessThanOrEqual(1);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  TAB SWITCHING WITH VERSE RANGE PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Tab Switching with Verse Range Persistence', () => {
    beforeEach(resetApp);

    test('tab label reflects verse range after nimble nav', () => {
        // Simulate: nimble nav selects verse range 3-6
        App.state.tabs = [{
            id: 1,
            testament: 'Old Testament',
            bookName: 'Genesis',
            chapterNumber: 1,
            verseNumber: 3,
            verseRangeEnd: 6,
            scrollPosition: 0,
        }];
        App.state.activeTabId = 1;

        expect(App.getTabLabel(App.state.tabs[0])).toBe('GEN1:3-6');
    });

    test('switchTab restores verse range highlight', () => {
        App.state.tabs = [
            {
                id: 1,
                testament: 'Old Testament',
                bookName: 'Genesis',
                chapterNumber: 1,
                verseNumber: 2,
                verseRangeEnd: 5,
                scrollPosition: 0,
            },
            {
                id: 2,
                testament: 'Old Testament',
                bookName: 'Genesis',
                chapterNumber: 1,
                verseNumber: 1,
                scrollPosition: 0,
            },
        ];
        App.state.activeTabId = 2;
        App.state.testament = 'Old Testament';
        App.state.book = mockBook;
        App.state.chapter = mockChapter;
        App.state.currentView = 'verseView';
        App.state.targetVerseNum = 1;

        // Switch to tab 1 which has a verse range
        App.switchTab(1);

        // Verify range is restored
        for (let i = 2; i <= 5; i++) {
            const el = document.getElementById(`verse-${i}`);
            expect(el.classList.contains('nimble-target-visited')).toBe(true);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  BOOK ABBREVIATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Book Abbreviations', () => {
    test('returns known abbreviation', () => {
        expect(App.getBookAbbreviation('Genesis')).toBe('GEN');
        expect(App.getBookAbbreviation('Revelation')).toBe('REV');
        expect(App.getBookAbbreviation('Psalm')).toBe('PSA');
    });

    test('returns first 3 chars uppercase for unknown books', () => {
        expect(App.getBookAbbreviation('UnknownBook')).toBe('UNK');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  COPY BUTTON STATE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Copy Button State', () => {
    beforeEach(resetApp);

    test('disabled when no selection', () => {
        App.state.verseSelection = { singleSelected: null, rangeStart: null, rangeEnd: null };
        App.updateCopyButtonState();
        expect(App.els.copyVerseBtn.classList.contains('disabled')).toBe(true);
    });

    test('enabled when single verse selected', () => {
        App.state.verseSelection = { singleSelected: 3, rangeStart: null, rangeEnd: null };
        App.updateCopyButtonState();
        expect(App.els.copyVerseBtn.classList.contains('disabled')).toBe(false);
    });

    test('enabled when range selected', () => {
        App.state.verseSelection = { singleSelected: null, rangeStart: 2, rangeEnd: 5 };
        App.updateCopyButtonState();
        expect(App.els.copyVerseBtn.classList.contains('disabled')).toBe(false);
    });
});
