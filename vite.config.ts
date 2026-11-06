/**
 * @author Stephan Coertzen (coertzen.jfs@gmail.com)
 * @license Apache-2.0
 * antislopscan is open-source software. See LICENSE.TXT for license information.
 */
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({ root: 'ui', plugins: [vue()], build: { outDir: '../dist/ui', emptyOutDir: true }, server: { host: '127.0.0.1', proxy: { '/api': 'http://127.0.0.1:3000' } } });
