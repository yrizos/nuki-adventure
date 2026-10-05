import { defineConfig } from 'vite';

// GitHub Pages serves the game from a repository subpath, so asset URLs must be relative.
export default defineConfig({
  base: './',
});
