import { defineConfig } from 'vite';

// GitHub Pages serves the game from a repository subpath, so asset URLs must be relative.
export default defineConfig({
  base: './',
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
