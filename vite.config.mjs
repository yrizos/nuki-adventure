import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { defineConfig } from 'vite';

// GitHub Pages serves the game from a repository subpath, so asset URLs must be relative.
export default defineConfig({
  base: './',
  plugins: [
    {
      // check2d publishes a sourceMappingURL comment without shipping the map, so Vite fails to read it on every test run.
      name: 'strip-check2d-missing-source-map',
      load(id) {
        const path = id.split('?')[0];
        if (!path.endsWith('/node_modules/check2d/esm/index.js')) return;
        return readFileSync(path, 'utf8').replace(/\n\/\/# sourceMappingURL=index\.js\.map\s*$/, '\n');
      },
    },
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
    // Whole-level and pixel tests take several seconds each and exceed Vitest's 5 second default when the machine is busy, as during the pre-commit hook.
    testTimeout: 30_000,
    unstubGlobals: true,
  },
});
