import '../css/style.css';
import './data.js';
import './audio.js';
import './app-navigation.js';
import './app-nimble.js';
import './app-verse-selection.js';
import './app-tabs.js';
import './app-search.js';
import './app.js';

const manifestLink = document.createElement('link');
manifestLink.rel = 'manifest';
manifestLink.href = '/manifest.json';
document.head.appendChild(manifestLink);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
    let refreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });

    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('SW registered:', registration);

            setInterval(() => {
                registration.update();
            }, 60000);
        } catch (error) {
            console.log('SW registration failed:', error);
        }
    });
}

window.addEventListener('beforeinstallprompt', () => {
    console.log('PWA install prompt available');
});

window.addEventListener('appinstalled', () => {
    console.log('PWA installed successfully');
});
