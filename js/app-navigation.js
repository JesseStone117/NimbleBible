globalThis.AppNavigation = {
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

        if (!skipHistory) {
            this.recordTabNavigation();
            if (viewId !== 'verseView') this.updateCurrentTabFromNavigation();
        }
        this.updateNavigationButtons();
    },

navigationSnapshot() {
        return {
            view: this.state.currentView,
            testament: this.state.testament,
            bookName: this.state.book?.name || null,
            chapterNumber: this.state.chapter?.number || null,
            verseNumber: this.state.targetVerseNum || 1,
            range: this.state.currentView === 'verseView' ? this.state.currentPassageRange || null : null,
            scrollPosition: 0
        };
    },

ensureTabNavigation(tab = this.state.tabs.find(item => item.id === this.state.activeTabId)) {
        if (!tab || tab.navigationHistory?.length) return tab;
        // Older saved tabs contain a passage only; seed its navigation hierarchy.
        const home = { view: 'homeView', testament: null, bookName: null, chapterNumber: null, verseNumber: 1, range: null, scrollPosition: 0 };
        const entries = [home];
        if (tab.testament) entries.push({ ...home, view: 'bookView', testament: tab.testament });
        if (tab.bookName) entries.push({ ...entries[entries.length - 1], view: 'chapterView', bookName: tab.bookName });
        if (tab.chapterNumber) {
            entries.push({ ...entries[entries.length - 1], view: 'verseListView', chapterNumber: tab.chapterNumber });
            if (!tab.view || tab.view === 'verseView') {
                const start = { testament: tab.testament, bookName: tab.bookName, chapterNumber: tab.chapterNumber, verseNumber: tab.verseNumber || 1 };
                const end = { ...start, bookName: tab.endBookName || tab.bookName, chapterNumber: tab.endChapterNumber || tab.chapterNumber, verseNumber: tab.endVerseNumber || tab.verseRangeEnd || start.verseNumber };
                entries.push({ ...entries[entries.length - 1], view: 'verseView', verseNumber: start.verseNumber,
                    range: tab.verseRangeEnd || end.bookName !== start.bookName || end.chapterNumber !== start.chapterNumber ? { start, end } : null, scrollPosition: tab.scrollPosition || 0 });
            }
        }
        tab.navigationHistory = entries;
        tab.navigationIndex = entries.length - 1;
        return tab;
    },

captureNavigationScroll() {
        if (this.restoringNavigation) return;
        const tab = this.state.tabs.find(item => item.id === this.state.activeTabId);
        const entry = tab?.navigationHistory?.[tab.navigationIndex];
        if (entry?.view !== this.state.currentView) return;
        const container = this.els[entry.view]?.querySelector('.grid-list, #verse-content');
        if (container) entry.scrollPosition = container.scrollTop;
    },

recordTabNavigation() {
        if (this.restoringNavigation) return;
        const tab = this.ensureTabNavigation();
        if (!tab) return;
        const entry = this.navigationSnapshot();
        const previous = tab.navigationHistory[tab.navigationIndex];
        const same = previous && ['view', 'testament', 'bookName', 'chapterNumber', 'verseNumber'].every(key => previous[key] === entry[key]) &&
            JSON.stringify(previous.range) === JSON.stringify(entry.range);
        if (!same) {
            tab.navigationHistory = tab.navigationHistory.slice(0, tab.navigationIndex + 1);
            tab.navigationHistory.push(entry);
            tab.navigationIndex = tab.navigationHistory.length - 1;
            history.pushState({ view: entry.view, tabId: tab.id, navigationIndex: tab.navigationIndex }, '', '');
        }
        this.saveStateToLocalStorage();
        this.updateNavigationButtons();
    },

updateNavigationButtons() {
        const tab = this.ensureTabNavigation();
        document.querySelectorAll('.back-btn').forEach(button => {
            button.disabled = !tab || tab.navigationIndex <= 0;
        });
        document.querySelectorAll('.forward-btn').forEach(button => {
            button.disabled = !tab || tab.navigationIndex >= tab.navigationHistory.length - 1;
        });
    },

restoreTabNavigation(tab) {
        const entry = tab.navigationHistory[tab.navigationIndex];
        if (!entry) return;
        this.restoringNavigation = true;
        try {
            this.state.testament = entry.testament;
            this.state.book = this.findBook(entry.testament, entry.bookName);
            this.state.chapter = this.state.book?.chapters.find(chapter => chapter.number === entry.chapterNumber) || null;
            this.state.targetVerseNum = entry.verseNumber;
            this.state.targetVerseRangeEnd = null;
            this.state.currentPassageRange = entry.range;
            this.closeSearch();
            if (entry.view === 'verseView' && this.state.chapter) {
                const highlight = entry.range ? { start: entry.range.start.verseNumber, end: entry.range.end.verseNumber, range: entry.range } : null;
                this.openVerseView(this.state.chapter, entry.verseNumber, true, true, highlight);
            } else if (entry.view === 'verseListView' && this.state.chapter) this.openVerseList(this.state.chapter, true);
            else if (entry.view === 'chapterView' && this.state.book) this.openChapterList(this.state.book, true);
            else if (entry.view === 'bookView' && entry.testament) this.openBookList(entry.testament, true);
            else this.switchView('homeView', true);
            const container = this.els[entry.view]?.querySelector('.grid-list, #verse-content');
            if (container) container.scrollTop = entry.scrollPosition || 0;
            this.saveCurrentTabState();
            this.renderTabs();
            history.replaceState({ view: entry.view, tabId: tab.id, navigationIndex: tab.navigationIndex }, '', '');
        } finally {
            this.restoringNavigation = false;
        }
    },

moveTabHistory(direction) {
        const tab = this.ensureTabNavigation();
        if (!tab) return;
        const index = tab.navigationIndex + direction;
        if (index < 0 || index >= tab.navigationHistory.length) return;
        this.captureNavigationScroll();
        tab.navigationIndex = index;
        this.restoreTabNavigation(tab);
    },

goBack() {
        this.moveTabHistory(-1);
    },

goForward() {
        this.moveTabHistory(1);
    },

goHome() {
        // Don't navigate if we're already on home
        if (this.state.currentView === 'homeView') {
            return;
        }

        this.captureNavigationScroll();
        // Reset state
        this.state.targetVerseNum = null;
        this.state.targetVerseRangeEnd = null;
        this.state.currentPassageRange = null;
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
        this.switchView('homeView');
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
        this.captureNavigationScroll();
        this.state.testament = testament;
        this.state.book = null;
        this.state.chapter = null;
        this.state.targetVerseNum = null;
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
        this.captureNavigationScroll();
        this.state.book = book;
        this.state.chapter = null;
        this.state.targetVerseNum = null;
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
        this.captureNavigationScroll();
        this.state.chapter = chapter;
        this.state.targetVerseNum = null;
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
        this.captureNavigationScroll();
        this.state.chapter = chapter;
        this.state.targetVerseNum = targetVerseNum; // Track for tab labels
        this.state.targetVerseRangeEnd = null; // Reset range end
        this.els.chapterTitle.textContent = `${this.state.book.name} ${chapter.number}`;
        const passageRange = highlightRange?.range || (highlightRange ? this.normalizePassageRange(
            this.createPassageRef(this.state.book, chapter, highlightRange.start),
            this.createPassageRef(this.state.book, chapter, highlightRange.end)
        ) : null);
        this.state.currentPassageRange = passageRange;
        const isCrossChapterRange = passageRange &&
            (passageRange.start.bookName !== passageRange.end.bookName ||
             passageRange.start.chapterNumber !== passageRange.end.chapterNumber);
        const passageSegments = isCrossChapterRange ? this.getPassageSegments(passageRange) : null;

        // Reset verse selection
        this.state.verseSelection = {
            singleSelected: null,
            rangeStart: null,
            rangeEnd: null
        };
        this.hideToolbar();

        this.els.verseContent.innerHTML = '';
        if (passageSegments) {
            this.renderPassageRangeSegments(passageSegments);
        } else {
            chapter.verses.forEach(verse => {
                const p = this.createVerseElement(verse);

                if (!highlightRange && verse.number === targetVerseNum && targetVerseNum !== 1) {
                    // Use nimble target styling for navigated-to verses (not default verse 1)
                    p.classList.add('nimble-target');
                    // After animation completes, switch to visited state with just the stripe
                    setTimeout(() => {
                        p.classList.remove('nimble-target');
                        p.classList.add('nimble-target-visited');
                    }, 1000);
                }

                this.els.verseContent.appendChild(p);
            });
        }

        // Apply highlight range if provided (from nimble verse range drag)
        if (passageSegments) {
            this.state.targetVerseRangeEnd = passageRange.end.verseNumber;
            this.applyRenderedPassageHighlight(passageRange);
        } else if (highlightRange) {
            const rangeStart = passageRange ? passageRange.start.verseNumber : Math.min(highlightRange.start, highlightRange.end);
            const rangeEnd = passageRange ? passageRange.end.verseNumber : Math.max(highlightRange.start, highlightRange.end);
            this.state.targetVerseRangeEnd = rangeEnd;
            // Use the white stripe style (nimble-target-visited) for range highlight
            for (let i = rangeStart; i <= rangeEnd; i++) {
                const el = document.getElementById(`verse-${i}`);
                if (el) {
                    el.classList.add('nimble-target-visited', 'passage-selected');
                    if (rangeStart === rangeEnd) {
                        el.classList.add('passage-start', 'passage-end');
                    } else if (i === rangeStart) {
                        el.classList.add('passage-start');
                    } else if (i === rangeEnd) {
                        el.classList.add('passage-end');
                    } else {
                        el.classList.add('passage-middle');
                    }
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
        this.updateCollectionSaveButton();

        // Only auto-scroll if not restoring tab scroll position
        if (!skipAutoScroll) {
            setTimeout(() => {
                const scrollTarget = targetVerseNum;
                const el = document.getElementById(passageSegments
                    ? `verse-${passageRange.start.bookName}-${chapter.number}-${scrollTarget}`
                    : `verse-${scrollTarget}`);
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
            if (skipHistory) this.recordTabNavigation();
            this.updateCurrentTabFromNavigation();
        }
    },

createVerseElement(verse, ref = null) {
        const p = document.createElement('div');
        p.className = 'verse';
        p.id = ref ? `verse-${ref.bookName}-${ref.chapterNumber}-${verse.number}` : `verse-${verse.number}`;
        p.dataset.verseNumber = verse.number;
        p.dataset.testament = this.state.testament;
        p.dataset.bookName = ref?.bookName || this.state.book.name;
        p.dataset.chapterNumber = ref?.chapterNumber || this.state.chapter.number;
        p.innerHTML = `<span class="verse-num">${verse.number}</span>${verse.text}`;
        this.bindVerseSelection(p, verse);
        this.updateVerseCollectionMarker(p);
        return p;
    },

getPassageSegments(range) {
        const normalized = this.normalizePassageRange(range.start, range.end);
        const books = DataManager.books || [];
        const startBookIndex = books.findIndex(book => book.name === normalized.start.bookName);
        const endBookIndex = books.findIndex(book => book.name === normalized.end.bookName);
        if (startBookIndex === -1 || endBookIndex === -1) return [];

        const segments = [];
        for (let bookIndex = startBookIndex; bookIndex <= endBookIndex; bookIndex++) {
            const book = books[bookIndex];
            const startChapterNumber = book.name === normalized.start.bookName
                ? normalized.start.chapterNumber
                : book.chapters[0].number;
            const endChapterNumber = book.name === normalized.end.bookName
                ? normalized.end.chapterNumber
                : book.chapters[book.chapters.length - 1].number;

            book.chapters
                .filter(chapter => chapter.number >= startChapterNumber && chapter.number <= endChapterNumber)
                .forEach((segmentChapter) => {
                    const firstVerse = book.name === normalized.start.bookName && segmentChapter.number === normalized.start.chapterNumber
                        ? normalized.start.verseNumber
                        : segmentChapter.verses[0].number;
                    const lastVerse = book.name === normalized.end.bookName && segmentChapter.number === normalized.end.chapterNumber
                        ? normalized.end.verseNumber
                        : segmentChapter.verses[segmentChapter.verses.length - 1].number;
                    const verses = segmentChapter.verses.filter(verse => verse.number >= firstVerse && verse.number <= lastVerse);
                    if (verses.length > 0) {
                        segments.push({ book, chapter: segmentChapter, verses });
                    }
                });
        }

        return segments;
    },

renderPassageRangeSegments(segments) {
        segments.forEach((segment, segmentIndex) => {
            if (segmentIndex > 0) {
                const heading = document.createElement('div');
                heading.className = 'passage-chapter-heading';
                heading.textContent = `${segment.book.name} ${segment.chapter.number}`;
                this.els.verseContent.appendChild(heading);
            }

            // Keep the surrounding chapter visible; the range controls highlighting.
            segment.chapter.verses.forEach((verse) => {
                const ref = {
                    bookName: segment.book.name,
                    chapterNumber: segment.chapter.number
                };
                this.els.verseContent.appendChild(this.createVerseElement(verse, ref));
            });
        });
    },

applyRenderedPassageHighlight(range) {
        const verses = Array.from(this.els.verseContent.querySelectorAll('.verse')).filter(el => {
            const ref = {
                bookName: el.dataset.bookName,
                chapterNumber: Number(el.dataset.chapterNumber),
                verseNumber: Number(el.dataset.verseNumber)
            };
            return this.comparePassageRefs(ref, range.start) >= 0 &&
                this.comparePassageRefs(ref, range.end) <= 0;
        });
        verses.forEach((el, index) => {
            el.classList.add('nimble-target-visited', 'passage-selected');
            if (verses.length === 1) {
                el.classList.add('passage-start', 'passage-end');
            } else if (index === 0) {
                el.classList.add('passage-start');
            } else if (index === verses.length - 1) {
                el.classList.add('passage-end');
            } else {
                el.classList.add('passage-middle');
            }
        });
    }
};
