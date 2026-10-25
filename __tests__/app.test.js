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
                <button id="save-collection-btn" class="toolbar-btn save-collection-btn" disabled></button>
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

const dataCode = fs.readFileSync(path.resolve(__dirname, '../js/data.js'), 'utf-8');
eval(dataCode + '\nwindow.DataManager = DataManager;');

const audioCode = fs.readFileSync(path.resolve(__dirname, '../js/audio.js'), 'utf-8');
eval(audioCode + '\nwindow.AudioManager = AudioManager;');

[
    'app-navigation.js',
    'app-nimble.js',
    'app-verse-selection.js',
    'app-tabs.js',
    'app-search.js',
    'app-collections.js',
].forEach((fileName) => {
    const mixinCode = fs.readFileSync(path.resolve(__dirname, `../js/${fileName}`), 'utf-8');
    eval(mixinCode);
});

const appCode = fs.readFileSync(path.resolve(__dirname, '../js/app.js'), 'utf-8');
eval(appCode + '\nwindow.App = App;');

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
        lastPoint: null,
        boundaryArrivalPoint: null,
        scrollCallback: null,
        rangeStartRef: null,
        rangeEndRef: null,
        boundaryNavigationTimer: null,
        boundaryNavigationDirection: 0,
        boundaryNavigationHint: null,
    };
    App.state.verseSelection = { singleSelected: null, rangeStart: null, rangeEnd: null };
    App.state.tabs = [];
    App.state.activeTabId = null;
    App.state.nextTabId = 1;
    App.state.collections = [];
    App.state.collectionSettings = { showMarkers: true, textSize: 'standard' };
    App.collectionVerseIndex = new Map();
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
            App.state.nextTabId = 2;

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

    // ── deleteTab ────────────────────────────────────────────────────────

    describe('deleteTab', () => {
        test('preserves adjacent tab passage state when deleting active tab', () => {
            // Setup two passage tabs side by side
            App.state.tabs = [
                { id: 1, testament: 'Old Testament', bookName: 'Genesis', chapterNumber: 1, verseNumber: 5, verseRangeEnd: null, scrollPosition: 100 },
                { id: 2, testament: 'Old Testament', bookName: 'Exodus', chapterNumber: 2, verseNumber: 3, verseRangeEnd: 8, scrollPosition: 200 }
            ];
            App.state.activeTabId = 2; // Active tab is Exodus

            // Delete the active tab
            App.deleteTab(2);

            // Active tab should now be Genesis (id 1)
            expect(App.state.activeTabId).toBe(1);
            expect(App.state.tabs.length).toBe(1);

            // Expected state variables to be restored correctly without defaulting to 1
            expect(App.state.book.name).toBe('Genesis');
            expect(App.state.targetVerseNum).toBe(5);
            expect(App.state.targetVerseRangeEnd).toBeNull();

            // Ensure openVerseView was called with the correct target verse (5, not 1)
            // By checking if the targetVerseNum was updated properly and not forced to 1.
        });
    });

    // ── showAllTabsOptionsMenu ──────────────────────────────────────────

    describe('showAllTabsOptionsMenu', () => {
        let originalClipboard;
        let originalExecCommand;

        beforeEach(() => {
            originalClipboard = navigator.clipboard;
            originalExecCommand = document.execCommand;

            const mockWriteText = jest.fn().mockResolvedValue();
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: mockWriteText },
                writable: true
            });
            document.execCommand = jest.fn().mockReturnValue(true);

            // Add the new options button to the DOM
            const btn = document.createElement('button');
            btn.id = 'tab-options-btn';
            App.els.tabsBar.appendChild(btn);
            App.els.tabOptionsBtn = btn;
        });

        afterEach(() => {
            Object.defineProperty(navigator, 'clipboard', {
                value: originalClipboard,
                writable: true
            });
            document.execCommand = originalExecCommand;

            // Clean up overlays if any
            document.querySelectorAll('.tab-options-overlay').forEach(el => el.remove());
        });

        test('renders popup with copy and close options', () => {
            App.state.tabs = [
                { id: 1, bookName: null, chapterNumber: null },
                { id: 2, bookName: 'Genesis', chapterNumber: 1, verseNumber: 5 }
            ];

            App.showAllTabsOptionsMenu();

            const overlay = document.querySelector('.tab-options-overlay');
            expect(overlay).not.toBeNull();
            expect(overlay.querySelector('#copy-all-tabs-btn')).not.toBeNull();
            expect(overlay.querySelector('#close-all-tabs-btn')).not.toBeNull();
        });

        test('closes all open tabs when clicking close-all-tabs-btn', () => {
            App.state.tabs = [
                { id: 1, bookName: 'Genesis', chapterNumber: 1, verseNumber: 5 },
                { id: 2, bookName: 'Exodus', chapterNumber: 2, verseNumber: 3 }
            ];

            App.showAllTabsOptionsMenu();

            const overlay = document.querySelector('.tab-options-overlay');
            const closeBtn = overlay.querySelector('#close-all-tabs-btn');
            closeBtn.click();

            // Should reset to a single home tab
            expect(App.state.tabs.length).toBe(1);
            expect(App.isHomeTab(App.state.tabs[0])).toBe(true);
            expect(App.state.currentView).toBe('homeView');
            expect(document.querySelector('.tab-options-overlay')).toBeNull(); // Overlay closed
        });
    });

    describe('passage reference tabs', () => {
        test('parses comma-friendly compact passage references', () => {
            const range = App.parsePassageReference('GEN1:3-6');

            expect(range.start.bookName).toBe('Genesis');
            expect(range.start.chapterNumber).toBe(1);
            expect(range.start.verseNumber).toBe(3);
            expect(range.end.verseNumber).toBe(6);
        });

        test('reorders tabs by id', () => {
            App.state.tabs = [
                { id: 1, bookName: 'Genesis', chapterNumber: 1 },
                { id: 2, bookName: 'Genesis', chapterNumber: 2 },
                { id: 3, bookName: null, chapterNumber: null }
            ];

            App.reorderTab(1, 2);

            expect(App.state.tabs.map(tab => tab.id)).toEqual([2, 1, 3]);
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

        test.each([[3, 6], [6, 3]])('keeps chapter context after selecting verses %i to %i and restoring the tab', (anchor, end) => {
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.state.chapter = mockChapter;
            App.state.nimble.active = true;
            App.state.nimble.verseAnchor = anchor;
            App.state.nimble.verseDragEnd = end;
            App.state.nimble.rangeStartRef = App.createPassageRef(mockBook, mockChapter, anchor);
            App.state.nimble.rangeEndRef = App.createPassageRef(mockBook, mockChapter, end);

            const expectChapterWithSelection = () => {
                const verses = Array.from(App.els.verseContent.querySelectorAll('.verse'));
                expect(verses.map(el => Number(el.dataset.verseNumber))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
                expect(verses.filter(el => el.classList.contains('passage-selected'))
                    .map(el => Number(el.dataset.verseNumber))).toEqual([3, 4, 5, 6]);
                expect(document.getElementById('verse-3').classList.contains('passage-start')).toBe(true);
                expect(document.getElementById('verse-6').classList.contains('passage-end')).toBe(true);
            };

            App.endNimbleMode();
            expectChapterWithSelection();
            const rangeTabId = App.state.activeTabId;
            expect(App.getTabLabel(App.state.tabs.find(tab => tab.id === rangeTabId))).toBe('GEN1:3-6');

            App.createNewTab();
            App.switchTab(rangeTabId);
            expectChapterWithSelection();

            App.state.tabs = [];
            App.state.activeTabId = null;
            expect(App.loadStateFromLocalStorage()).toBe(true);
            App.switchTab(rangeTabId, true);
            expectChapterWithSelection();
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

    describe('boundary navigation feedback', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.openVerseList(mockChapter);
            App.state.nimble.active = true;
            App.state.nimble.verseAnchor = 7;
            App.state.nimble.verseDragEnd = 7;
            App.state.nimble.rangeStartRef = App.createPassageRef(mockBook, mockChapter, 7);
            App.state.nimble.rangeEndRef = App.state.nimble.rangeStartRef;
        });

        afterEach(() => {
            App.stopNimbleScroll();
            App.clearNimbleBoundaryNavigationTimer();
            jest.clearAllTimers();
            jest.useRealTimers();
            jest.restoreAllMocks();
        });

        function setListGeometry(firstTop, lastBottom) {
            const list = App.els.verseList;
            jest.spyOn(list, 'getBoundingClientRect').mockReturnValue({ top: 60, bottom: 500 });
            jest.spyOn(list.firstElementChild, 'getBoundingClientRect').mockReturnValue({ top: firstTop, bottom: firstTop + 60 });
            jest.spyOn(list.lastElementChild, 'getBoundingClientRect').mockImplementation(() => ({ top: lastBottom - 60, bottom: lastBottom }));
            Object.defineProperty(list, 'clientHeight', { configurable: true, value: 440 });
            Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 2000 });
            list.scrollTop = 100;
            return list;
        }

        test('extends just beyond the last row without scrolling through the bottom spacer', () => {
            const list = setListGeometry(-200, 300);
            App.updateNimbleEdgeScroll(list, { clientX: 160, clientY: 326 });
            expect(list.scrollTop + list.clientHeight).toBeLessThan(list.scrollHeight);
            expect(App.state.nimble.boundaryNavigationDirection).toBe(1);
            expect(App.state.nimbleScrollDirection).toBe(0);
            expect(document.querySelector('.nimble-boundary-hint').textContent).toContain('Genesis 2');
            jest.advanceTimersByTime(App.nimbleBoundaryHoldDuration - 1);
            expect(App.state.chapter).toBe(mockChapter);
            jest.advanceTimersByTime(1);
            expect(App.state.chapter).toBe(mockBook.chapters[1]);
            expect(App.els.verseList.scrollTop).toBe(0);
        });

        test('moving back onto the verses cancels the chapter transition', () => {
            const list = setListGeometry(-200, 300);
            App.updateNimbleEdgeScroll(list, { clientX: 160, clientY: 326 });
            App.updateNimbleEdgeScroll(list, { clientX: 160, clientY: 280 });
            expect(document.querySelector('.nimble-boundary-hint')).toBeNull();
            jest.advanceTimersByTime(App.nimbleBoundaryHoldDuration);
            expect(App.state.chapter).toBe(mockChapter);
        });

        test('does not restart the hold timer as the finger moves within the boundary area', () => {
            const list = setListGeometry(-200, 300);
            App.updateNimbleEdgeScroll(list, { clientY: 326 });
            const timer = App.state.nimble.boundaryNavigationTimer;
            jest.advanceTimersByTime(300);
            App.updateNimbleEdgeScroll(list, { clientY: 340 });
            expect(App.state.nimble.boundaryNavigationTimer).toBe(timer);
            jest.advanceTimersByTime(App.nimbleBoundaryHoldDuration - 300);
            expect(App.state.chapter).toBe(mockBook.chapters[1]);
        });

        test('auto-scroll hands off to chapter extension even with a stationary finger', () => {
            const list = setListGeometry(-200, 700);
            let frame;
            const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
                frame = callback;
                return 123;
            });
            const touch = { clientY: 490 };
            const update = () => App.updateNimbleEdgeScroll(list, touch, update);
            update();
            expect(App.state.nimbleScrollDirection).toBeGreaterThan(0);
            list.lastElementChild.getBoundingClientRect.mockReturnValue({ top: 380, bottom: 440 });
            frame();
            expect(App.state.nimble.boundaryNavigationDirection).toBe(1);
            expect(App.state.nimbleScrollDirection).toBe(0);
            expect(App.state.nimbleScrollAnimationId).toBeNull();
            expect(raf).toHaveBeenCalledTimes(1);
        });

        test('the next chapter starts at verse one and stays there until the finger moves deliberately', () => {
            App.els.verseList.scrollTop = 900;
            App.state.nimble.lastPoint = { x: 160, y: 480 };
            App.state.nimbleScrollDirection = 1;
            App.state.nimbleScrollAnimationId = requestAnimationFrame(() => {});
            App.navigateNimbleAdjacentChapter(1);
            expect(App.els.verseList.scrollTop).toBe(0);
            expect(App.state.nimbleScrollDirection).toBe(0);
            expect(App.state.nimbleScrollAnimationId).toBeNull();
            expect(App.state.nimble.rangeEndRef.chapterNumber).toBe(2);
            expect(App.state.nimble.rangeEndRef.verseNumber).toBe(1);
            const update = jest.spyOn(App, 'updateNimbleVerseDragFromPoint').mockImplementation(() => {});
            App.handleNimbleMove({ preventDefault() {}, touches: [{ clientX: 161, clientY: 481 }] });
            jest.advanceTimersByTime(2000);
            expect(update).not.toHaveBeenCalled();
            expect(App.state.chapter.number).toBe(2);
            expect(App.els.verseList.scrollTop).toBe(0);
        });

        test('opening the previous chapter shows its last row instead of its bottom spacer', () => {
            App.openVerseList(mockBook.chapters[1]);
            App.state.nimble.rangeStartRef = App.createPassageRef(mockBook, mockBook.chapters[1], 1);
            App.state.nimble.rangeEndRef = App.state.nimble.rangeStartRef;
            jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
                return this.id === 'verse-list' ? { top: 60, bottom: 500 } : { top: 840, bottom: 900 };
            });
            App.navigateNimbleAdjacentChapter(-1);
            expect(App.state.chapter).toBe(mockChapter);
            expect(App.els.verseList.scrollTop).toBe(500);
            expect(Array.from(App.els.verseList.querySelectorAll('.nimble-range')).map(el => el.data.number)).toEqual([8]);
        });

        test('going forward highlights only the selected verses in the new chapter', () => {
            const nextChapter = { number: 2, verses: mockChapter.verses };
            const book = { ...mockBook, chapters: [mockChapter, nextChapter] };
            DataManager.books = [book];
            DataManager.getTestamentBooks.mockReturnValue([book]);
            App.state.book = book;
            App.navigateNimbleAdjacentChapter(1);
            expect(Array.from(App.els.verseList.querySelectorAll('.nimble-range')).map(el => el.data.number)).toEqual([1]);
            expect(App.els.verseList.querySelector('.nimble-anchor')).toBeNull();
        });

        test('releasing before the hold completes cancels the transition', () => {
            const list = setListGeometry(-200, 300);
            App.updateNimbleEdgeScroll(list, { clientY: 326 });
            jest.spyOn(App, 'openVerseView').mockImplementation(() => {});
            App.endNimbleMode();
            jest.advanceTimersByTime(App.nimbleBoundaryHoldDuration);
            expect(App.state.chapter).toBe(mockChapter);
            expect(App.state.nimble.boundaryArrivalPoint).toBeNull();
        });

        test('shows destination before extending into the next chapter', () => {
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.openVerseList(mockChapter);
            App.state.nimble.verseAnchor = 7;

            App.scheduleNimbleBoundaryNavigation(App.els.verseList, 1);

            const hint = document.querySelector('.nimble-boundary-hint');
            expect(hint).not.toBeNull();
            expect(hint.textContent).toContain('Hold to extend to Genesis 2');

            App.clearNimbleBoundaryNavigationTimer();
        });

        test('shows disabled feedback when there is no next chapter', () => {
            App.state.testament = 'Old Testament';
            App.state.book = mockBook;
            App.state.chapter = mockBook.chapters[1];
            App.openVerseList(mockBook.chapters[1]);
            App.state.nimble.verseAnchor = 1;

            App.scheduleNimbleBoundaryNavigation(App.els.verseList, 1);

            const hint = document.querySelector('.nimble-boundary-hint');
            expect(hint).not.toBeNull();
            expect(hint.textContent).toContain('No next chapter');
            expect(hint.classList.contains('is-disabled')).toBe(true);

            App.clearNimbleBoundaryNavigationTimer();
        });
    });

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

    describe('selection in highlighted passages across chapters', () => {
        beforeEach(() => {
            App.openVerseView(mockChapter, 7, false, false, {
                start: 7,
                end: 8,
                range: {
                    start: App.createPassageRef(mockBook, mockChapter, 7),
                    end: App.createPassageRef(mockBook, mockBook.chapters[1], 1),
                },
            });
        });

        test('long press selects the touched verse even when its number repeats in another chapter', () => {
            const verseEl = document.getElementById('verse-Genesis-2-1');
            App.handleVerseLongPress(verseEl);
            expect(Array.from(document.querySelectorAll('.range-selected')).map(el => el.id))
                .toEqual(['verse-Genesis-2-1']);
            expect(verseEl.classList.contains('passage-selected')).toBe(true);

            App.clearVerseSelection();
            expect(verseEl.classList.contains('range-selected')).toBe(false);
            expect(verseEl.classList.contains('passage-selected')).toBe(true);
        });

        test('tapping and copying a verse uses its chapter identity', () => {
            const first = document.getElementById('verse-Genesis-1-1');
            const second = document.getElementById('verse-Genesis-2-1');
            const copy = jest.spyOn(App, 'fallbackCopyText').mockImplementation(() => {});
            try {
                App.handleVerseSingleTap(first, mockChapter.verses[0]);
                App.handleVerseSingleTap(second, mockBook.chapters[1].verses[0]);
                expect(first.classList.contains('selected')).toBe(false);
                expect(second.classList.contains('selected')).toBe(true);
                App.copySelectedVerses();
                expect(copy).toHaveBeenCalledWith('Genesis 2:1 Thus the heavens were finished.');
            } finally {
                copy.mockRestore();
            }
        });

        test.each([false, true])('drag selection across chapters copies only selected verses (reverse: %s)', reverse => {
            const first = document.getElementById(reverse ? 'verse-Genesis-2-1' : 'verse-Genesis-1-7');
            const last = document.getElementById(reverse ? 'verse-Genesis-1-7' : 'verse-Genesis-2-1');
            const hitTest = jest.spyOn(App, 'getClosestVerseElementForPoint').mockReturnValue(last);
            const copy = jest.spyOn(App, 'fallbackCopyText').mockImplementation(() => {});
            try {
                const anchor = App.handleVerseLongPress(first);
                App.updateVerseRangeDragFromPoint(anchor, { x: 0, y: 0 });
                expect(Array.from(document.querySelectorAll('.range-selected')).map(el => el.id))
                    .toEqual(['verse-Genesis-1-7', 'verse-Genesis-1-8', 'verse-Genesis-2-1']);
                App.copySelectedVerses();
                expect(copy).toHaveBeenCalledWith(
                    'Genesis 1:7-8 7 And God made the firmament. 8 And God called the firmament Heaven.\n' +
                    'Genesis 2:1 Thus the heavens were finished.'
                );
            } finally {
                hitTest.mockRestore();
                copy.mockRestore();
            }
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

        test('keeps context in every chapter when a passage range continues into the next chapter', () => {
            App.state.testament = 'Old Testament';
            const nextChapter = { number: 2, verses: [
                { number: 1, text: 'Selected verse in the next chapter.' },
                { number: 2, text: 'Context after the selected range.' },
            ] };
            const book = { ...mockBook, chapters: [mockChapter, nextChapter] };
            App.state.book = book;
            DataManager.books = [book];
            DataManager.getTestamentBooks.mockReturnValue([book]);

            App.openVerseView(mockChapter, 7, false, false, {
                start: 7,
                end: 8,
                range: {
                    start: { testament: 'Old Testament', bookName: 'Genesis', chapterNumber: 1, verseNumber: 7 },
                    end: { testament: 'Old Testament', bookName: 'Genesis', chapterNumber: 2, verseNumber: 1 },
                },
            });

            const verseEls = document.querySelectorAll('.verse');
            expect(verseEls.length).toBe(10);
            expect(document.querySelector('.passage-chapter-heading').textContent).toBe('Genesis 2');
            expect(Array.from(verseEls).filter(el => el.classList.contains('passage-selected'))
                .map(el => el.id)).toEqual(['verse-Genesis-1-7', 'verse-Genesis-1-8', 'verse-Genesis-2-1']);
            expect(document.getElementById('verse-Genesis-1-7').classList.contains('passage-start')).toBe(true);
            expect(document.getElementById('verse-Genesis-2-1').classList.contains('passage-end')).toBe(true);
            expect(document.getElementById('verse-Genesis-2-2').classList.contains('nimble-target-visited')).toBe(false);
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
//  COLLECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Collections', () => {
    beforeAll(() => {
        HTMLDialogElement.prototype.showModal = function () { this.open = true; };
        HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
    });

    beforeEach(() => {
        resetApp();
        localStorage.removeItem(App.collectionStorageKey);
        App.initCollections();
        App.state.testament = 'Old Testament';
        App.state.book = mockBook;
        App.openVerseView(mockChapter, 1);
    });

    afterEach(() => {
        clearTimeout(App.collectionStatusTimer);
        localStorage.removeItem(App.collectionStorageKey);
        document.documentElement.style.removeProperty('--reading-font-size');
        jest.restoreAllMocks();
    });

    const range = (first, last, endChapter = mockChapter) => ({
        start: App.createPassageRef(mockBook, mockChapter, first),
        end: App.createPassageRef(mockBook, endChapter, last),
    });

    test('creates named collections, trims names, and prevents empty or duplicate names', () => {
        const collection = App.createCollection('  Encouragement  ');
        expect(collection.name).toBe('Encouragement');
        expect(App.createCollection('encouragement')).toBeNull();
        expect(App.createCollection('   ')).toBeNull();
        expect(App.state.collections).toHaveLength(1);
        expect(JSON.parse(localStorage.getItem(App.collectionStorageKey)).collections[0].name).toBe('Encouragement');
    });

    test('normalizes reversed saved ranges and avoids duplicate groupings', () => {
        const collection = App.createCollection('Study');
        expect(App.addPassageToCollection(collection.id, range(6, 3))).toBe(true);
        expect(App.addPassageToCollection(collection.id, range(3, 6))).toBe(true);
        expect(App.state.collections[0].passages).toHaveLength(1);
        expect(App.state.collections[0].passages[0].start.verseNumber).toBe(3);
        expect(App.state.collections[0].passages[0].end.verseNumber).toBe(6);
    });

    test('marks only saved verses and reports all collection memberships', () => {
        const first = App.createCollection('Study', range(3, 5));
        const second = App.createCollection('Hope', range(4, 6));
        expect(document.getElementById('verse-2').querySelector('.verse-collection-marker')).toBeNull();
        expect(document.getElementById('verse-3').querySelector('.verse-collection-marker').title).toBe('In Study');
        const marker = document.getElementById('verse-4').querySelector('.verse-collection-marker');
        expect(marker.getAttribute('aria-label')).toContain('Study, Hope');
        marker.click();
        expect(App.els.libraryDialog.open).toBe(true);
        expect(App.els.libraryDialog.querySelectorAll('.collection-row')).toHaveLength(2);
        expect(App.state.verseSelection.singleSelected).toBeNull();
        expect(App.collectionVerseIndex.get('Genesis:1:4')).toEqual(new Set([first.id, second.id]));
    });

    test('markers survive a reload without changing saved tabs', () => {
        const savedTabs = localStorage.getItem(App.storageKey);
        App.createCollection('Favorites', range(2, 4));
        App.state.collections = [];
        App.collectionVerseIndex = new Map();
        App.loadCollections();
        App.applyCollectionSettings();
        expect(App.state.collections[0].passages).toHaveLength(1);
        expect(document.getElementById('verse-3').querySelector('.verse-collection-marker')).not.toBeNull();
        expect(localStorage.getItem(App.storageKey)).toBe(savedTabs);
    });

    test('saves the active blue selection instead of the larger white highlighted range', () => {
        App.openVerseView(mockChapter, 2, false, false, { start: 2, end: 6 });
        expect(App.getCollectionSaveRange()).toEqual(range(2, 6));
        expect(App.els.saveCollectionBtn.disabled).toBe(false);
        App.setVerseRangeSelection(3, 4);
        expect(App.getCollectionSaveRange()).toEqual(range(3, 4));
        App.openSaveCollection();
        const form = App.els.saveCollectionDialog.querySelector('form');
        form.elements.collectionName.value = 'Chosen verses';
        form.dispatchEvent(new Event('submit', { cancelable: true }));
        expect(App.state.collections[0].passages[0]).toMatchObject(range(3, 4));
        expect(App.els.saveCollectionDialog.open).toBe(false);
        expect(document.getElementById('verse-2').querySelector('.verse-collection-marker')).toBeNull();
    });

    test('saves and marks ranges across chapters with repeating verse numbers', () => {
        const passage = range(7, 1, mockBook.chapters[1]);
        App.openVerseView(mockChapter, 7, false, false, { start: 7, end: 8, range: passage });
        expect(App.getCollectionSaveRange()).toEqual(passage);
        App.createCollection('Across chapters', App.getCollectionSaveRange());
        expect(Array.from(App.els.verseContent.querySelectorAll('.has-collection')).map(el => el.id))
            .toEqual(['verse-Genesis-1-7', 'verse-Genesis-1-8', 'verse-Genesis-2-1']);
    });

    test('removing a saved grouping updates markers while keeping overlapping memberships', () => {
        const collection = App.createCollection('Study', range(2, 4));
        App.addPassageToCollection(collection.id, range(4, 6));
        App.openLibrary('detail', collection.id);
        App.els.libraryDialog.querySelector('[aria-label^="Remove Genesis 1:2"]').click();
        expect(App.state.collections[0].passages).toHaveLength(1);
        expect(document.getElementById('verse-3').querySelector('.verse-collection-marker')).toBeNull();
        expect(document.getElementById('verse-4').querySelector('.verse-collection-marker')).not.toBeNull();
    });

    test('opens every grouping as an individual tab and returns to the first grouping', () => {
        const collection = App.createCollection('Reading', range(3, 4));
        App.addPassageToCollection(collection.id, range(7, 1, mockBook.chapters[1]));
        App.addPassageToCollection(collection.id, range(6, 6));
        const originalTab = App.state.activeTabId;
        const count = App.state.tabs.length;
        expect(App.openAllCollectionPassages(collection.id)).toBe(3);
        expect(App.state.tabs).toHaveLength(count + 3);
        expect(App.state.tabs.some(tab => tab.id === originalTab)).toBe(true);
        const newTabs = App.state.tabs.slice(-3);
        expect(newTabs.map(tab => App.getTabLabel(tab))).toEqual(['GEN1:3-4', 'GEN1:7-2:1', 'GEN1:6']);
        expect(App.state.activeTabId).toBe(newTabs[0].id);
        expect(Array.from(document.querySelectorAll('.passage-selected')).map(el => Number(el.dataset.verseNumber))).toEqual([3, 4]);
        expect(JSON.parse(localStorage.getItem(App.storageKey)).tabs).toHaveLength(count + 3);
    });

    test('an empty collection does not create any tabs', () => {
        const collection = App.createCollection('Empty');
        const before = App.state.tabs.length;
        expect(App.openAllCollectionPassages(collection.id)).toBe(0);
        expect(App.state.tabs).toHaveLength(before);
        App.openLibrary('detail', collection.id);
        expect(App.els.libraryDialog.querySelector('.collection-secondary').disabled).toBe(true);
    });

    test('does not claim to save or change markers when device storage fails', () => {
        const collection = App.createCollection('Study');
        const stored = localStorage.getItem(App.collectionStorageKey);
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
        expect(App.addPassageToCollection(collection.id, range(2, 4))).toBe(false);
        expect(App.state.collections[0].passages).toHaveLength(0);
        expect(document.querySelector('.verse-collection-marker')).toBeNull();
        expect(localStorage.getItem(App.collectionStorageKey)).toBe(stored);
        expect(document.getElementById('collection-status').textContent).toContain('Couldn’t save');
    });

    test('collection names are rendered as text', () => {
        const name = '<img src=x onerror=alert(1)>';
        App.createCollection(name);
        App.openLibrary();
        expect(App.els.libraryDialog.querySelector('img')).toBeNull();
        expect(App.els.libraryDialog.textContent).toContain(name);
    });

    test('settings persist and hiding markers does not remove collection memberships', () => {
        App.createCollection('Study', range(3, 4));
        App.openLibrary('settings');
        const checkbox = App.els.libraryDialog.querySelector('input[type="checkbox"]');
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change'));
        const size = App.els.libraryDialog.querySelector('select');
        size.value = 'large';
        size.dispatchEvent(new Event('change'));
        expect(document.querySelector('.verse-collection-marker')).toBeNull();
        expect(App.state.collections[0].passages).toHaveLength(1);
        App.loadCollections();
        App.applyCollectionSettings();
        expect(App.state.collectionSettings).toEqual({ showMarkers: false, textSize: 'large' });
        expect(document.documentElement.style.getPropertyValue('--reading-font-size')).toBe('1.3rem');
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
