import { useState, useEffect } from 'react';
import { getChapterText } from '../utils/bibleData';
import './VerseReader.css';

function VerseReader({ book, chapter, onBack }) {
    const [verses, setVerses] = useState([]);
    const [fontSize, setFontSize] = useState(18);

    useEffect(() => {
        const chapterText = getChapterText(book, chapter);
        setVerses(chapterText);
    }, [book, chapter]);

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
                    <p key={verse} className="verse">
                        <span className="verse-number">{verse}</span>
                        <span className="verse-text">{text}</span>
                    </p>
                ))}
            </div>
        </div>
    );
}

export default VerseReader;
