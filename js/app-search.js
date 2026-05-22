globalThis.AppSearch = {
openSearch() {
        if (!this.els.searchModal) return;
        if (this.els.searchModal.classList.contains('active')) return;

        // Restore last query/results state instead of resetting every open.
        this.els.searchInput.value = this.state.search.query;
        this.els.searchClearBtn.style.display = this.state.search.query ? 'flex' : 'none';

        if (this.state.search.query.length >= 2) {
            const targetCount = Math.max(this.state.search.renderedCount, this.state.search.batchSize);
            this.renderSearchResults(targetCount);
        } else if (!this.state.search.query) {
            this.els.searchResults.innerHTML = '';
        }

        // Show modal with slide-up animation
        this.els.searchModal.classList.remove('hidden');
        requestAnimationFrame(() => {
            this.els.searchModal.classList.add('active');
        });

        setTimeout(() => {
            this.els.searchInput.focus();

            if (this.state.search.query.length >= 2) {
                this.els.searchResults.scrollTop = this.state.search.scrollTop || 0;
                this.maybeLoadMoreSearchResults(true);
            }
        }, 400);

        // Push state for back-button dismissal
        history.pushState({ view: 'search' }, '', '');

        // Bind events if not already bound
        if (!this.searchEventsBound) {
            // Dismiss button (slides down)
            const dismissBtn = document.getElementById('search-dismiss-btn');
            if (dismissBtn) {
                dismissBtn.addEventListener('click', () => {
                    history.back();
                });
            }

            // Clear button
            if (this.els.searchClearBtn) {
                this.els.searchClearBtn.addEventListener('click', () => {
                    this.els.searchInput.value = '';
                    this.clearSearchState(true);
                    this.els.searchResults.innerHTML = '';
                    this.els.searchClearBtn.style.display = 'none';
                    this.els.searchInput.focus();
                });
            }

            let debounceTimer;
            this.els.searchInput.addEventListener('input', () => {
                const value = this.els.searchInput.value;

                // Show/hide clear button
                this.els.searchClearBtn.style.display = value ? 'flex' : 'none';

                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.performSearch(value);
                }, 300);
            });

            if (this.els.searchResults) {
                this.els.searchResults.addEventListener('click', (e) => {
                    const item = e.target.closest('.search-result-item');
                    if (!item) return;

                    this.openSearchResult(
                        item.dataset.testament,
                        item.dataset.book,
                        parseInt(item.dataset.chapter, 10),
                        parseInt(item.dataset.verse, 10)
                    );
                });

                this.els.searchResults.addEventListener('scroll', () => {
                    this.state.search.scrollTop = this.els.searchResults.scrollTop;
                    this.maybeLoadMoreSearchResults();
                });
            }

            this.searchEventsBound = true;
        }

        // Always bind/rebind swipe to ensure it works
        this.bindSearchSwipe();
    },

bindSearchSwipe() {
        if (!this.els.searchModal) return;

        let startY = 0;
        let currentY = 0;
        let isDragging = false;
        const modal = this.els.searchModal;
        const threshold = 100; // Drag distance to trigger dismissal

        // Handle swipe on the top areas (dismiss area and search header)
        const swipeAreas = [
            document.querySelector('.search-dismiss-container'),
            document.querySelector('.search-header')
        ];

        const handleStart = (e) => {
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            isDragging = true;
            modal.style.transition = 'none'; // Disable transition while dragging
        };

        const handleMove = (e) => {
            if (!isDragging) return;
            currentY = e.touches ? e.touches[0].clientY : e.clientY;
            const deltaY = currentY - startY;

            if (deltaY > 0) {
                // Dragging down
                modal.style.transform = `translateY(${deltaY}px)`;
                // Prevent scrolling when dragging down to dismiss
                if (e.cancelable) e.preventDefault();
            }
        };

        const handleEnd = () => {
            if (!isDragging) return;
            isDragging = false;
            modal.style.transition = ''; // Restore transition

            const deltaY = currentY - startY;
            if (deltaY > threshold) {
                // Trigger dismissal
                history.back();
            } else {
                // Snap back
                modal.style.transform = '';
            }
            startY = 0;
            currentY = 0;
        };

        swipeAreas.forEach(area => {
            if (!area) return;
            // Remove old listeners if any (though searchEventsBound handles most)
            area.removeEventListener('touchstart', area._swipeStart);
            area.removeEventListener('touchmove', area._swipeMove);
            area.removeEventListener('touchend', area._swipeEnd);

            area._swipeStart = handleStart;
            area._swipeMove = handleMove;
            area._swipeEnd = handleEnd;

            area.addEventListener('touchstart', handleStart, { passive: false });
            area.addEventListener('touchmove', handleMove, { passive: false });
            area.addEventListener('touchend', handleEnd);

            // Mouse counterparts for easier dev testing
            area.addEventListener('mousedown', handleStart);
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleEnd);
        });
    },

closeSearch() {
        if (!this.els.searchModal) return;

        if (this.els.searchResults) {
            this.state.search.scrollTop = this.els.searchResults.scrollTop;
        }

        this.els.searchModal.style.transform = ''; // Reset transform in case it was dragged
        this.els.searchModal.classList.remove('active');
        this.els.searchInput.blur();

        // Hide after animation finishes
        setTimeout(() => {
            if (!this.els.searchModal.classList.contains('active')) {
                this.els.searchModal.classList.add('hidden');
            }
        }, 400);
    },

clearSearchState(clearQuery = false) {
        if (clearQuery) {
            this.state.search.query = '';
        }

        this.state.search.matches = [];
        this.state.search.renderedCount = 0;
        this.state.search.scrollTop = 0;
    },

performSearch(query) {
        const trimmedQuery = (query || '').trim();
        this.state.search.query = trimmedQuery;

        if (!trimmedQuery || trimmedQuery.length < 2) {
            this.clearSearchState(false);
            this.state.search.query = trimmedQuery;
            this.els.searchResults.innerHTML = '';
            return;
        }

        const results = [];
        const queryLower = trimmedQuery.toLowerCase();

        for (let bookIndex = 0; bookIndex < DataManager.books.length; bookIndex++) {
            const book = DataManager.books[bookIndex];
            const testament = bookIndex < 39 ? 'Old Testament' : 'New Testament';
            for (const chapter of book.chapters) {
                for (const verse of chapter.verses) {
                    if (verse.text.toLowerCase().includes(queryLower)) {
                        results.push({
                            book: book,
                            chapter: chapter,
                            verse: verse,
                            testament: testament
                        });
                    }
                }
            }
        }

        this.state.search.matches = results;
        this.state.search.renderedCount = 0;
        this.state.search.scrollTop = 0;

        this.renderSearchResults(this.state.search.batchSize);
        this.maybeLoadMoreSearchResults(true);
    },

renderSearchResults(targetCount = this.state.search.batchSize) {
        const query = this.state.search.query;
        const results = this.state.search.matches;

        this.els.searchResults.innerHTML = '';
        this.state.search.renderedCount = 0;

        if (!query || query.length < 2) {
            return;
        }

        if (results.length === 0) {
            this.els.searchResults.innerHTML = `<div class="search-no-results">No results found for "${query}"</div>`;
            return;
        }

        const desiredCount = Math.max(this.state.search.batchSize, targetCount);
        while (
            this.state.search.renderedCount < results.length &&
            this.state.search.renderedCount < desiredCount
        ) {
            this.appendSearchResultsBatch();
        }
    },

appendSearchResultsBatch() {
        const start = this.state.search.renderedCount;
        if (start >= this.state.search.matches.length) {
            this.updateSearchResultsStatus();
            return;
        }

        const end = Math.min(start + this.state.search.batchSize, this.state.search.matches.length);
        const query = this.state.search.query;
        const html = this.state.search.matches
            .slice(start, end)
            .map(result => this.createSearchResultHtml(result, query))
            .join('');

        this.els.searchResults.insertAdjacentHTML('beforeend', html);
        this.state.search.renderedCount = end;
        this.updateSearchResultsStatus();
    },

createSearchResultHtml(result, query) {
        const ref = `${result.book.name} ${result.chapter.number}:${result.verse.number}`;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const highlightedText = result.verse.text.replace(regex, '<mark>$1</mark>');

        return `
            <div class="search-result-item" data-book="${result.book.name}" data-chapter="${result.chapter.number}" data-verse="${result.verse.number}" data-testament="${result.testament}">
                <div class="search-result-ref">${ref}</div>
                <div class="search-result-text">${highlightedText}</div>
            </div>
        `;
    },

updateSearchResultsStatus() {
        if (!this.els.searchResults) return;

        const existingStatus = this.els.searchResults.querySelector('.search-results-status');
        if (!this.state.search.query || this.state.search.matches.length === 0) {
            if (existingStatus) existingStatus.remove();
            return;
        }

        const statusEl = existingStatus || document.createElement('div');
        statusEl.className = 'search-results-status';

        const shown = this.state.search.renderedCount;
        const total = this.state.search.matches.length;
        statusEl.textContent = shown < total
            ? `Showing ${shown} of ${total} results. Scroll to load more.`
            : `Showing all ${total} results.`;

        this.els.searchResults.appendChild(statusEl);
    },

maybeLoadMoreSearchResults(force = false) {
        if (!this.els.searchResults) return;
        if (this.state.search.matches.length === 0) return;

        let guard = 0;
        while (this.state.search.renderedCount < this.state.search.matches.length && guard < 12) {
            const nearBottom = this.els.searchResults.scrollTop + this.els.searchResults.clientHeight >=
                this.els.searchResults.scrollHeight - 240;
            const needsFill = this.els.searchResults.scrollHeight <= this.els.searchResults.clientHeight + 30;

            if (!force && !nearBottom && !needsFill) {
                break;
            }

            this.appendSearchResultsBatch();
            force = false;
            guard++;
        }
    },

openSearchResult(testament, bookName, chapterNumber, verseNumber) {
        if (history.state && history.state.view === 'search') {
            this.closeSearch();
            history.back();
            setTimeout(() => {
                this._navigateToResult(testament, bookName, chapterNumber, verseNumber);
            }, 50);
        } else {
            this.closeSearch();
            this._navigateToResult(testament, bookName, chapterNumber, verseNumber);
        }
    },

_navigateToResult(testament, bookName, chapterNumber, verseNumber) {
        this.saveCurrentTabState();

        const activeTab = this.state.tabs.find(t => t.id === this.state.activeTabId);
        if (this.isHomeTab(activeTab)) {
            activeTab.testament = testament;
            activeTab.bookName = bookName;
            activeTab.chapterNumber = chapterNumber;
            activeTab.verseNumber = verseNumber;
            activeTab.scrollPosition = 0;
        } else {
            const newTab = {
                id: this.state.nextTabId++,
                testament: testament,
                bookName: bookName,
                chapterNumber: chapterNumber,
                verseNumber: verseNumber,
                scrollPosition: 0
            };

            this.state.tabs.push(newTab);
            this.state.activeTabId = newTab.id;
        }

        this.state.testament = testament;
        const books = DataManager.getTestamentBooks(testament);
        const book = books.find(b => b.name === bookName);

        if (book) {
            this.state.book = book;
            const chapter = book.chapters.find(c => c.number === chapterNumber);
            if (chapter) {
                this.openVerseView(chapter, verseNumber, true);
            }
        }

        // Deduplicate home tabs before rendering
        this.dedupeHomeTabs();
        this.renderTabs();
    }
};
