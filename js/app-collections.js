globalThis.AppCollections = {
    collectionStorageKey: 'nimbleBibleCollections',
    collectionBookmarkIcon: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',

    collectionElement(tag, className = '', text = '') {
        const element = document.createElement(tag);
        element.className = className;
        element.textContent = text;
        return element;
    },

    initCollections() {
        this.loadCollections();
        document.querySelectorAll('.view .header').forEach(header => {
            if (header.querySelector('.menu-btn')) return;
            const button = this.collectionElement('button', 'menu-btn');
            button.type = 'button';
            button.setAttribute('aria-label', 'Open menu');
            button.setAttribute('aria-controls', 'library-dialog');
            button.setAttribute('aria-expanded', 'false');
            button.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
            button.addEventListener('click', () => this.openLibrary());
            header.prepend(button);
        });

        const library = document.createElement('dialog');
        library.id = 'library-dialog';
        library.className = 'library-dialog';
        library.setAttribute('aria-labelledby', 'library-title');
        library.innerHTML = `
            <div class="library-shell">
                <div class="library-heading"><h2 id="library-title">NimbleBible</h2><button class="panel-close" aria-label="Close menu">×</button></div>
                <nav class="library-nav" aria-label="Main menu">
                    <button data-library-page="collections">Collections</button>
                    <button data-library-page="settings">Settings</button>
                </nav>
                <p class="collection-message" data-collection-message role="alert" hidden></p>
                <div class="library-content"></div>
            </div>`;
        const save = document.createElement('dialog');
        save.id = 'save-collection-dialog';
        save.className = 'save-collection-dialog';
        save.setAttribute('aria-labelledby', 'save-collection-title');
        save.innerHTML = `
            <div class="save-collection-shell">
                <div class="library-heading"><h2 id="save-collection-title">Save to collection</h2><button class="panel-close" aria-label="Cancel saving">×</button></div>
                <p class="collection-message" data-collection-message role="alert" hidden></p>
                <div class="save-collection-content"></div>
            </div>`;
        for (const dialog of [library, save]) {
            dialog.querySelector('.panel-close').addEventListener('click', () => dialog.close());
            dialog.addEventListener('click', event => {
                if (event.target === dialog) dialog.close();
            });
            this.els.app.appendChild(dialog);
        }
        library.addEventListener('close', () => {
            document.querySelectorAll('.menu-btn').forEach(button => button.setAttribute('aria-expanded', 'false'));
        });
        library.querySelectorAll('[data-library-page]').forEach(button => {
            button.addEventListener('click', () => this.renderLibrary(button.dataset.libraryPage));
        });
        this.els.libraryDialog = library;
        this.els.saveCollectionDialog = save;
        const status = this.collectionElement('div', 'collection-status');
        status.id = 'collection-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        this.els.app.appendChild(status);
        this.applyCollectionSettings();
    },

    loadCollections() {
        this.state.collections = [];
        this.state.collectionSettings = { showMarkers: true, textSize: 'standard' };
        try {
            const saved = JSON.parse(localStorage.getItem(this.collectionStorageKey) || 'null');
            if (saved?.version === 1 && Array.isArray(saved.collections)) {
                this.state.collections = saved.collections.filter(collection =>
                    typeof collection?.id === 'string' && typeof collection.name === 'string' &&
                    collection.name.trim() && Array.isArray(collection.passages)
                ).map(collection => ({
                    id: collection.id,
                    name: collection.name.trim().slice(0, 80),
                    passages: collection.passages.filter(passage =>
                        typeof passage?.id === 'string' && this.validCollectionRange(passage)
                    ).map(passage => ({ id: passage.id, ...this.normalizePassageRange(passage.start, passage.end) }))
                }));
                this.state.collectionSettings = {
                    showMarkers: saved.settings?.showMarkers !== false,
                    textSize: ['small', 'standard', 'large'].includes(saved.settings?.textSize) ? saved.settings.textSize : 'standard'
                };
            }
        } catch (error) {
            console.error('Could not load collections:', error);
        }
        this.rebuildCollectionIndex();
    },

    validCollectionRange(range) {
        return !!range?.start && !!range?.end && this.isValidPassageRef(range.start) && this.isValidPassageRef(range.end);
    },

    commitCollections(collections, settings = this.state.collectionSettings) {
        try {
            localStorage.setItem(this.collectionStorageKey, JSON.stringify({ version: 1, collections, settings }));
        } catch (error) {
            this.collectionError('Couldn’t save your changes. Your device storage may be full.');
            return false;
        }
        this.state.collections = collections;
        this.state.collectionSettings = settings;
        this.rebuildCollectionIndex();
        this.applyCollectionSettings();
        return true;
    },

    collectionError(message) {
        const element = document.querySelector('dialog[open] [data-collection-message]');
        if (element) {
            element.textContent = message;
            element.hidden = false;
        } else this.collectionStatus(message);
    },

    collectionStatus(message) {
        const status = document.getElementById('collection-status');
        if (!status) return;
        clearTimeout(this.collectionStatusTimer);
        status.textContent = message;
        status.classList.add('visible');
        this.collectionStatusTimer = setTimeout(() => status.classList.remove('visible'), 3000);
    },

    createCollection(name, range = null) {
        name = name.trim();
        if (!name || name.length > 80) {
            this.collectionError('Enter a collection name between 1 and 80 characters.');
            return null;
        }
        if (this.state.collections.some(collection => collection.name.toLowerCase() === name.toLowerCase())) {
            this.collectionError('A collection with that name already exists.');
            return null;
        }
        if (range && !this.validCollectionRange(range)) return null;
        const collection = { id: crypto.randomUUID(), name, passages: [] };
        if (range) collection.passages.push({ id: crypto.randomUUID(), ...this.normalizePassageRange(range.start, range.end) });
        return this.commitCollections([...this.state.collections, collection]) ? collection : null;
    },

    addPassageToCollection(collectionId, range) {
        const collection = this.state.collections.find(item => item.id === collectionId);
        if (!collection || !this.validCollectionRange(range)) return false;
        const normalized = this.normalizePassageRange(range.start, range.end);
        if (collection.passages.some(passage => this.isSamePassagePoint(passage.start, normalized.start) &&
            this.isSamePassagePoint(passage.end, normalized.end))) return true;
        const passage = { id: crypto.randomUUID(), ...normalized };
        return this.commitCollections(this.state.collections.map(item => item.id === collectionId
            ? { ...item, passages: [...item.passages, passage] } : item));
    },

    collectionVerseKey(ref) {
        return `${ref.bookName}:${ref.chapterNumber}:${ref.verseNumber}`;
    },

    rebuildCollectionIndex() {
        this.collectionVerseIndex = new Map();
        for (const collection of this.state.collections) {
            for (const passage of collection.passages) {
                for (const segment of this.getPassageSegments(passage)) {
                    for (const verse of segment.verses) {
                        const key = this.collectionVerseKey({ bookName: segment.book.name, chapterNumber: segment.chapter.number, verseNumber: verse.number });
                        if (!this.collectionVerseIndex.has(key)) this.collectionVerseIndex.set(key, new Set());
                        this.collectionVerseIndex.get(key).add(collection.id);
                    }
                }
            }
        }
    },

    verseElementRef(element) {
        return {
            testament: element.dataset.testament || this.state.testament,
            bookName: element.dataset.bookName || this.state.book?.name,
            chapterNumber: Number(element.dataset.chapterNumber || this.state.chapter?.number),
            verseNumber: Number(element.dataset.verseNumber)
        };
    },

    getCollectionSaveRange() {
        if (this.state.currentView !== 'verseView' || !this.els.verseContent) return null;
        let verses = Array.from(this.els.verseContent.querySelectorAll('.verse.selected, .verse.range-selected'));
        if (!verses.length) verses = Array.from(this.els.verseContent.querySelectorAll('.verse.passage-selected, .verse.nimble-target, .verse.nimble-target-visited'));
        if (!verses.length) return null;
        return this.normalizePassageRange(this.verseElementRef(verses[0]), this.verseElementRef(verses[verses.length - 1]));
    },

    updateCollectionSaveButton() {
        if (this.els.saveCollectionBtn) this.els.saveCollectionBtn.disabled = !this.getCollectionSaveRange();
    },

    updateVerseCollectionMarker(element) {
        element.querySelector('.verse-collection-marker')?.remove();
        element.classList.remove('has-collection');
        if (this.state.collectionSettings?.showMarkers === false) return;
        const ref = this.verseElementRef(element);
        const ids = this.collectionVerseIndex?.get(this.collectionVerseKey(ref));
        if (!ids?.size) return;
        const names = this.state.collections.filter(collection => ids.has(collection.id)).map(collection => collection.name);
        const marker = this.collectionElement('button', 'verse-collection-marker');
        marker.type = 'button';
        marker.innerHTML = this.collectionBookmarkIcon;
        marker.title = `In ${names.join(', ')}`;
        marker.setAttribute('aria-label', `Saved in ${names.join(', ')}. View collections`);
        for (const type of ['touchstart', 'touchend', 'mousedown', 'mouseup']) {
            marker.addEventListener(type, event => event.stopPropagation());
        }
        marker.addEventListener('click', event => {
            event.stopPropagation();
            this.openLibrary('memberships', ref);
        });
        element.classList.add('has-collection');
        element.appendChild(marker);
    },

    applyCollectionSettings() {
        const settings = this.state.collectionSettings || { showMarkers: true, textSize: 'standard' };
        document.documentElement.style.setProperty('--reading-font-size', { small: '1rem', standard: '1.1rem', large: '1.3rem' }[settings.textSize]);
        this.els.verseContent?.querySelectorAll('.verse').forEach(element => this.updateVerseCollectionMarker(element));
    },

    formatCollectionRange(range) {
        const { start, end } = range;
        const first = `${start.bookName} ${start.chapterNumber}:${start.verseNumber}`;
        if (this.isSamePassagePoint(start, end)) return first;
        const last = start.bookName !== end.bookName ? `${end.bookName} ${end.chapterNumber}:${end.verseNumber}`
            : start.chapterNumber !== end.chapterNumber ? `${end.chapterNumber}:${end.verseNumber}` : end.verseNumber;
        return `${first}–${last}`;
    },

    openLibrary(page = 'collections', context = null) {
        this.renderLibrary(page, context);
        if (!this.els.libraryDialog.open) this.els.libraryDialog.showModal();
        document.querySelectorAll('.menu-btn').forEach(button => button.setAttribute('aria-expanded', 'true'));
    },

    collectionCreateForm(onCreate, saveRange = null) {
        const form = this.collectionElement('form', 'collection-create-form');
        const label = this.collectionElement('label', '', 'New collection');
        const input = this.collectionElement('input');
        input.name = 'collectionName';
        input.required = true;
        input.maxLength = 80;
        input.placeholder = 'e.g. Encouragement';
        input.autocomplete = 'off';
        label.appendChild(input);
        const button = this.collectionElement('button', 'collection-primary', saveRange ? 'Create & save' : 'Create');
        button.type = 'submit';
        form.append(label, button);
        form.addEventListener('submit', event => {
            event.preventDefault();
            const collection = this.createCollection(input.value, saveRange);
            if (collection) onCreate(collection);
        });
        return form;
    },

    renderLibrary(page, context = null) {
        const dialog = this.els.libraryDialog;
        dialog.querySelector('[data-collection-message]').hidden = true;
        dialog.querySelectorAll('[data-library-page]').forEach(button => {
            button.setAttribute('aria-current', button.dataset.libraryPage === (page === 'settings' ? 'settings' : 'collections') ? 'page' : 'false');
        });
        const content = dialog.querySelector('.library-content');
        content.replaceChildren();
        if (page === 'settings') {
            content.appendChild(this.collectionElement('h3', '', 'Settings'));
            const toggle = this.collectionElement('label', 'collection-setting');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = this.state.collectionSettings.showMarkers;
            toggle.append(this.collectionElement('span', '', 'Show collection markers beside verses'), checkbox);
            checkbox.addEventListener('change', () => {
                if (!this.commitCollections(this.state.collections, { ...this.state.collectionSettings, showMarkers: checkbox.checked })) {
                    checkbox.checked = this.state.collectionSettings.showMarkers;
                }
            });
            const sizeLabel = this.collectionElement('label', 'collection-setting', 'Reading text size');
            const select = document.createElement('select');
            for (const [value, name] of [['small', 'Small'], ['standard', 'Standard'], ['large', 'Large']]) {
                const option = this.collectionElement('option', '', name);
                option.value = value;
                select.appendChild(option);
            }
            select.value = this.state.collectionSettings.textSize;
            select.addEventListener('change', () => {
                if (!this.commitCollections(this.state.collections, { ...this.state.collectionSettings, textSize: select.value })) {
                    select.value = this.state.collectionSettings.textSize;
                }
            });
            sizeLabel.appendChild(select);
            content.append(toggle, sizeLabel, this.collectionElement('p', 'collection-muted', 'Collections and preferences are saved on this device.'));
            return;
        }
        if (page === 'detail') {
            const collection = this.state.collections.find(item => item.id === context);
            if (!collection) return this.renderLibrary('collections');
            const back = this.collectionElement('button', 'collection-text-button', '← All collections');
            back.addEventListener('click', () => this.renderLibrary('collections'));
            content.append(back, this.collectionElement('h3', 'collection-name', collection.name));
            const openAll = this.collectionElement('button', 'collection-secondary', 'Open all passages as tabs');
            openAll.disabled = collection.passages.length === 0;
            openAll.addEventListener('click', () => this.openAllCollectionPassages(collection.id));
            content.appendChild(openAll);
            if (!collection.passages.length) content.appendChild(this.collectionElement('p', 'collection-muted', 'No passages yet. Highlight verses, then use Save to collection in the verse toolbar.'));
            for (const passage of collection.passages) {
                const card = this.collectionElement('div', 'collection-passage');
                const open = this.collectionElement('button', 'collection-passage-open');
                open.appendChild(this.collectionElement('strong', '', this.formatCollectionRange(passage)));
                const preview = this.getPassageSegments(passage).flatMap(segment => segment.verses.map(verse => verse.text)).join(' ');
                open.appendChild(this.collectionElement('span', 'collection-preview', preview.slice(0, 180) + (preview.length > 180 ? '…' : '')));
                open.addEventListener('click', () => this.openCollectedPassage(passage));
                const remove = this.collectionElement('button', 'collection-text-button', 'Remove');
                remove.setAttribute('aria-label', `Remove ${this.formatCollectionRange(passage)} from ${collection.name}`);
                remove.addEventListener('click', () => {
                    if (this.commitCollections(this.state.collections.map(item => item.id === collection.id
                        ? { ...item, passages: item.passages.filter(saved => saved.id !== passage.id) } : item))) {
                        this.renderLibrary('detail', collection.id);
                    }
                });
                card.append(open, remove);
                content.appendChild(card);
            }
            const removeCollection = this.collectionElement('button', 'collection-text-button collection-delete', 'Delete collection');
            removeCollection.addEventListener('click', () => {
                if (!removeCollection.dataset.confirmed) {
                    removeCollection.dataset.confirmed = 'true';
                    removeCollection.textContent = 'Confirm delete collection';
                    return;
                }
                if (this.commitCollections(this.state.collections.filter(item => item.id !== collection.id))) this.renderLibrary('collections');
            });
            content.appendChild(removeCollection);
            return;
        }
        content.appendChild(this.collectionElement('h3', '', page === 'memberships' ? 'Saved in collections' : 'Collections'));
        if (page === 'memberships') content.appendChild(this.collectionElement('p', 'collection-muted', this.formatCollectionRange({ start: context, end: context })));
        else {
            content.appendChild(this.collectionCreateForm(collection => this.renderLibrary('detail', collection.id)));
            if (this.getCollectionSaveRange()) {
                const save = this.collectionElement('button', 'collection-secondary', 'Save highlighted verses');
                save.addEventListener('click', () => this.openSaveCollection());
                content.appendChild(save);
            }
        }
        const memberships = page === 'memberships' ? this.collectionVerseIndex.get(this.collectionVerseKey(context)) : null;
        const collections = this.state.collections.filter(collection => !memberships || memberships.has(collection.id));
        if (!collections.length) content.appendChild(this.collectionElement('p', 'collection-muted', 'Create your first collection to keep meaningful passages together.'));
        for (const collection of collections) {
            const button = this.collectionElement('button', 'collection-row');
            button.innerHTML = this.collectionBookmarkIcon;
            const text = this.collectionElement('span');
            text.append(this.collectionElement('strong', '', collection.name), this.collectionElement('small', 'collection-muted', `${collection.passages.length} saved ${collection.passages.length === 1 ? 'passage' : 'passages'}`));
            button.append(text, this.collectionElement('span', 'collection-chevron', '›'));
            button.addEventListener('click', () => this.renderLibrary('detail', collection.id));
            content.appendChild(button);
        }
    },

    openSaveCollection() {
        const range = this.getCollectionSaveRange();
        if (!range) return;
        this.els.libraryDialog?.close();
        const dialog = this.els.saveCollectionDialog;
        dialog.querySelector('[data-collection-message]').hidden = true;
        const content = dialog.querySelector('.save-collection-content');
        content.replaceChildren(this.collectionElement('p', 'collection-range-label', this.formatCollectionRange(range)));
        if (!this.state.collections.length) content.appendChild(this.collectionElement('p', 'collection-muted', 'Create a collection for these verses.'));
        const finish = collection => {
            dialog.close();
            this.collectionStatus(`Saved to ${collection.name}`);
        };
        for (const collection of this.state.collections) {
            const button = this.collectionElement('button', 'collection-row', collection.name);
            button.addEventListener('click', () => {
                if (this.addPassageToCollection(collection.id, range)) finish(collection);
            });
            content.appendChild(button);
        }
        content.appendChild(this.collectionCreateForm(finish, range));
        if (!dialog.open) dialog.showModal();
    },

    openCollectedPassage(passage) {
        const book = this.findBook(passage.start.testament, passage.start.bookName);
        const chapter = book?.chapters.find(item => item.number === passage.start.chapterNumber);
        if (!chapter) return;
        this.els.libraryDialog.close();
        this.createNewTab();
        this.state.testament = passage.start.testament;
        this.state.book = book;
        this.openVerseView(chapter, passage.start.verseNumber, false, false, {
            start: passage.start.verseNumber,
            end: passage.end.verseNumber,
            range: passage
        });
        const tab = this.state.tabs.find(item => item.id === this.state.activeTabId);
        this.applyPassageRangeToTab(tab, passage);
        this.renderTabs();
        this.saveStateToLocalStorage();
        return tab.id;
    },

    openAllCollectionPassages(collectionId) {
        const collection = this.state.collections.find(item => item.id === collectionId);
        if (!collection) return 0;
        const tabIds = collection.passages.map(passage => this.openCollectedPassage(passage)).filter(id => id != null);
        if (tabIds.length) this.switchTab(tabIds[0]);
        return tabIds.length;
    }
};
