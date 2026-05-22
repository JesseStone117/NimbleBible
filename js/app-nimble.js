globalThis.AppNimble = {
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

        // === Verse drag sub-mode: track which verse grid item the finger is over ===
        if (this.state.nimble.verseAnchor !== null) {
            this.state.nimble.lastPoint = { x: touch.clientX, y: touch.clientY };
            this.updateNimbleVerseDragFromPoint(touch.clientX, touch.clientY);

            const activeList = document.querySelector('.view.active .grid-list');
            if (activeList) {
                this.updateNimbleEdgeScroll(activeList, touch, () => {
                    const point = this.state.nimble.lastPoint;
                    if (point) this.updateNimbleVerseDragFromPoint(point.x, point.y);
                });
            }
            return;
        }

        // Auto-scroll logic using requestAnimationFrame for smooth scrolling
        const activeList = document.querySelector('.view.active .grid-list');
        if (activeList) {
            const listRect = activeList.getBoundingClientRect();
            const scrollThreshold = 80;

            let newDirection = 0;
            if (touch.clientY > listRect.bottom - scrollThreshold) {
                // Calculate speed based on how far into the threshold (faster at edge)
                const depth = (touch.clientY - (listRect.bottom - scrollThreshold)) / scrollThreshold;
                newDirection = Math.min(1, depth); // 0 to 1
            } else if (touch.clientY < listRect.top + scrollThreshold) {
                const depth = ((listRect.top + scrollThreshold) - touch.clientY) / scrollThreshold;
                newDirection = -Math.min(1, depth); // -1 to 0
            }

            if (newDirection !== 0 && this.state.nimbleScrollDirection === 0) {
                // Start scrolling - cancel any hover state and remove visual highlight
                this.cancelHover();
                document.querySelectorAll('.grid-item.active').forEach(el => el.classList.remove('active'));
                document.querySelectorAll('.big-btn.active').forEach(el => el.classList.remove('active'));
                this.state.nimbleScrollDirection = newDirection;
                this.startNimbleScroll(activeList);
            } else if (newDirection === 0 && this.state.nimbleScrollDirection !== 0) {
                // Stop scrolling
                this.stopNimbleScroll();
            } else {
                // Update direction/speed
                this.state.nimbleScrollDirection = newDirection;
            }
        }

        // Skip element detection while scrolling
        if (this.state.nimbleScrollDirection !== 0) {
            return;
        }

        const target = document.elementFromPoint(touch.clientX, touch.clientY);

        // Exclude toolbar and tabs bar from nimble navigation
        if (target?.closest('.audio-toolbar') || target?.closest('.tabs-bar')) {
            if (this.state.nimble.currentItem) this.cancelHover();
            return;
        }

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

updateNimbleVerseDragFromPoint(x, y) {
        const target = document.elementFromPoint(x, y);
        let itemEl = target?.closest('.grid-item');

        if (!itemEl || itemEl.dataset.type !== 'verse') {
            const activeList = document.querySelector('.view.active .grid-list');
            if (activeList) {
                const verseItems = Array.from(activeList.querySelectorAll('.grid-item[data-type="verse"]'));
                let closest = null;
                let closestDistance = Infinity;
                verseItems.forEach((el) => {
                    const rect = el.getBoundingClientRect();
                    const centerY = rect.top + rect.height / 2;
                    const centerX = rect.left + rect.width / 2;
                    const distance = Math.abs(centerY - y) + Math.abs(centerX - x) * 0.25;
                    if (distance < closestDistance) {
                        closest = el;
                        closestDistance = distance;
                    }
                });
                itemEl = closest;
            }
        }

        if (itemEl && itemEl.dataset.type === 'verse' && itemEl.data) {
            const verseNum = itemEl.data.number;
            if (verseNum !== this.state.nimble.verseDragEnd) {
                this.state.nimble.verseDragEnd = verseNum;
                this.state.nimble.rangeEndRef = this.createPassageRef(this.state.book, this.state.chapter, verseNum);
                this.highlightNimbleVerseRange();
                if (navigator.vibrate) navigator.vibrate(10);
            }
        }
    },

updateNimbleEdgeScroll(activeList, touch, onScroll = null) {
        const listRect = activeList.getBoundingClientRect();
        const scrollThreshold = 80;

        let newDirection = 0;
        if (touch.clientY > listRect.bottom - scrollThreshold) {
            const depth = (touch.clientY - (listRect.bottom - scrollThreshold)) / scrollThreshold;
            newDirection = Math.min(1, depth);
        } else if (touch.clientY < listRect.top + scrollThreshold) {
            const depth = ((listRect.top + scrollThreshold) - touch.clientY) / scrollThreshold;
            newDirection = -Math.min(1, depth);
        }

        this.state.nimble.scrollCallback = onScroll;

        if (newDirection !== 0 && this.state.nimbleScrollDirection === 0) {
            this.state.nimbleScrollDirection = newDirection;
            this.startNimbleScroll(activeList);
        } else if (newDirection === 0 && this.state.nimbleScrollDirection !== 0) {
            this.stopNimbleScroll();
        } else {
            this.state.nimbleScrollDirection = newDirection;
        }

        if (this.state.nimble.verseAnchor !== null && newDirection !== 0) {
            this.scheduleNimbleBoundaryNavigation(activeList, newDirection);
        } else {
            this.clearNimbleBoundaryNavigationTimer();
        }
    },

scheduleNimbleBoundaryNavigation(activeList, direction) {
        const atStart = activeList.scrollTop <= 1;
        const atEnd = activeList.scrollTop + activeList.clientHeight >= activeList.scrollHeight - 1;
        const shouldNavigate = direction < 0 ? atStart : atEnd;

        if (!shouldNavigate || this.state.nimble.boundaryNavigationTimer) return;

        this.state.nimble.boundaryNavigationTimer = setTimeout(() => {
            this.state.nimble.boundaryNavigationTimer = null;
            this.navigateNimbleAdjacentChapter(direction > 0 ? 1 : -1);
        }, 450);
    },

clearNimbleBoundaryNavigationTimer() {
        if (this.state.nimble.boundaryNavigationTimer) {
            clearTimeout(this.state.nimble.boundaryNavigationTimer);
            this.state.nimble.boundaryNavigationTimer = null;
        }
    },

navigateNimbleAdjacentChapter(direction) {
        const adjacent = this.getAdjacentChapter(direction);
        if (!adjacent) return;

        this.state.book = adjacent.book;
        this.state.chapter = adjacent.chapter;
        this.openVerseList(adjacent.chapter, true);

        const edgeVerse = direction > 0
            ? adjacent.chapter.verses[0]
            : adjacent.chapter.verses[adjacent.chapter.verses.length - 1];

        if (!edgeVerse) return;

        this.state.nimble.verseDragEnd = edgeVerse.number;
        this.state.nimble.rangeEndRef = this.createPassageRef(adjacent.book, adjacent.chapter, edgeVerse.number);
        setTimeout(() => {
            this.highlightNimbleVerseRange();
            const activeList = document.querySelector('.view.active .grid-list');
            if (activeList && direction < 0) {
                activeList.scrollTop = activeList.scrollHeight;
            }
        }, 0);
    },

getAdjacentChapter(direction) {
        if (!this.state.testament || !this.state.book || !this.state.chapter) return null;

        const books = DataManager.getTestamentBooks(this.state.testament);
        const bookIndex = books.findIndex(book => book.name === this.state.book.name);
        if (bookIndex === -1) return null;

        const chapterIndex = this.state.book.chapters.findIndex(chapter => chapter.number === this.state.chapter.number);
        if (chapterIndex === -1) return null;

        const nextChapter = this.state.book.chapters[chapterIndex + direction];
        if (nextChapter) {
            return { book: this.state.book, chapter: nextChapter };
        }

        const nextBook = books[bookIndex + direction];
        if (!nextBook) return null;

        const chapter = direction > 0
            ? nextBook.chapters[0]
            : nextBook.chapters[nextBook.chapters.length - 1];

        return chapter ? { book: nextBook, chapter } : null;
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
            // Enter verse drag sub-mode: store anchor and wait for drag or release
            this.state.nimble.verseAnchor = data.number;
            this.state.nimble.verseDragEnd = data.number;
            this.state.nimble.rangeStartRef = this.createPassageRef(this.state.book, this.state.chapter, data.number);
            this.state.nimble.rangeEndRef = this.createPassageRef(this.state.book, this.state.chapter, data.number);
            // Mark the anchor item visually
            itemEl.classList.add('nimble-anchor');
        }

        this.state.nimble.currentItem = null;
    },

startNimbleScroll(list) {
        const baseSpeed = 15; // pixels per frame at max speed

        const scroll = () => {
            if (this.state.nimbleScrollDirection === 0) {
                this.state.nimbleScrollAnimationId = null;
                return;
            }

            // Speed is proportional to how far into the threshold zone
            const speed = baseSpeed * Math.abs(this.state.nimbleScrollDirection);
            const previousScrollTop = list.scrollTop;
            list.scrollTop += speed * Math.sign(this.state.nimbleScrollDirection);
            if (list.scrollTop !== previousScrollTop && this.state.nimble.scrollCallback) {
                this.state.nimble.scrollCallback();
            }

            this.state.nimbleScrollAnimationId = requestAnimationFrame(scroll);
        };

        if (!this.state.nimbleScrollAnimationId) {
            this.state.nimbleScrollAnimationId = requestAnimationFrame(scroll);
        }
    },

stopNimbleScroll() {
        this.state.nimbleScrollDirection = 0;
        this.state.nimble.scrollCallback = null;
        if (this.state.nimbleScrollAnimationId) {
            cancelAnimationFrame(this.state.nimbleScrollAnimationId);
            this.state.nimbleScrollAnimationId = null;
        }
    },

endNimbleMode() {
        const wasActive = this.state.nimble.active;
        const verseAnchor = this.state.nimble.verseAnchor;
        const verseDragEnd = this.state.nimble.verseDragEnd;
        const rangeStartRef = this.state.nimble.rangeStartRef;
        const rangeEndRef = this.state.nimble.rangeEndRef;

        this.state.nimble.active = false;
        this.state.nimble.verseAnchor = null;
        this.state.nimble.verseDragEnd = null;
        this.state.nimble.lastPoint = null;
        this.state.nimble.scrollCallback = null;
        this.state.nimble.rangeStartRef = null;
        this.state.nimble.rangeEndRef = null;
        this.clearNimbleBoundaryNavigationTimer();
        this.cancelHover();
        this.stopNimbleScroll();
        document.querySelectorAll('.grid-item.active').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.grid-item.nimble-anchor').forEach(el => el.classList.remove('nimble-anchor'));
        document.querySelectorAll('.grid-item.nimble-range').forEach(el => el.classList.remove('nimble-range'));
        document.querySelectorAll('.big-btn.active').forEach(el => el.classList.remove('active'));

        if (!wasActive) return;

        // If we had a verse anchor (long-pressed a verse in the grid)
        if (verseAnchor !== null && this.state.chapter) {
            if (rangeStartRef && rangeEndRef && !this.isSamePassagePoint(rangeStartRef, rangeEndRef)) {
                const normalizedRange = this.normalizePassageRange(rangeStartRef, rangeEndRef);
                const startBook = this.findBook(normalizedRange.start.testament, normalizedRange.start.bookName);
                const startChapter = startBook?.chapters.find(chapter => chapter.number === normalizedRange.start.chapterNumber);
                if (startBook && startChapter) {
                    this.state.testament = normalizedRange.start.testament;
                    this.state.book = startBook;
                    const sameChapter = normalizedRange.start.bookName === normalizedRange.end.bookName &&
                        normalizedRange.start.chapterNumber === normalizedRange.end.chapterNumber;
                    this.openVerseView(startChapter, normalizedRange.start.verseNumber, false, false, {
                        start: normalizedRange.start.verseNumber,
                        end: sameChapter ? normalizedRange.end.verseNumber : startChapter.verses[startChapter.verses.length - 1].number,
                        range: normalizedRange
                    });
                    this.state.targetVerseRangeEnd = normalizedRange.end.verseNumber;
                    const activeTab = this.state.tabs.find(tab => tab.id === this.state.activeTabId);
                    if (activeTab) {
                        this.applyPassageRangeToTab(activeTab, normalizedRange);
                        this.renderTabs();
                        this.saveStateToLocalStorage();
                    }
                }
            } else if (verseDragEnd !== null && verseDragEnd !== verseAnchor) {
                // Dragged to a different verse: open with range highlighted
                const rangeStart = Math.min(verseAnchor, verseDragEnd);
                const rangeEnd = Math.max(verseAnchor, verseDragEnd);
                this.openVerseView(this.state.chapter, rangeStart, false, false, {
                    start: rangeStart,
                    end: rangeEnd
                });
            } else {
                // Released on the same verse: open at that specific verse
                this.openVerseView(this.state.chapter, verseAnchor);
            }
            return;
        }

        // If on verse list view with no anchor, auto-open chapter at verse 1
        if (this.state.currentView === 'verseListView' && this.state.chapter) {
            this.openVerseView(this.state.chapter, 1);
        }
    },

highlightNimbleVerseRange() {
        const anchor = this.state.nimble.verseAnchor;
        const dragEnd = this.state.nimble.verseDragEnd;
        if (anchor === null || dragEnd === null) return;

        const rangeStart = Math.min(anchor, dragEnd);
        const rangeEnd = Math.max(anchor, dragEnd);

        // Clear all range highlights and anchor highlights
        document.querySelectorAll('.grid-item.nimble-range').forEach(el => el.classList.remove('nimble-range'));
        document.querySelectorAll('.grid-item.nimble-anchor').forEach(el => el.classList.remove('nimble-anchor'));
        document.querySelectorAll('.grid-item.active').forEach(el => el.classList.remove('active'));

        // Highlight all verse grid items in range
        const activeList = document.querySelector('.view.active .grid-list');
        if (!activeList) return;

        activeList.querySelectorAll('.grid-item').forEach(el => {
            if (el.dataset.type === 'verse' && el.data) {
                const num = el.data.number;
                if (num >= rangeStart && num <= rangeEnd) {
                    if (num === anchor) {
                        el.classList.add('nimble-anchor');
                    } else {
                        el.classList.add('nimble-range');
                    }
                }
            }
        });
    }
};
