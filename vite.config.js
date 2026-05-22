import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const staticEntries = ['data', 'icons', 'manifest.json', 'sw.js'];

function copyStaticEntries() {
    return {
        name: 'copy-static-entries',
        apply: 'build',
        async closeBundle() {
            await mkdir(resolve('dist'), { recursive: true });

            await Promise.all(
                staticEntries.map((entry) =>
                    cp(resolve(entry), resolve('dist', entry), {
                        recursive: true,
                        force: true
                    })
                )
            );
        }
    };
}

export default defineConfig({
    plugins: [copyStaticEntries()],
    build: {
        rollupOptions: {
            input: 'index.html'
        }
    },
    server: {
        open: false
    },
    preview: {
        open: false
    }
});
