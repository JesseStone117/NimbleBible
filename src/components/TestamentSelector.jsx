import { useState, useRef, useEffect } from 'react';
import { getBooksForTestament, getChaptersForBook, getVersesForChapter } from '../utils/bibleData';
import { hapticFeedback } from '../utils/haptics';
import './TestamentSelector.css';

const LONG_PRESS_DURATION = 500; // ms
const HOVER_ACTIVATION_DURATION = 1000; // ms for cascade

function TestamentSelector({ onPassageSelect }) {
    const [activeTestament, setActiveTestament] = useState(null); // 'old' | 'new' | null
    const [isLongPress, setIsLongPress] = useState(false);
    const [touchPosition, setTouchPosition] = useState(null);
    const [hoveredBook, setHoveredBook] = useState(null);
    const [hoveredChapter, setHoveredChapter] = useState(null);
    const [bookHoverStart, setBookHoverStart] = useState(null);
    const [chapterHoverStart, setChapterHoverStart] = useState(null);
    const [showBooks, setShowBooks] = useState(false);
    const [showChapters, setShowChapters] = useState(false);
    const [selectedBook, setSelectedBook] = useState(null);
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [showVerses, setShowVerses] = useState(false);
    const [hoveredVerse, setHoveredVerse] = useState(null);
    const [verseHoverStart, setVerseHoverStart] = useState(null);
    const [longPressProgress, setLongPressProgress] = useState(0); // 0-100 for progress circle
    const [pressedTestament, setPressedTestament] = useState(null); // Track which button is pressed

    const longPressTimer = useRef(null);
    const progressInterval = useRef(null);
    const hoverTimer = useRef(null);

    // Handle touch start on testament button
    const handleTouchStart = (testament) => (e) => {
        e.preventDefault();
        hapticFeedback('light');

        const touch = e.touches[0];
        setTouchPosition({ x: touch.clientX, y: touch.clientY });
        setActiveTestament(testament);
        setPressedTestament(testament);
        setLongPressProgress(0);

        // Start progress animation
        const startTime = Date.now();
        progressInterval.current = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min((elapsed / LONG_PRESS_DURATION) * 100, 100);
            setLongPressProgress(progress);

            if (progress >= 100) {
                clearInterval(progressInterval.current);
            }
        }, 16); // ~60fps

        // Start long-press timer
        longPressTimer.current = setTimeout(() => {
            setIsLongPress(true);
            setShowBooks(true);
            hapticFeedback('medium');
        }, LONG_PRESS_DURATION);
    };

    // Handle touch move - track position and check what's under finger
    const handleTouchMove = (e) => {
        if (!isLongPress) return;

        e.preventDefault();
        const touch = e.touches[0];
        setTouchPosition({ x: touch.clientX, y: touch.clientY });

        // Check what element is under the touch point
        const element = document.elementFromPoint(touch.clientX, touch.clientY);

        if (element) {
            const bookItem = element.closest('[data-book]');
            const chapterItem = element.closest('[data-chapter]');
            const verseItem = element.closest('[data-verse-num]');

            if (bookItem && !selectedBook) {
                const book = bookItem.dataset.book;
                if (book !== hoveredBook) {
                    setHoveredBook(book);
                    setBookHoverStart(Date.now());
                    hapticFeedback('light');
                } else if (bookHoverStart && Date.now() - bookHoverStart >= HOVER_ACTIVATION_DURATION) {
                    // Activate book after 1 second hover
                    setSelectedBook(book);
                    setShowChapters(true);
                    setBookHoverStart(null);
                    hapticFeedback('medium');
                }
            } else if (chapterItem && selectedBook && !selectedChapter) {
                const chapter = parseInt(chapterItem.dataset.chapter);
                if (chapter !== hoveredChapter) {
                    setHoveredChapter(chapter);
                    setChapterHoverStart(Date.now());
                    hapticFeedback('light');
                } else if (chapterHoverStart && Date.now() - chapterHoverStart >= HOVER_ACTIVATION_DURATION) {
                    // Activate chapter after 1 second hover
                    setSelectedChapter(chapter);
                    setShowVerses(true);
                    setChapterHoverStart(null);
                    hapticFeedback('medium');
                }
            } else if (verseItem && selectedChapter) {
                const verse = parseInt(verseItem.dataset.verseNum);
                if (verse !== hoveredVerse) {
                    setHoveredVerse(verse);
                    setVerseHoverStart(Date.now());
                    hapticFeedback('light');
                } else if (verseHoverStart && Date.now() - verseHoverStart >= HOVER_ACTIVATION_DURATION) {
                    // Mark verse for selection
                    setHoveredVerse(verse);
                    hapticFeedback('heavy');
                }
            }
        }
    };

    // Handle touch end - finalize or cancel
    const handleTouchEnd = (e) => {
        e.preventDefault();

        clearTimeout(longPressTimer.current);
        clearInterval(progressInterval.current);
        setPressedTestament(null);
        setLongPressProgress(0);

        if (!isLongPress) {
            // Simple tap - just show books
            setShowBooks(true);
            hapticFeedback('medium');
        } else if (selectedBook && selectedChapter && hoveredVerse !== null) {
            // Complete selection from gesture with verse
            onPassageSelect(selectedBook, selectedChapter, hoveredVerse);
            hapticFeedback('heavy');
        } else if (selectedBook && hoveredChapter !== null && !selectedChapter) {
            // Complete selection without verse (just go to chapter)
            onPassageSelect(selectedBook, hoveredChapter);
            hapticFeedback('heavy');
        }

        // Reset state after a delay if not completing selection
        if (!selectedBook || hoveredChapter === null) {
            setTimeout(resetState, 300);
        }
    };

    // Simple tap handler
    const handleClick = (testament) => {
        setActiveTestament(testament);
        setShowBooks(true);
        hapticFeedback('medium');
    };

    // Book selection (tap mode)
    const handleBookClick = (book) => {
        setSelectedBook(book);
        setShowChapters(true);
        hapticFeedback('medium');
    };

    // Chapter selection (tap mode)
    const handleChapterClick = (chapter) => {
        setSelectedChapter(chapter);
        setShowVerses(true);
        hapticFeedback('medium');
    };

    // Verse selection (tap mode)
    const handleVerseClick = (verse) => {
        onPassageSelect(selectedBook, selectedChapter, verse);
        hapticFeedback('heavy');
    };

    const resetState = () => {
        setIsLongPress(false);
        setActiveTestament(null);
        setShowBooks(false);
        setShowChapters(false);
        setShowVerses(false);
        setSelectedBook(null);
        setSelectedChapter(null);
        setHoveredBook(null);
        setHoveredChapter(null);
        setHoveredVerse(null);
        setBookHoverStart(null);
        setChapterHoverStart(null);
        setVerseHoverStart(null);
        setTouchPosition(null);
    };

    const books = activeTestament ? getBooksForTestament(activeTestament) : [];
    const chapters = selectedBook ? getChaptersForBook(selectedBook) : [];
    const verses = selectedBook && selectedChapter ? getVersesForChapter(selectedBook, selectedChapter) : [];

    return (
        <div className="testament-selector">
            <div className="testament-header">
                <h1>NimbleBible</h1>
                <p className="subtitle">Select a Testament</p>
            </div>

            <div className="testament-buttons">
                <button
                    className="testament-button old-testament"
                    onTouchStart={handleTouchStart('old')}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onClick={() => handleClick('old')}
                >
                    <span className="testament-label">Old</span>
                    <span className="testament-name">Testament</span>
                    {pressedTestament === 'old' && longPressProgress > 0 && (
                        <svg className="testament-progress-ring" width="80" height="80">
                            <circle
                                className="testament-progress-circle"
                                stroke="#fff"
                                strokeWidth="4"
                                fill="transparent"
                                r="38"
                                cx="40"
                                cy="40"
                                style={{
                                    strokeDasharray: `${2 * Math.PI * 38}`,
                                    strokeDashoffset: `${2 * Math.PI * 38 * (1 - longPressProgress / 100)}`
                                }}
                            />
                        </svg>
                    )}
                </button>

                <button
                    className="testament-button new-testament"
                    onTouchStart={handleTouchStart('new')}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onClick={() => handleClick('new')}
                >
                    <span className="testament-label">New</span>
                    <span className="testament-name">Testament</span>
                    {pressedTestament === 'new' && longPressProgress > 0 && (
                        <svg className="testament-progress-ring" width="80" height="80">
                            <circle
                                className="testament-progress-circle"
                                stroke="#fff"
                                strokeWidth="4"
                                fill="transparent"
                                r="38"
                                cx="40"
                                cy="40"
                                style={{
                                    strokeDasharray: `${2 * Math.PI * 38}`,
                                    strokeDashoffset: `${2 * Math.PI * 38 * (1 - longPressProgress / 100)}`
                                }}
                            />
                        </svg>
                    )}
                </button>
            </div>

            {/* Book List Overlay */}
            {showBooks && (
                <div className="overlay books-overlay">
                    <div className="overlay-header">
                        <button className="back-button" onClick={resetState}>✕</button>
                        <h2>{activeTestament === 'old' ? 'Old Testament' : 'New Testament'}</h2>
                    </div>
                    <div className="book-list">
                        {books.map(book => (
                            <div
                                key={book}
                                data-book={book}
                                className={`book-item ${hoveredBook === book ? 'hovered' : ''} ${selectedBook === book ? 'selected' : ''}`}
                                onClick={() => handleBookClick(book)}
                            >
                                <span className="book-name">{book}</span>
                                {hoveredBook === book && bookHoverStart && (
                                    <div className="hover-progress">
                                        <svg className="progress-ring" width="30" height="30">
                                            <circle
                                                className="progress-ring-circle"
                                                stroke="#00d4ff"
                                                strokeWidth="3"
                                                fill="transparent"
                                                r="12"
                                                cx="15"
                                                cy="15"
                                            />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Chapter List Overlay */}
            {showChapters && selectedBook && (
                <div className="overlay chapters-overlay">
                    <div className="overlay-header">
                        <button className="back-button" onClick={() => { setShowChapters(false); setSelectedBook(null); }}>←</button>
                        <h2>{selectedBook}</h2>
                    </div>
                    <div className="chapter-grid">
                        {chapters.map(chapter => (
                            <div
                                key={chapter}
                                data-chapter={chapter}
                                className={`chapter-item ${hoveredChapter === chapter ? 'hovered' : ''} ${selectedChapter === chapter ? 'selected' : ''}`}
                                onClick={() => handleChapterClick(chapter)}
                            >
                                {chapter}
                                {hoveredChapter === chapter && chapterHoverStart && (
                                    <div className="hover-progress-small"></div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Verse List Overlay */}
            {showVerses && selectedBook && selectedChapter && (
                <div className="overlay verses-overlay">
                    <div className="overlay-header">
                        <button className="back-button" onClick={() => { setShowVerses(false); setSelectedChapter(null); }}>←</button>
                        <h2>{selectedBook} {selectedChapter}</h2>
                    </div>
                    <div className="verse-grid">
                        {verses.map(verseNum => (
                            <div
                                key={verseNum}
                                data-verse-num={verseNum}
                                className={`verse-item ${hoveredVerse === verseNum ? 'hovered' : ''}`}
                                onClick={() => handleVerseClick(verseNum)}
                            >
                                {verseNum}
                                {hoveredVerse === verseNum && verseHoverStart && (
                                    <div className="hover-progress-small"></div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default TestamentSelector;
