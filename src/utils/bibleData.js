// Bible data structure utilities
let bibleData = null;

// Old Testament books in order
const OLD_TESTAMENT_BOOKS = [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
    'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
    '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther',
    'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
    'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel',
    'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
    'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'
];

// New Testament books in order
const NEW_TESTAMENT_BOOKS = [
    'Matthew', 'Mark', 'Luke', 'John', 'Acts',
    'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
    'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
    '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
    'Hebrews', 'James', '1 Peter', '2 Peter',
    '1 John', '2 John', '3 John', 'Jude', 'Revelation'
];

/**
 * Load the Bible JSON data
 */
export async function loadBibleData() {
    if (bibleData) return bibleData;

    try {
        const response = await fetch('/ESV_bible.json');
        bibleData = await response.json();
        return bibleData;
    } catch (error) {
        console.error('Failed to load Bible data:', error);
        throw error;
    }
}

/**
 * Get books for a testament
 * @param {string} testament - 'old' or 'new'
 * @returns {string[]} Array of book names
 */
export function getBooksForTestament(testament) {
    return testament === 'old' ? OLD_TESTAMENT_BOOKS : NEW_TESTAMENT_BOOKS;
}

/**
 * Get chapters for a book
 * @param {string} bookName - Name of the book
 * @returns {number[]} Array of chapter numbers
 */
export function getChaptersForBook(bookName) {
    if (!bibleData || !bibleData[bookName]) return [];

    const chapters = Object.keys(bibleData[bookName]).map(Number);
    return chapters.sort((a, b) => a - b);
}

/**
 * Get verses for a chapter
 * @param {string} bookName - Name of the book
 * @param {number} chapterNum - Chapter number
 * @returns {number[]} Array of verse numbers
 */
export function getVersesForChapter(bookName, chapterNum) {
    if (!bibleData || !bibleData[bookName] || !bibleData[bookName][chapterNum]) {
        return [];
    }

    const verses = Object.keys(bibleData[bookName][chapterNum]).map(Number);
    return verses.sort((a, b) => a - b);
}

/**
 * Get text for a specific verse
 * @param {string} bookName - Name of the book
 * @param {number} chapterNum - Chapter number
 * @param {number} verseNum - Verse number
 * @returns {string} The verse text
 */
export function getVerseText(bookName, chapterNum, verseNum) {
    if (!bibleData || !bibleData[bookName] || !bibleData[bookName][chapterNum]) {
        return '';
    }

    return bibleData[bookName][chapterNum][verseNum] || '';
}

/**
 * Get all verses for a chapter as an array of {verse, text} objects
 * @param {string} bookName - Name of the book
 * @param {number} chapterNum - Chapter number
 * @returns {Array<{verse: number, text: string}>}
 */
export function getChapterText(bookName, chapterNum) {
    const verses = getVersesForChapter(bookName, chapterNum);
    return verses.map(verseNum => ({
        verse: verseNum,
        text: getVerseText(bookName, chapterNum, verseNum)
    }));
}
