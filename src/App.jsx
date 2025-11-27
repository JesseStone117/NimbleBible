import { useState, useEffect } from 'react';
import { loadBibleData } from './utils/bibleData';
import TestamentSelector from './components/TestamentSelector';
import VerseReader from './components/VerseReader';
import './App.css';

function App() {
    const [bibleLoaded, setBibleLoaded] = useState(false);
    const [currentView, setCurrentView] = useState('testament'); // 'testament' | 'reader'
    const [selectedPassage, setSelectedPassage] = useState(null); // {book, chapter, verse}

    useEffect(() => {
        loadBibleData()
            .then(() => setBibleLoaded(true))
            .catch(err => console.error('Failed to load Bible:', err));
    }, []);

    const handlePassageSelect = (book, chapter, verse = null) => {
        setSelectedPassage({ book, chapter, verse });
        setCurrentView('reader');
    };

    const handleBackToSelection = () => {
        setCurrentView('testament');
        setSelectedPassage(null);
    };

    if (!bibleLoaded) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner"></div>
                <p>Loading Scripture...</p>
            </div>
        );
    }

    return (
        <div className="app">
            {currentView === 'testament' && (
                <TestamentSelector onPassageSelect={handlePassageSelect} />
            )}
            {currentView === 'reader' && selectedPassage && (
                <VerseReader
                    book={selectedPassage.book}
                    chapter={selectedPassage.chapter}
                    verse={selectedPassage.verse}
                    onBack={handleBackToSelection}
                />
            )}
        </div>
    );
}

export default App;
