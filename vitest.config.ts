import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const source = fileURLToPath(new URL('./src', import.meta.url));
const obsidian = fileURLToPath(new URL('./tests/support/obsidian.ts', import.meta.url));
const dom = ['tests/ui/**/*.test.ts', 'tests/integrations/**/*.test.ts'];

export default defineConfig({
	resolve: {
		alias: [
			{ find: /^@\/(.*)$/, replacement: `${source}/$1` },
			{ find: /^obsidian$/, replacement: obsidian },
		],
	},
	test: {
		passWithNoTests: true,
		setupFiles: ['tests/support/setup.ts'],
		projects: [
			{ extends: true, test: { name: 'unit', environment: 'node', include: ['tests/**/*.test.ts'], exclude: dom } },
			{ extends: true, test: { name: 'dom', environment: 'happy-dom', include: dom } },
		],
	},
});
