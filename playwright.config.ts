/**
 * End-to-end tests. Run `bin/e2e-env.sh` once to build the site, then `npm run test:e2e`.
 * Google is replaced by a stand-in (tests/e2e/support/google.ts), so no key or network is needed.
 */

import { defineConfig } from '@playwright/test';

import { siteDir } from './tests/e2e/support/site-dir';

const port = process.env.E2E_PORT ?? '8889';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
	testDir: './tests/e2e/specs',
	timeout: 60_000,
	expect: { timeout: 15_000 },
	// One SQLite database behind PHP's single-process server: run one test at a time.
	workers: 1,
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	reporter: process.env.CI
		? [['github'], ['html', { open: 'never' }]]
		: 'list',
	use: {
		baseURL,
		viewport: { width: 1280, height: 1000 },
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		launchOptions: {
			// For machines with a preinstalled Chromium that doesn't match this Playwright version.
			executablePath: process.env.E2E_CHROMIUM || undefined,
		},
	},
	webServer: {
		command: `php -S 127.0.0.1:${port} -t "${siteDir}/wp" tests/e2e/router.php`,
		url: `${baseURL}/wp-login.php`,
		reuseExistingServer: !process.env.CI,
		stdout: 'ignore',
		stderr: 'pipe',
	},
});
