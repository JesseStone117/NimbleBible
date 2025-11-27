import { useState, useRef, useEffect } from 'react';
import { getBooksForTestament, getChaptersForBook } from '../utils/bibleData';
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

    const longPressTimer = useRef(null);
    const hoverTimer = useRef(null);

    // Handle touch start on testament button
    const handleTouchStart = (testament) => (e) => {
        e.preventDefault();
        hapticFeedback('light');

        const touch = e.touches[0];
        setTouchPosition({ x: touch.clientX, y: touch.clientY });
        setActiveTestament(testament);

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
            } else if (chapterItem && selectedBook) {
                const chapter = parseInt(chapterItem.dataset.chapter);
                if (chapter !== hoveredChapter) {
                    setHoveredChapter(chapter);
                    setChapterHoverStart(Date.now());
                    hapticFeedback('light');
                } else if (chapterHoverStart && Date.now() - chapterHoverStart >= HOVER_ACTIVATION_DURATION) {
                    // Finalize selection
                    setHoveredChapter(chapter);
                    hapticFeedback('heavy');
                }
            }
        }
    };

    // Handle touch end - finalize or cancel
    const handleTouchEnd = (e) => {
        e.preventDefault();

        clearTimeout(longPressTimer.current);

        if (!isLongPress) {
            // Simple tap - just show books
            setShowBooks(true);
            hapticFeedback('medium');
        } else if (selectedBook && hoveredChapter !== null) {
            // Complete selection from gesture
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
        onPassageSelect(selectedBook, chapter);
        hapticFeedback('heavy');
    };

    const resetState = () => {
        setIsLongPress(false);
        setActiveTestament(null);
        setShowBooks(false);
        setShowChapters(false);
        setSelectedBook(null);
        setHoveredBook(null);
        setHoveredChapter(null);
        setBookHoverStart(null);
        setChapterHoverStart(null);
        setTouchPosition(null);
    };

    const books = activeTestament ? getBooksForTestament(activeTestament) : [];
    const chapters = selectedBook ? getChaptersForBook(selectedBook) : [];

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
                                className={`chapter-item ${hoveredChapter === chapter ? 'hovered' : ''}`}
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
        </div>
    );
}

export default TestamentSelector;
