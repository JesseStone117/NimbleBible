/**
 * AudioManager - Handles Web Speech API text-to-speech for Bible reading
 */
const AudioManager = {
    // State
    isPlaying: false,
    isPaused: false,
    currentVerseIndex: 0,
    verses: [],
    utterance: null,
    voicesLoaded: false,
    preferredVoice: null,

    // Callbacks
    onVerseChange: null,
    onProgressUpdate: null,
    onPlayStateChange: null,

    /**
     * Initialize the AudioManager
     */
    init() {
        // Load voices when available
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => this.loadVoices();
        }
        this.loadVoices();
    },

    /**
     * Load and cache available voices, preferring Microsoft Brian
     */
    loadVoices() {
        const voices = speechSynthesis.getVoices();
        if (voices.length === 0) return;

        this.voicesLoaded = true;

        // Try to find Microsoft Brian Online (Natural) - English
        this.preferredVoice = voices.find(v =>
            v.name.includes('Microsoft Brian Online') ||
            v.name.includes('Microsoft Brian')
        );

        // Fallback to any high-quality English voice
        if (!this.preferredVoice) {
            this.preferredVoice = voices.find(v =>
                (v.lang === 'en-US' || v.lang === 'en-GB' || v.lang.startsWith('en')) &&
                /neural|premium|natural|online/i.test(v.name)
            );
        }

        // Fallback to any English voice
        if (!this.preferredVoice) {
            this.preferredVoice = voices.find(v =>
                v.lang === 'en-US' || v.lang === 'en-GB' || v.lang.startsWith('en')
            );
        }

        console.log('Audio: Selected voice:', this.preferredVoice?.name || 'default');
    },

    /**
     * Set the chapter verses to read
     * @param {Array} verses - Array of {number, text} verse objects
     */
    setVerses(verses) {
        this.stop();
        this.verses = verses || [];
        this.currentVerseIndex = 0;
    },

    /**
     * Start or resume playback
     */
    play() {
        if (this.verses.length === 0) return;

        if (this.isPaused) {
            speechSynthesis.resume();
            this.isPaused = false;
            this.isPlaying = true;
            this.notifyPlayStateChange();
            return;
        }

        this.isPlaying = true;
        this.isPaused = false;
        this.speakCurrentVerse();
        this.notifyPlayStateChange();
    },

    /**
     * Pause playback
     */
    pause() {
        if (!this.isPlaying) return;

        speechSynthesis.pause();
        this.isPaused = true;
        this.isPlaying = false;
        this.notifyPlayStateChange();
    },

    /**
     * Stop playback completely
     */
    stop() {
        speechSynthesis.cancel();
        this.isPlaying = false;
        this.isPaused = false;
        this.currentVerseIndex = 0;
        this.notifyPlayStateChange();
    },

    /**
     * Toggle play/pause
     */
    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    },

    /**
     * Seek to a specific verse
     * @param {number} verseIndex - Index in the verses array
     */
    seekToVerse(verseIndex) {
        if (verseIndex < 0 || verseIndex >= this.verses.length) return;

        const wasPlaying = this.isPlaying;
        speechSynthesis.cancel();
        this.currentVerseIndex = verseIndex;
        this.isPaused = false;

        if (wasPlaying) {
            this.isPlaying = true;
            this.speakCurrentVerse();
        }

        this.notifyVerseChange();
    },

    /**
     * Seek to a verse by its number
     * @param {number} verseNumber - The verse number (1-based)
     */
    seekToVerseNumber(verseNumber) {
        const index = this.verses.findIndex(v => v.number === verseNumber);
        if (index !== -1) {
            this.seekToVerse(index);
        }
    },

    /**
     * Internal: Speak the current verse
     */
    speakCurrentVerse() {
        if (this.currentVerseIndex >= this.verses.length) {
            // Finished all verses
            this.isPlaying = false;
            this.isPaused = false;
            this.currentVerseIndex = 0;
            this.notifyPlayStateChange();
            this.notifyProgressUpdate();
            return;
        }

        const verse = this.verses[this.currentVerseIndex];
        this.utterance = new SpeechSynthesisUtterance(verse.text);

        // Configure voice and settings
        if (this.preferredVoice) {
            this.utterance.voice = this.preferredVoice;
        }
        this.utterance.lang = 'en-US';
        this.utterance.rate = 0.92;  // Contemplative pace for scripture
        this.utterance.pitch = 1.0;
        this.utterance.volume = 1.0;

        // Word boundary for progress tracking
        this.utterance.onboundary = (event) => {
            if (event.name === 'word') {
                this.notifyProgressUpdate();
            }
        };

        // When verse finishes, move to next
        this.utterance.onend = () => {
            if (this.isPlaying && !this.isPaused) {
                this.currentVerseIndex++;
                this.notifyVerseChange();
                this.speakCurrentVerse();
            }
        };

        // Handle errors
        this.utterance.onerror = (event) => {
            if (event.error !== 'interrupted' && event.error !== 'canceled') {
                console.error('Speech error:', event.error);
            }
        };

        this.notifyVerseChange();
        speechSynthesis.speak(this.utterance);
    },

    /**
     * Get current progress (0-100)
     */
    getProgress() {
        if (this.verses.length === 0) return 0;
        return (this.currentVerseIndex / this.verses.length) * 100;
    },

    /**
     * Get progress as verse index from percentage
     * @param {number} percent - Progress percentage (0-100)
     */
    getVerseIndexFromProgress(percent) {
        if (this.verses.length === 0) return 0;
        return Math.floor((percent / 100) * this.verses.length);
    },

    /**
     * Get current verse number
     */
    getCurrentVerseNumber() {
        if (this.verses.length === 0 || this.currentVerseIndex >= this.verses.length) {
            return null;
        }
        return this.verses[this.currentVerseIndex].number;
    },

    /**
     * Format time for display
     * @param {number} verseIndex - Verse index
     */
    getTimeDisplay() {
        const current = this.currentVerseIndex + 1;
        const total = this.verses.length;
        return `Verse ${current} of ${total}`;
    },

    // Notification helpers
    notifyVerseChange() {
        if (this.onVerseChange) {
            this.onVerseChange(this.getCurrentVerseNumber(), this.currentVerseIndex);
        }
    },

    notifyProgressUpdate() {
        if (this.onProgressUpdate) {
            this.onProgressUpdate(this.getProgress(), this.currentVerseIndex);
        }
    },

    notifyPlayStateChange() {
        if (this.onPlayStateChange) {
            this.onPlayStateChange(this.isPlaying, this.isPaused);
        }
    }
};

// Initialize on load
AudioManager.init();
