import { runInNewContext } from 'node:vm';
import { defineConfig } from 'vite';

// GitHub Pages serves the game from a repository subpath, so asset URLs must be relative.
export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'expand-terrain-sprites',
      enforce: 'pre',
      transform(source, id) {
        if (!id.split('?')[0].endsWith('/sprites/terrain-transitions/data.js')) return;
        const expanded = String(
          runInNewContext(`${source}\nJSON.stringify(globalThis.sprites['terrain-transitions']);`),
        );
        return {
          code: `(globalThis.sprites ??= {})['terrain-transitions'] = ${expanded};`,
          map: null,
        };
      },
    },
  ],
  build: {
    // Sprite pixel data ships as text that gzip shrinks sevenfold, so the limit sits just above the measured bundle to catch only unexpected growth.
    chunkSizeWarningLimit: 700,
  },
  test: {
    // Shuffling exposes tests that only pass because an earlier test left state behind.
    sequence: { shuffle: true },
    restoreMocks: true,
    unstubGlobals: true,
  },
});
