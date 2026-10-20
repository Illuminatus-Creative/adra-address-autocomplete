/**
 * WooCommerce My Account address forms.
 */

import { expect, test } from '@playwright/test';

import { stubGoogle } from '../support/google';
import { site } from '../support/wp';

test('fills a UK address on the edit shipping address form', async ({
	context,
	page,
}) => {
	await stubGoogle(context);
	await page.goto(`/${site.pages.myAccount}/`);
	await page.fill('#username', 'customer');
	await page.fill('#password', 'customer');
	await Promise.all([
		page.waitForURL(/my-account/),
		page.click('button[name="login"]'),
	]);
	await page.goto(`/${site.pages.myAccount}/edit-address/shipping/`);
	await page.selectOption('#shipping_country', 'GB');

	await page.locator('#shipping_address_1').pressSequentially('10 Downing', {
		delay: 30,
	});
	await page
		.locator('#address_suggestions_shipping li')
		.filter({ hasText: 'London' })
		.first()
		.click();

	await expect(page.locator('#shipping_city')).toHaveValue('London');
	await expect(page.locator('#shipping_postcode')).toHaveValue('SW1A 2AA');
	await expect(page.locator('#shipping_country')).toHaveValue('GB');
});
