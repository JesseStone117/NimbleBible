globalThis.AppVerseSelection = {
bindVerseSelection(verseEl, verse) {
        let pressTimer;
        let isLongPress = false;
        let startX = 0;
        let startY = 0;
        let hasMoved = false;
        let isRangeDragActive = false;
        let rangeAnchorVerse = null;
        let lastDraggedVerse = null;
        let hasDraggedRange = false;
        let mouseTracking = false;

        const getPoint = (e) => {
            if (e.touches && e.touches.length > 0) {
                return { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
            if (e.changedTouches && e.changedTouches.length > 0) {
                return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
            }
            if (e.clientX !== undefined && e.clientY !== undefined) {
                return { x: e.clientX, y: e.clientY };
            }
            return null;
        };

        const handleStart = (e) => {
            hasMoved = false;
            isLongPress = false;
            isRangeDragActive = false;
            rangeAnchorVerse = null;
            lastDraggedVerse = null;
            hasDraggedRange = false;

            const point = getPoint(e);
            if (point) {
                startX = point.x;
                startY = point.y;
            }

            if (e.type === 'mousedown') {
                startMouseTracking();
            }

            pressTimer = setTimeout(() => {
                if (hasMoved) return;

                const anchorVerse = this.handleVerseLongPress(verseEl);
                if (anchorVerse !== null) {
                    isLongPress = true;
                    isRangeDragActive = true;
                    rangeAnchorVerse = anchorVerse;
                    lastDraggedVerse = anchorVerse;
                    hasDraggedRange = false;
                }
            }, 450);
        };

        const handleMove = (e) => {
            const point = getPoint(e);
            if (!point) return;

            if (isRangeDragActive && rangeAnchorVerse !== null) {
                const hoveredVerseNum = this.updateVerseRangeDragFromPoint(rangeAnchorVerse, point);
                if (hoveredVerseNum !== null && hoveredVerseNum !== lastDraggedVerse) {
                    lastDraggedVerse = hoveredVerseNum;
                }
                const selection = this.state.verseSelection;
                if (hoveredVerseNum !== null &&
                    (hoveredVerseNum !== rangeAnchorVerse || selection.rangeStartId !== selection.rangeEndId)) {
                    hasDraggedRange = true;
                }
                this.updateVerseRangeEdgeScroll(rangeAnchorVerse, point);

                if (e.cancelable) {
                    e.preventDefault();
                }
                return;
            }

            const deltaX = Math.abs(point.x - startX);
            const deltaY = Math.abs(point.y - startY);

            // If moved more than 10px before long press, treat as scroll intent.
            if (deltaX > 10 || deltaY > 10) {
                hasMoved = true;
                clearTimeout(pressTimer);
            }
        };

        const handleEnd = (e) => {
            clearTimeout(pressTimer);

            // Ignore if in navigation cooldown (prevents accidental selection when switching views)
            if (this.state.navigationCooldown) {
                stopMouseTracking();
                hasMoved = false;
                isLongPress = false;
                isRangeDragActive = false;
                rangeAnchorVerse = null;
                lastDraggedVerse = null;
                hasDraggedRange = false;
                return;
            }

            if (isRangeDragActive) {
                if (e.cancelable) {
                    e.preventDefault();
                }
                e.stopPropagation();
                this.stopVerseRangeEdgeScroll();

                const selection = this.state.verseSelection;
                const selectedOnlyAnchor = selection.rangeStartId === selection.rangeEndId;

                if ((!hasDraggedRange || selectedOnlyAnchor) && rangeAnchorVerse !== null) {
                    const anchorEl = document.getElementById(selection.rangeAnchorId || `verse-${rangeAnchorVerse}`);
                    this.clearVerseSelection();
                    if (anchorEl) {
                        this.state.verseSelection.singleSelected = rangeAnchorVerse;
                        this.state.verseSelection.singleSelectedId = anchorEl.id;
                        anchorEl.classList.add('selected');
                        this.showToolbar();
                    }
                }

                stopMouseTracking();
                hasMoved = false;
                isLongPress = false;
                isRangeDragActive = false;
                rangeAnchorVerse = null;
                lastDraggedVerse = null;
                hasDraggedRange = false;
                return;
            }

            // Only handle single tap if there was no movement and no long press occurred.
            if (!hasMoved && !isLongPress) {
                if (e.cancelable) {
                    e.preventDefault();
                }
                e.stopPropagation();
                this.handleVerseSingleTap(verseEl, verse);
            }

            // Reset flags for next interaction
            stopMouseTracking();
            isLongPress = false;
            hasMoved = false;
            isRangeDragActive = false;
            rangeAnchorVerse = null;
            lastDraggedVerse = null;
            hasDraggedRange = false;
        };

        const handleCancel = () => {
            clearTimeout(pressTimer);
            this.stopVerseRangeEdgeScroll();
            stopMouseTracking();
            hasMoved = false;
            isLongPress = false;
            isRangeDragActive = false;
            rangeAnchorVerse = null;
            lastDraggedVerse = null;
            hasDraggedRange = false;
        };

        const startMouseTracking = () => {
            if (mouseTracking) return;
            mouseTracking = true;
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleEnd);
        };

        const stopMouseTracking = () => {
            if (!mouseTracking) return;
            mouseTracking = false;
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleEnd);
        };

        // Touch events
        verseEl.addEventListener('touchstart', handleStart, { passive: true });
        verseEl.addEventListener('touchmove', handleMove, { passive: false });
        verseEl.addEventListener('touchend', handleEnd, { passive: false });
        verseEl.addEventListener('touchcancel', handleCancel, { passive: true });

        // Mouse events (for desktop/testing)
        verseEl.addEventListener('mousedown', handleStart);

        // Prevent context menu
        verseEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Prevent text selection via CSS and JS
        verseEl.addEventListener('selectstart', (e) => {
            e.preventDefault();
        });
    },

getVerseElementFromPoint(x, y) {
        const target = document.elementFromPoint(x, y);
        return target ? target.closest('.verse') : null;
    },

getClosestVerseElementForPoint(x, y) {
        const directHit = this.getVerseElementFromPoint(x, y);
        if (directHit) return directHit;

        const verses = Array.from(document.querySelectorAll('#verse-content .verse'));
        if (verses.length === 0) return null;

        let closest = null;
        let closestDistance = Infinity;
        verses.forEach((el) => {
            const rect = el.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            const horizontallyNear = x >= rect.left - 40 && x <= rect.right + 40;
            if (!horizontallyNear) return;

            const distance = Math.abs(centerY - y);
            if (distance < closestDistance) {
                closest = el;
                closestDistance = distance;
            }
        });

        return closest;
    },

updateVerseRangeDragFromPoint(anchorVerse, point) {
        const hoveredVerseEl = this.getClosestVerseElementForPoint(point.x, point.y);
        if (!hoveredVerseEl) return null;

        const hoveredVerseNum = parseInt(hoveredVerseEl.dataset.verseNumber, 10);
        if (Number.isNaN(hoveredVerseNum)) return null;

        const anchorEl = document.getElementById(this.state.verseSelection.rangeAnchorId || `verse-${anchorVerse}`);
        this.setVerseRangeSelection(anchorVerse, hoveredVerseNum, anchorEl, hoveredVerseEl);
        return hoveredVerseNum;
    },

updateVerseRangeEdgeScroll(anchorVerse, point) {
        const container = this.els.verseContent;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const scrollThreshold = 90;
        let direction = 0;

        if (point.y > rect.bottom - scrollThreshold) {
            const depth = (point.y - (rect.bottom - scrollThreshold)) / scrollThreshold;
            direction = Math.min(1, depth);
        } else if (point.y < rect.top + scrollThreshold) {
            const depth = ((rect.top + scrollThreshold) - point.y) / scrollThreshold;
            direction = -Math.min(1, depth);
        }

        this.state.verseRangeDrag.anchorVerse = anchorVerse;
        this.state.verseRangeDrag.lastPoint = point;
        this.state.verseRangeDrag.scrollDirection = direction;

        if (direction !== 0 && !this.state.verseRangeDrag.animationId) {
            this.startVerseRangeEdgeScroll();
        } else if (direction === 0) {
            this.stopVerseRangeEdgeScroll(false);
        }
    },

startVerseRangeEdgeScroll() {
        const scroll = () => {
            const dragState = this.state.verseRangeDrag;
            const container = this.els.verseContent;

            if (!container || dragState.scrollDirection === 0 || !dragState.lastPoint || dragState.anchorVerse === null) {
                dragState.animationId = null;
                return;
            }

            const baseSpeed = 12;
            const previousScrollTop = container.scrollTop;
            const speed = baseSpeed * Math.abs(dragState.scrollDirection);
            container.scrollTop += speed * Math.sign(dragState.scrollDirection);

            if (container.scrollTop !== previousScrollTop) {
                this.updateVerseRangeDragFromPoint(dragState.anchorVerse, dragState.lastPoint);
            }

            dragState.animationId = requestAnimationFrame(scroll);
        };

        this.state.verseRangeDrag.animationId = requestAnimationFrame(scroll);
    },

stopVerseRangeEdgeScroll(resetPoint = true) {
        const dragState = this.state.verseRangeDrag;
        dragState.scrollDirection = 0;

        if (dragState.animationId) {
            cancelAnimationFrame(dragState.animationId);
            dragState.animationId = null;
        }

        if (resetPoint) {
            dragState.anchorVerse = null;
            dragState.lastPoint = null;
        }
    },

setVerseRangeSelection(anchorVerse, endVerse, anchorEl = null, endEl = null) {
        if (anchorVerse === null || endVerse === null) return;

        this.state.verseSelection.singleSelected = null;
        this.state.verseSelection.singleSelectedId = null;
        this.state.verseSelection.rangeStart = Math.min(anchorVerse, endVerse);
        this.state.verseSelection.rangeEnd = Math.max(anchorVerse, endVerse);
        anchorEl = anchorEl || document.getElementById(`verse-${anchorVerse}`);
        endEl = endEl || document.getElementById(`verse-${endVerse}`);
        const verses = Array.from(this.els.verseContent.querySelectorAll('.verse'));
        const forward = verses.indexOf(anchorEl) <= verses.indexOf(endEl);
        this.state.verseSelection.rangeAnchorId = anchorEl?.id || null;
        this.state.verseSelection.rangeStartId = (forward ? anchorEl : endEl)?.id || null;
        this.state.verseSelection.rangeEndId = (forward ? endEl : anchorEl)?.id || null;
        this.updateVerseRangeSelection();
        this.showToolbar();
    },

handleVerseSingleTap(verseEl, verse) {
        const verseNum = parseInt(verseEl.dataset.verseNumber);

        // If we have a range selection, clear it first
        if (this.state.verseSelection.rangeStart !== null || this.state.verseSelection.rangeEnd !== null) {
            this.clearVerseSelection();
        }

        // If this verse is already selected, deselect it
        const selectedId = this.state.verseSelection.singleSelectedId;
        if (selectedId ? selectedId === verseEl.id : this.state.verseSelection.singleSelected === verseNum) {
            this.state.verseSelection.singleSelected = null;
            this.state.verseSelection.singleSelectedId = null;
            verseEl.classList.remove('selected');
            this.hideToolbar();
        } else {
            // Deselect previous single selection
            if (this.state.verseSelection.singleSelected !== null) {
                const prevEl = document.getElementById(selectedId || `verse-${this.state.verseSelection.singleSelected}`);
                if (prevEl) prevEl.classList.remove('selected');
            }

            // Select this verse
            this.state.verseSelection.singleSelected = verseNum;
            this.state.verseSelection.singleSelectedId = verseEl.id;
            verseEl.classList.add('selected');
            this.showToolbar();
        }
    },

handleVerseLongPress(verseEl) {
        const verseNum = parseInt(verseEl.dataset.verseNumber, 10);
        if (Number.isNaN(verseNum)) {
            return null;
        }

        this.setVerseRangeSelection(verseNum, verseNum, verseEl, verseEl);
        return verseNum;
    },

updateVerseRangeSelection() {
        // Clear all selections first
        document.querySelectorAll('.verse').forEach(el => {
            el.classList.remove('selected', 'range-selected', 'range-start', 'range-middle', 'range-end');
        });

        const start = this.state.verseSelection.rangeStart;
        const end = this.state.verseSelection.rangeEnd;

        // Verse numbers repeat across chapters; use the rendered verse identities
        // to select the exact passage the user is touching.
        const { rangeStartId, rangeEndId } = this.state.verseSelection;
        if (rangeStartId && rangeEndId) {
            const verses = Array.from(this.els.verseContent.querySelectorAll('.verse'));
            const first = verses.findIndex(el => el.id === rangeStartId);
            const last = verses.findIndex(el => el.id === rangeEndId);
            if (first < 0 || last < 0) return;
            verses.slice(first, last + 1).forEach((el, index) => {
                el.classList.add('range-selected');
                if (index === 0) el.classList.add('range-start');
                if (index === last - first) el.classList.add('range-end');
                if (index > 0 && index < last - first) el.classList.add('range-middle');
            });
            return;
        }

        if (start !== null && end !== null) {
            for (let i = start; i <= end; i++) {
                const el = document.getElementById(`verse-${i}`);
                if (el) {
                    el.classList.add('range-selected');
                    if (start === end) {
                        el.classList.add('range-start', 'range-end');
                    } else if (i === start) {
                        el.classList.add('range-start');
                    } else if (i === end) {
                        el.classList.add('range-end');
                    } else {
                        el.classList.add('range-middle');
                    }
                }
            }
        }
    },

clearVerseSelection() {
        document.querySelectorAll('.verse').forEach(el => {
            el.classList.remove('selected', 'range-selected', 'range-start', 'range-middle', 'range-end');
        });
        this.state.verseSelection = {
            singleSelected: null,
            rangeStart: null,
            rangeEnd: null
        };
        this.hideToolbar();
    },

showToolbar() {
        // Update copy button state when showing toolbar context
        this.updateCopyButtonState();
        if (this.hasVerseSelection()) {
            this.setToolbarExpanded(true, false);
        }
    },

hideToolbar() {
        // Update copy button state (will disable it)
        this.updateCopyButtonState();
        if (!this.hasVerseSelection() && !this.state.toolbarPinnedByUser) {
            this.setToolbarExpanded(false, false);
        }
    },

copySelectedVerses() {
        const selection = this.state.verseSelection;
        let textToCopy = '';

        if (selection.singleSelectedId || selection.rangeStartId) {
            const startEl = document.getElementById(selection.singleSelectedId || selection.rangeStartId);
            const endEl = document.getElementById(selection.singleSelectedId || selection.rangeEndId);
            if (!startEl || !endEl) return;
            const getRef = el => ({
                testament: this.state.testament,
                bookName: el.dataset.bookName || this.state.book.name,
                chapterNumber: Number(el.dataset.chapterNumber || this.state.chapter.number),
                verseNumber: Number(el.dataset.verseNumber)
            });
            const range = this.normalizePassageRange(getRef(startEl), getRef(endEl));
            textToCopy = this.getPassageSegments(range).map(({ book, chapter, verses }) => {
                const start = verses[0].number;
                const end = verses[verses.length - 1].number;
                const verseRange = start === end ? `${start}` : `${start}-${end}`;
                const text = verses.length === 1 ? verses[0].text : verses.map(verse => `${verse.number} ${verse.text}`).join(' ');
                return `${book.name} ${chapter.number}:${verseRange} ${text}`;
            }).join('\n');
        } else if (selection.singleSelected !== null) {
            const verse = this.state.chapter.verses.find(v => v.number === selection.singleSelected);
            if (verse) {
                textToCopy = `${this.state.book.name} ${this.state.chapter.number}:${verse.number} ${verse.text}`;
            }
        } else if (selection.rangeStart !== null && selection.rangeEnd !== null) {
            const verses = this.state.chapter.verses.filter(v =>
                v.number >= selection.rangeStart && v.number <= selection.rangeEnd
            );
            if (verses.length > 0) {
                const verseTexts = verses.map(v => `${v.number} ${v.text}`).join(' ');
                textToCopy = `${this.state.book.name} ${this.state.chapter.number}:${verses[0].number}-${verses[verses.length - 1].number} ${verseTexts}`;
            }
        }

        if (textToCopy) {
            // Copy to clipboard
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(textToCopy).catch(err => {
                    console.error('Failed to copy text:', err);
                    this.fallbackCopyText(textToCopy);
                });
            } else {
                this.fallbackCopyText(textToCopy);
            }
        }
    },

fallbackCopyText(textToCopy) {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('Fallback copy failed:', err);
        }
        document.body.removeChild(textArea);
    }
};
