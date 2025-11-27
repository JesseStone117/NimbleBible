/**
 * Provide haptic feedback if supported
 * @param {string} type - 'light', 'medium', 'heavy'
 */
export function hapticFeedback(type = 'light') {
    if ('vibrate' in navigator) {
        const patterns = {
            light: 10,
            medium: 20,
            heavy: 30,
            selection: [5, 10, 5]
        };

        navigator.vibrate(patterns[type] || patterns.light);
    }
}

/**
 * Provide selection feedback (haptic + visual)
 */
export function selectionFeedback() {
    hapticFeedback('selection');
}
