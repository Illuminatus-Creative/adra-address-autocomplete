/**
 * The settings page.
 */

import { expect, test } from '@playwright/test';

import { logIn, wpEval } from '../support/wp';

test('turning off the soft warning keeps the Google key', async ({ page }) => {
	await logIn(page);
	await page.goto(
		'/wp-admin/options-general.php?page=adra-address-autocomplete'
	);

	await expect(page.locator('h1')).toHaveText('Address Autocomplete');
	await expect(page.locator('#adra-aa-google-api-key')).toHaveValue(
		'e2e-test-key'
	);

	const checkbox = page.locator(
		'input[type="checkbox"][name="adra_aa_settings[soft_warning]"]'
	);

	try {
		await checkbox.uncheck();
		await Promise.all([
			page.waitForURL(/settings-updated/),
			page.click('#submit'),
		]);

		expect(
			wpEval(
				"$o = get_option( 'adra_aa_settings' ); echo wp_json_encode( array( $o['google_api_key'], (bool) $o['soft_warning'] ) );"
			)
		).toBe('["e2e-test-key",false]');
	} finally {
		wpEval(
			"$o = get_option( 'adra_aa_settings' ); $o['soft_warning'] = 1; update_option( 'adra_aa_settings', $o );"
		);
	}
});
