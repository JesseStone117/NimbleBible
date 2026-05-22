globalThis.AppTabs = {
showAllTabsOptionsMenu() {
        if (!this.els.tabOptionsBtn) return;

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'tab-options-overlay';
        overlay.innerHTML = `
            <div class="tab-options-popup">
                <p>All Tabs Options</p>
                <div class="tab-options-buttons">
                    <textarea id="passage-tabs-input" class="passage-tabs-input" placeholder="John 3:16, Romans 8:1-4"></textarea>
                    <button class="tab-options-action" id="open-passage-tabs-btn">Open References in Tabs</button>
                    <button class="tab-options-action" id="copy-all-tabs-btn">Copy Passage References</button>
                    <button class="tab-options-danger" id="close-all-tabs-btn">Close All Open Tabs</button>
                    <button class="tab-options-cancel">Cancel</button>
                </div>
            </div>
        `;

        // Cancel button
        overlay.querySelector('.tab-options-cancel').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        overlay.querySelector('#open-passage-tabs-btn').addEventListener('click', () => {
            const input = overlay.querySelector('#passage-tabs-input');
            const opened = this.openPassageReferencesInTabs(input.value);
            if (opened > 0) {
                document.body.removeChild(overlay);
            }
        });

        // Copy All button
        overlay.querySelector('#copy-all-tabs-btn').addEventListener('click', () => {
            const passageTabs = this.state.tabs.filter(t => !this.isHomeTab(t));
            if (passageTabs.length > 0) {
                const textToCopy = passageTabs.map(t => this.getTabLabel(t)).join(', ');
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(textToCopy).catch(err => {
                        console.error('Failed to copy tabs text:', err);
                        this.fallbackCopyText(textToCopy);
                    });
                } else {
                    this.fallbackCopyText(textToCopy);
                }
            }
            document.body.removeChild(overlay);
        });

        // Close All button
        overlay.querySelector('#close-all-tabs-btn').addEventListener('click', () => {
            // Reset to a single home tab
            this.state.tabs = [{
                id: this.state.nextTabId++,
                testament: null,
                bookName: null,
                chapterNumber: null,
                scrollPosition: 0
            }];
            this.state.activeTabId = this.state.tabs[0].id;

            this.saveStateToLocalStorage(); // Persist

            this.goHome();
            this.renderTabs();
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

getBookAbbreviation(bookName) {
        return this.bookAbbreviations[bookName] || bookName.substring(0, 3).toUpperCase();
    },

createPassageRef(book, chapter, verseNumber) {
        if (!book || !chapter || !verseNumber) return null;
        return {
            testament: this.state.testament,
            bookName: book.name,
            chapterNumber: chapter.number,
            verseNumber
        };
    },

findBook(testament, bookName) {
        if (!testament || !bookName) return null;
        return DataManager.getTestamentBooks(testament).find(book => book.name === bookName) || null;
    },

isSamePassagePoint(a, b) {
        return !!a && !!b &&
            a.testament === b.testament &&
            a.bookName === b.bookName &&
            a.chapterNumber === b.chapterNumber &&
            a.verseNumber === b.verseNumber;
    },

comparePassageRefs(a, b) {
        const books = DataManager.books || [];
        const bookA = books.findIndex(book => book.name === a.bookName);
        const bookB = books.findIndex(book => book.name === b.bookName);
        if (bookA !== bookB) return bookA - bookB;
        if (a.chapterNumber !== b.chapterNumber) return a.chapterNumber - b.chapterNumber;
        return a.verseNumber - b.verseNumber;
    },

normalizePassageRange(start, end) {
        return this.comparePassageRefs(start, end) <= 0
            ? { start, end }
            : { start: end, end: start };
    },

applyPassageRangeToTab(tab, range) {
        tab.testament = range.start.testament;
        tab.bookName = range.start.bookName;
        tab.chapterNumber = range.start.chapterNumber;
        tab.verseNumber = range.start.verseNumber;
        tab.verseRangeEnd = range.end.verseNumber;
        tab.endBookName = range.end.bookName;
        tab.endChapterNumber = range.end.chapterNumber;
        tab.endVerseNumber = range.end.verseNumber;
    },

isHomeTab(tab) {
        return !!tab && !tab.bookName && !tab.chapterNumber;
    },

dedupeHomeTabs() {
        const homeTabs = this.state.tabs.filter(tab => this.isHomeTab(tab));
        if (homeTabs.length <= 1) return;

        const activeTab = this.state.tabs.find(tab => tab.id === this.state.activeTabId);
        const keepHomeTabId = activeTab && this.isHomeTab(activeTab)
            ? activeTab.id
            : homeTabs[0].id;

        this.state.tabs = this.state.tabs.filter(tab => !this.isHomeTab(tab) || tab.id === keepHomeTabId);
    },

getTabLabel(tab) {
        if (!tab.bookName || !tab.chapterNumber) {
            return 'Home';
        }
        let label = `${this.getBookAbbreviation(tab.bookName)}${tab.chapterNumber}`;
        if (tab.verseNumber) {
            label += `:${tab.verseNumber}`;
            if (tab.endBookName && tab.endChapterNumber && tab.endVerseNumber &&
                (tab.endBookName !== tab.bookName || tab.endChapterNumber !== tab.chapterNumber)) {
                const endBook = tab.endBookName !== tab.bookName
                    ? `${this.getBookAbbreviation(tab.endBookName)}${tab.endChapterNumber}`
                    : `${tab.endChapterNumber}`;
                label += `-${endBook}:${tab.endVerseNumber}`;
            } else if (tab.verseRangeEnd && tab.verseRangeEnd !== tab.verseNumber) {
                label += `-${tab.verseRangeEnd}`;
            }
        }
        return label;
    },

openPassageReferencesInTabs(input) {
        const refs = (input || '')
            .split(',')
            .map(ref => ref.trim())
            .filter(Boolean)
            .map(ref => this.parsePassageReference(ref))
            .filter(Boolean);

        if (refs.length === 0) return 0;

        this.saveCurrentTabState();
        this.state.tabs = this.state.tabs.filter(tab => !this.isHomeTab(tab));

        refs.forEach((range) => {
            const tab = {
                id: this.state.nextTabId++,
                scrollPosition: 0
            };
            this.applyPassageRangeToTab(tab, range);
            this.state.tabs.push(tab);
        });

        this.state.activeTabId = this.state.tabs[this.state.tabs.length - refs.length].id;
        this.switchTab(this.state.activeTabId, true);
        this.renderTabs();
        this.saveStateToLocalStorage();
        return refs.length;
    },

parsePassageReference(reference) {
        const raw = (reference || '').trim();
        if (!raw) return null;

        const match = this.matchBookFromReference(raw);
        if (!match) return null;

        const startBook = match.book;
        const rest = raw.slice(match.length).trim();
        const refMatch = rest.match(/^(\d+)\s*:?\s*(\d+)(?:\s*-\s*(?:(\d+)\s*:)?\s*(\d+))?$/);
        if (!refMatch) return null;

        const startChapter = parseInt(refMatch[1], 10);
        const startVerse = parseInt(refMatch[2], 10);
        const endChapter = refMatch[3] ? parseInt(refMatch[3], 10) : startChapter;
        const endVerse = refMatch[4] ? parseInt(refMatch[4], 10) : startVerse;
        const testament = this.getTestamentForBook(startBook.name);

        const start = {
            testament,
            bookName: startBook.name,
            chapterNumber: startChapter,
            verseNumber: startVerse
        };
        const end = {
            testament,
            bookName: startBook.name,
            chapterNumber: endChapter,
            verseNumber: endVerse
        };

        if (!this.isValidPassageRef(start) || !this.isValidPassageRef(end)) return null;
        return this.normalizePassageRange(start, end);
    },

matchBookFromReference(reference) {
        const compactReference = reference.toLowerCase().replace(/\s+/g, '');
        const candidates = (DataManager.books || [])
            .flatMap(book => [
                { book, label: book.name },
                { book, label: this.getBookAbbreviation(book.name) }
            ])
            .sort((a, b) => b.label.length - a.label.length);

        for (const candidate of candidates) {
            const compactLabel = candidate.label.toLowerCase().replace(/\s+/g, '');
            if (compactReference.startsWith(compactLabel)) {
                const length = this.getOriginalPrefixLength(reference, compactLabel);
                return { book: candidate.book, length };
            }
        }

        return null;
    },

getOriginalPrefixLength(reference, compactLabel) {
        let consumed = 0;
        for (let i = 0; i < reference.length; i++) {
            if (reference[i] !== ' ') consumed++;
            if (consumed === compactLabel.length) return i + 1;
        }
        return compactLabel.length;
    },

getTestamentForBook(bookName) {
        const index = (DataManager.books || []).findIndex(book => book.name === bookName);
        return index >= 0 && index < 39 ? 'Old Testament' : 'New Testament';
    },

isValidPassageRef(ref) {
        const book = this.findBook(ref.testament, ref.bookName);
        const chapter = book?.chapters.find(ch => ch.number === ref.chapterNumber);
        return !!chapter && chapter.verses.some(verse => verse.number === ref.verseNumber);
    },

createNewTab() {
        // Save current tab state before creating new one
        this.saveCurrentTabState();

        // Check if there's already a home tab (a tab with no book/chapter)
        const existingHomeTab = this.state.tabs.find(t => this.isHomeTab(t));
        if (existingHomeTab) {
            // Reuse existing home tab
            this.state.activeTabId = existingHomeTab.id;
            this.goHome();
            this.renderTabs();
            return;
        }

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

        this.saveStateToLocalStorage(); // Persist

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
        currentTab.verseRangeEnd = this.state.targetVerseRangeEnd || null;
        if (!currentTab.endBookName || currentTab.bookName === currentTab.endBookName && currentTab.chapterNumber === currentTab.endChapterNumber) {
            currentTab.endBookName = currentTab.bookName;
            currentTab.endChapterNumber = currentTab.chapterNumber;
            currentTab.endVerseNumber = currentTab.verseRangeEnd || currentTab.verseNumber;
        }

        // Save scroll position if in verse view
        if (this.state.currentView === 'verseView' && this.els.verseContent) {
            currentTab.scrollPosition = this.els.verseContent.scrollTop;
        }

        // Prevent duplicate home tabs from appearing
        this.dedupeHomeTabs();

        this.saveStateToLocalStorage(); // Persist
    },

switchTab(tabId, restoreHistory = false) {
        if (tabId === this.state.activeTabId && !restoreHistory) return;

        // Save current tab state if we aren't bootstrapping
        if (!restoreHistory) {
            this.saveCurrentTabState();
        }

        // Switch to new tab
        const tab = this.state.tabs.find(t => t.id === tabId);
        if (!tab) return;

        this.state.activeTabId = tabId;

        // Restore tab state
        if (tab.bookName && tab.chapterNumber) {
            // Rebuild physical browser history tree if requested (e.g. app init)
            if (restoreHistory) {
                this.rebuildHistoryStack(tab);
            }

            // Need to restore the full navigation state
            this.state.testament = tab.testament;

            // Find book and chapter from the data
            const books = DataManager.getTestamentBooks(tab.testament);
            const book = books.find(b => b.name === tab.bookName);
            if (book) {
                this.state.book = book;
                const chapter = book.chapters.find(c => c.number === tab.chapterNumber);
                if (chapter) {
                    // Pass skipAutoScroll=true to prevent auto-scroll to verse
                    // Restore verse range highlight if this tab had one
                    const isCrossChapterRange = tab.endBookName && tab.endChapterNumber &&
                        (tab.endBookName !== tab.bookName || tab.endChapterNumber !== tab.chapterNumber);
                    const restoreRange = isCrossChapterRange
                        ? {
                            start: tab.verseNumber || 1,
                            end: chapter.verses[chapter.verses.length - 1].number,
                            range: this.normalizePassageRange(
                                {
                                    testament: tab.testament,
                                    bookName: tab.bookName,
                                    chapterNumber: tab.chapterNumber,
                                    verseNumber: tab.verseNumber || 1
                                },
                                {
                                    testament: tab.testament,
                                    bookName: tab.endBookName,
                                    chapterNumber: tab.endChapterNumber,
                                    verseNumber: tab.endVerseNumber
                                }
                            )
                        }
                        : (tab.verseRangeEnd && tab.verseNumber && tab.verseRangeEnd !== tab.verseNumber)
                            ? { start: tab.verseNumber, end: tab.verseRangeEnd }
                            : null;
                    this.openVerseView(chapter, tab.verseNumber || 1, true, true, restoreRange);

                    // Restore scroll position immediately; tab switches should feel like returning to the same page.
                    if (tab.scrollPosition !== undefined && this.els.verseContent) {
                        setTimeout(() => {
                            this.els.verseContent.scrollTo({
                                top: tab.scrollPosition,
                                behavior: 'auto'
                            });
                        }, 0);
                    }
                }
            }
        } else {
            // Tab is on home
            this.goHome();
        }

        this.renderTabs();
        this.saveStateToLocalStorage(); // Persist
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
                verseNumber: this.state.targetVerseNum || null,
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

        this.dedupeHomeTabs();
        this.els.tabsContainer.innerHTML = '';

        this.state.tabs.forEach(tab => {
            const tabEl = document.createElement('button');
            tabEl.className = 'tab-item' + (tab.id === this.state.activeTabId ? ' active' : '');
            tabEl.textContent = this.getTabLabel(tab);
            tabEl.dataset.tabId = tab.id;

            // Single tap to switch
            tabEl.addEventListener('click', () => this.switchTab(tab.id));

            // Long press to delete
            this.bindTabLongPress(tabEl, tab);

            this.els.tabsContainer.appendChild(tabEl);
        });

        this.updateTabsBarVisibility();
    },

reorderTab(sourceTabId, targetTabId) {
        const sourceIndex = this.state.tabs.findIndex(tab => tab.id === sourceTabId);
        const targetIndex = this.state.tabs.findIndex(tab => tab.id === targetTabId);
        if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return false;

        const [tab] = this.state.tabs.splice(sourceIndex, 1);
        this.state.tabs.splice(targetIndex, 0, tab);
        this.renderTabs();
        this.saveStateToLocalStorage();
        return true;
    },

bindTabLongPress(tabEl, tab) {
        let pressTimer = null;
        let isLongPress = false;
        let isDragging = false;
        let didReorder = false;
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
                    isDragging = true;
                    didReorder = false;
                    tabEl.classList.add('dragging');
                    if (navigator.vibrate) navigator.vibrate(20);
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

            if (isDragging) {
                const target = document.elementFromPoint(currentX, currentY);
                const targetTab = target?.closest('.tab-item');
                if (targetTab && targetTab.dataset.tabId) {
                    const targetTabId = parseInt(targetTab.dataset.tabId, 10);
                    if (targetTabId !== tab.id && this.reorderTab(tab.id, targetTabId)) {
                        didReorder = true;
                    }
                }
                if (e.cancelable) e.preventDefault();
                return;
            }

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
                tabEl.classList.remove('dragging');
                if (!didReorder) {
                    this.showTabOptionsMenu(tab);
                }
            }
            isDragging = false;
            didReorder = false;
        };

        const cancelPress = () => {
            clearTimeout(pressTimer);
            tabEl.classList.remove('dragging');
            hasMoved = false;
            isDragging = false;
            didReorder = false;
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

showTabOptionsMenu(tab) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'tab-options-overlay';
        overlay.innerHTML = `
            <div class="tab-options-popup">
                <p>Tab: ${this.getTabLabel(tab)}</p>
                <div class="tab-options-buttons">
                    <button class="tab-options-action" id="copy-single-tab-btn">Copy Passage Reference</button>
                    <button class="tab-options-danger" id="close-single-tab-btn">Close Tab</button>
                    <button class="tab-options-cancel">Cancel</button>
                </div>
            </div>
        `;

        // Cancel button
        overlay.querySelector('.tab-options-cancel').addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        // Copy button
        overlay.querySelector('#copy-single-tab-btn').addEventListener('click', () => {
            if (!this.isHomeTab(tab)) {
                const textToCopy = this.getTabLabel(tab);
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(textToCopy).catch(err => {
                        console.error('Failed to copy tab text:', err);
                        this.fallbackCopyText(textToCopy);
                    });
                } else {
                    this.fallbackCopyText(textToCopy);
                }
            }
            document.body.removeChild(overlay);
        });

        // Delete (Close) button
        overlay.querySelector('#close-single-tab-btn').addEventListener('click', () => {
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
                        // Pass skipAutoScroll=true to prevent auto-scroll to verse
                        // Restore verse range highlight if this tab had one
                        const isCrossChapterRange = newActiveTab.endBookName && newActiveTab.endChapterNumber &&
                            (newActiveTab.endBookName !== newActiveTab.bookName || newActiveTab.endChapterNumber !== newActiveTab.chapterNumber);
                        const restoreRange = isCrossChapterRange
                            ? {
                                start: newActiveTab.verseNumber || 1,
                                end: chapter.verses[chapter.verses.length - 1].number,
                                range: this.normalizePassageRange(
                                    {
                                        testament: newActiveTab.testament,
                                        bookName: newActiveTab.bookName,
                                        chapterNumber: newActiveTab.chapterNumber,
                                        verseNumber: newActiveTab.verseNumber || 1
                                    },
                                    {
                                        testament: newActiveTab.testament,
                                        bookName: newActiveTab.endBookName,
                                        chapterNumber: newActiveTab.endChapterNumber,
                                        verseNumber: newActiveTab.endVerseNumber
                                    }
                                )
                            }
                            : (newActiveTab.verseRangeEnd && newActiveTab.verseNumber && newActiveTab.verseRangeEnd !== newActiveTab.verseNumber)
                                ? { start: newActiveTab.verseNumber, end: newActiveTab.verseRangeEnd }
                                : null;
                        this.openVerseView(chapter, newActiveTab.verseNumber || 1, true, true, restoreRange);

                        // Restore scroll position immediately; tab switches should feel like returning to the same page.
                        if (newActiveTab.scrollPosition !== undefined && this.els.verseContent) {
                            setTimeout(() => {
                                this.els.verseContent.scrollTo({
                                    top: newActiveTab.scrollPosition,
                                    behavior: 'auto'
                                });
                            }, 0);
                        }
                    }
                }
            } else {
                this.goHome();
            }
        }

        this.renderTabs();
        this.saveStateToLocalStorage(); // Persist
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
