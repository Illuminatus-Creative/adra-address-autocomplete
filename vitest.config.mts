import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['assets/src/**/*.test.ts'],
		environment: 'node',
		restoreMocks: true,
	},
});
