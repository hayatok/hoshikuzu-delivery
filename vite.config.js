import { defineConfig } from 'vite';

// GitHub Pages などサブパス配信でも動くよう、相対ベースにする
export default defineConfig({
  base: './',
});
