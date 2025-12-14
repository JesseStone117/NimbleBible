const DataManager = {
    bibleData: null,
    books: [],

    async init() {
        try {
            const response = await fetch('./data/esv.json');
            const data = await response.json();
            this.bibleData = data;
            this.processData();
            console.log('Bible data loaded', this.books.length, 'books');
            return true;
        } catch (error) {
            console.error('Failed to load Bible data:', error);
            return false;
        }
    },

    processData() {
        // The ESV JSON structure usually has an array of books or similar.
        // Let's assume the structure based on common formats, but we might need to adjust.
        // Based on the user's link, it seems to be an object or array.
        // We will inspect it or assume a standard structure.
        // If it's the "jadenzaleski" one, it might be: { "Genesis": { "1": { "1": "In the beginning..." } } }
        // or an array of objects.

        // Let's assume it's an object where keys are Book Names.
        if (this.bibleData) {
            this.books = Object.keys(this.bibleData).map(bookName => {
                const chaptersObj = this.bibleData[bookName];
                const chapters = Object.keys(chaptersObj).map(chNum => {
                    const versesObj = chaptersObj[chNum];
                    const verses = Object.keys(versesObj).map(vNum => ({
                        number: parseInt(vNum),
                        text: versesObj[vNum]
                    })).sort((a, b) => a.number - b.number);

                    return {
                        number: parseInt(chNum),
                        verses: verses
                    };
                }).sort((a, b) => a.number - b.number);

                return {
                    name: bookName,
                    chapters: chapters
                };
            });

            // Sort books? They might come in random order from Object.keys.
            // We need a canonical order.
            // Note: These names must match the JSON data exactly
            const canonicalOrder = [
                "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalm", "Proverbs", "Ecclesiastes", "Song Of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
                "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
            ];

            this.books.sort((a, b) => {
                return canonicalOrder.indexOf(a.name) - canonicalOrder.indexOf(b.name);
            });
        }
    },

    getTestamentBooks(testament) {
        // Simple split for now.
        // OT: Genesis (0) to Malachi (38) -> 39 books
        // NT: Matthew (39) to Revelation (65) -> 27 books
        if (testament === 'Old Testament') {
            return this.books.slice(0, 39);
        } else {
            return this.books.slice(39);
        }
    },

    getBook(name) {
        return this.books.find(b => b.name === name);
    },

    getChapter(bookName, chapterNum) {
        const book = this.getBook(bookName);
        if (!book) return null;
        return book.chapters.find(c => c.number === chapterNum);
    }
};
