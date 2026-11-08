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
        return !!tab && !tab.bookName && !tab.chapterNumber && !tab.testament;
    },

dedupeHomeTabs() {
        const isEmptyHome = tab => this.isHomeTab(tab) && (!tab.navigationHistory || tab.navigationHistory.length <= 1);
        const homeTabs = this.state.tabs.filter(isEmptyHome);
        if (homeTabs.length <= 1) return;

        const activeTab = this.state.tabs.find(tab => tab.id === this.state.activeTabId);
        const keepHomeTabId = activeTab && this.isHomeTab(activeTab)
            ? activeTab.id
            : homeTabs[0].id;

        this.state.tabs = this.state.tabs.filter(tab => !isEmptyHome(tab) || tab.id === keepHomeTabId);
    },

getTabLabel(tab) {
        if (!tab.bookName || !tab.chapterNumber) {
            return tab.bookName ? this.getBookAbbreviation(tab.bookName) : tab.testament || 'Home';
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
        this.state.tabs = this.state.tabs.filter(tab => !this.isHomeTab(tab) || tab.navigationHistory?.length > 1);

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
        const raw = (reference || '').trim().replace(/[–—]/g, '-');
        if (!raw) return null;

        const match = this.matchBookFromReference(raw);
        if (!match) return null;

        const startBook = match.book;
        const rest = raw.slice(match.length).trim();
        const parts = rest.split(/\s*-\s*/);
        const endBookMatch = parts.length === 2 ? this.matchBookFromReference(parts[1]) : null;
        if (endBookMatch) {
            const first = parts[0].match(/^(\d+)\s*:\s*(\d+)$/);
            const last = parts[1].slice(endBookMatch.length).trim().match(/^(\d+)\s*:\s*(\d+)$/);
            if (!first || !last) return null;
            const start = { testament: this.getTestamentForBook(startBook.name), bookName: startBook.name, chapterNumber: Number(first[1]), verseNumber: Number(first[2]) };
            const end = { testament: this.getTestamentForBook(endBookMatch.book.name), bookName: endBookMatch.book.name, chapterNumber: Number(last[1]), verseNumber: Number(last[2]) };
            if (!this.isValidPassageRef(start) || !this.isValidPassageRef(end)) return null;
            return this.normalizePassageRange(start, end);
        }
        if (/^\d+$/.test(rest)) {
            const chapter = startBook.chapters.find(item => item.number === Number(rest));
            if (!chapter?.verses.length) return null;
            const start = { testament: this.getTestamentForBook(startBook.name), bookName: startBook.name, chapterNumber: chapter.number, verseNumber: chapter.verses[0].number };
            return { start, end: { ...start, verseNumber: chapter.verses[chapter.verses.length - 1].number } };
        }
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
            this.switchTab(existingHomeTab.id);
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

        this.captureNavigationScroll();
        currentTab.view = this.state.currentView;
        currentTab.testament = this.state.testament;
        currentTab.bookName = this.state.book?.name || null;
        currentTab.chapterNumber = this.state.chapter?.number || null;
        currentTab.verseNumber = this.state.targetVerseNum || null;
        currentTab.verseRangeEnd = this.state.targetVerseRangeEnd || null;
        const range = this.state.currentView === 'verseView' ? this.state.currentPassageRange : null;
        currentTab.endBookName = range?.end.bookName || currentTab.bookName;
        currentTab.endChapterNumber = range?.end.chapterNumber || currentTab.chapterNumber;
        currentTab.endVerseNumber = range?.end.verseNumber || currentTab.verseRangeEnd || currentTab.verseNumber;

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
        this.ensureTabNavigation(tab);
        this.restoreTabNavigation(tab);
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
            this.saveCurrentTabState();
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

            // Tap to switch tabs or open the active tab’s options.
            tabEl.addEventListener('click', () => {
                if (tabEl.dataset.suppressClick === 'true') {
                    delete tabEl.dataset.suppressClick;
                    return;
                }
                if (tab.id === this.state.activeTabId) this.showTabOptionsMenu(tab);
                else this.switchTab(tab.id);
            });

            // Long press for options or drag to reorder.
            this.bindTabLongPress(tabEl, tab);

            this.els.tabsContainer.appendChild(tabEl);
        });

        this.ensureTabNavigation();
        this.updateNavigationButtons();
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
            delete tabEl.dataset.suppressClick;
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
            if (hasMoved || isLongPress) tabEl.dataset.suppressClick = 'true';
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
                    <label class="passage-edit-label" for="edit-tab-passage">Passage range</label>
                    <div class="passage-edit-row">
                        <input id="edit-tab-passage" class="passage-tabs-input" placeholder="John 3:16-18" autocomplete="off" aria-describedby="passage-edit-error">
                        <button class="tab-options-action" id="save-tab-passage-btn" disabled>Update</button>
                    </div>
                    <p id="passage-edit-error" class="passage-edit-error" role="alert" hidden></p>
                    <button class="tab-options-action" id="copy-single-tab-btn">Copy Passage Reference</button>
                    <button class="tab-options-danger" id="close-single-tab-btn">Close Tab</button>
                    <button class="tab-options-cancel">Cancel</button>
                </div>
            </div>
        `;

        const input = overlay.querySelector('#edit-tab-passage');
        if (tab.bookName && tab.chapterNumber) {
            const start = { testament: tab.testament, bookName: tab.bookName, chapterNumber: tab.chapterNumber, verseNumber: tab.verseNumber || 1 };
            const end = { ...start, bookName: tab.endBookName || tab.bookName, chapterNumber: tab.endChapterNumber || tab.chapterNumber, verseNumber: tab.endVerseNumber || tab.verseRangeEnd || start.verseNumber };
            input.value = tab.verseNumber ? this.formatCollectionRange({ start, end }) : `${tab.bookName} ${tab.chapterNumber}`;
        }
        const updateButton = overlay.querySelector('#save-tab-passage-btn');
        const error = overlay.querySelector('.passage-edit-error');
        const originalRange = this.parsePassageReference(input.value);
        const validateInput = () => {
            const range = this.parsePassageReference(input.value);
            const unchanged = range && originalRange && this.isSamePassagePoint(range.start, originalRange.start) &&
                this.isSamePassagePoint(range.end, originalRange.end);
            updateButton.disabled = !range || !!unchanged;
            const invalid = !!input.value.trim() && !range;
            input.setAttribute('aria-invalid', String(invalid));
            error.textContent = invalid ? 'Enter a valid passage, such as John 3:16-18.' : '';
            error.hidden = !invalid;
            return updateButton.disabled ? null : range;
        };
        input.addEventListener('input', validateInput);
        validateInput();
        const saveRange = () => {
            const range = validateInput();
            if (!range) return;
            if (tab.id !== this.state.activeTabId) this.switchTab(tab.id);
            this.saveCurrentTabState();
            this.state.testament = range.start.testament;
            this.state.book = this.findBook(range.start.testament, range.start.bookName);
            const chapter = this.state.book.chapters.find(ch => ch.number === range.start.chapterNumber);
            this.openVerseView(chapter, range.start.verseNumber, false, false, {
                start: range.start.verseNumber, end: range.end.verseNumber, range
            });
            this.applyPassageRangeToTab(tab, range);
            this.renderTabs();
            this.saveStateToLocalStorage();
            overlay.remove();
        };
        updateButton.addEventListener('click', saveRange);
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') saveRange();
        });

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

            this.switchTab(newActiveTab.id, true);
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
