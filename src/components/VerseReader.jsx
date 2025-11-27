import { useState, useEffect } from 'react';
import { getChapterText } from '../utils/bibleData';
import './VerseReader.css';

function VerseReader({ book, chapter, verse, onBack }) {
    const [verses, setVerses] = useState([]);
    const [fontSize, setFontSize] = useState(18);

    useEffect(() => {
        const chapterText = getChapterText(book, chapter);
        setVerses(chapterText);
    }, [book, chapter]);

    // Auto-scroll to specific verse if provided
    useEffect(() => {
        if (verse && verses.length > 0) {
            // Give a brief delay for rendering
            setTimeout(() => {
                const verseElement = document.querySelector(`[data-verse="${verse}"]`);
                if (verseElement) {
                    verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Add a temporary highlight
                    verseElement.classList.add('verse-highlight');
                    setTimeout(() => {
                        verseElement.classList.remove('verse-highlight');
                    }, 2000);
                }
            }, 100);
        }
    }, [verse, verses]);

    const increaseFontSize = () => {
        setFontSize(prev => Math.min(prev + 2, 28));
    };

    const decreaseFontSize = () => {
        setFontSize(prev => Math.max(prev - 2, 14));
    };

    return (
        <div className="verse-reader">
            <div className="reader-header">
                <button className="back-button" onClick={onBack}>←</button>
                <div className="passage-title">
                    <h2>{book} {chapter}</h2>
                </div>
                <div className="font-controls">
                    <button onClick={decreaseFontSize} className="font-button">A-</button>
                    <button onClick={increaseFontSize} className="font-button">A+</button>
                </div>
            </div>

            <div className="verse-content" style={{ fontSize: `${fontSize}px` }}>
                {verses.map(({ verse, text }) => (
                    <p key={verse} className="verse" data-verse={verse}>
                        <span className="verse-number">{verse}</span>
                        <span className="verse-text">{text}</span>
                    </p>
                ))}
            </div>
        </div>
    );
}

export default VerseReader;
