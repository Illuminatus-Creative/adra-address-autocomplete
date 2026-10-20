/**
 * WooCommerce classic and block checkout: filling from a suggestion, the address status recorded on
 * the order, and the soft warning.
 */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { places, stubGoogle } from '../support/google';
import {
	latestOrder,
	setSetting,
	site,
	waitForNoticeFocus,
} from '../support/wp';

const WARNING = 'We couldn’t match this address to a known address.';
const typed = {
	address_1: '1 Main St',
	city: 'Springfield',
	state: 'IL',
	postcode: '62701',
};

test.beforeEach(async ({ context }) => {
	await stubGoogle(context);
});

async function addToCart(page: Page) {
	await page.goto(`/?add-to-cart=${site.productId}`);
}

test.describe('classic checkout', () => {
	async function openCheckout(page: Page) {
		await addToCart(page);
		await page.goto(`/${site.pages.classicCheckout}/`);
		await waitForNoticeFocus(page);
		await page.fill('#billing_first_name', 'Test');
		await page.fill('#billing_last_name', 'Customer');
		await page.fill('#billing_phone', '5555555555');
		await page.fill('#billing_email', 'test@example.com');
	}

	async function select(
		page: Page,
		type: string,
		query: string,
		text: string
	) {
		await page.locator(`#${type}_address_1`).fill('');
		await page.locator(`#${type}_address_1`).pressSequentially(query, {
			delay: 30,
		});
		await page
			.locator(`#address_suggestions_${type} li`)
			.filter({ hasText: text })
			.first()
			.click();
	}

	/**
	 * Clicks Place order; resolves to "placed" or "warned".
	 * @param page
	 */
	async function placeOrder(page: Page): Promise<'placed' | 'warned'> {
		// Clear a warning from an earlier attempt, so only a new one counts.
		await page.evaluate(() =>
			document
				.querySelectorAll('.adra-aa-soft-warning')
				.forEach((notice) => notice.remove())
		);
		await page.locator('#place_order').click();

		return Promise.race([
			page.waitForURL(/order-received/).then(() => 'placed' as const),
			page
				.locator('.adra-aa-soft-warning')
				.waitFor()
				.then(() => 'warned' as const),
		]);
	}

	test('fills a US address and records it as verified', async ({ page }) => {
		await openCheckout(page);
		await select(page, 'billing', '1600 Amphitheatre', 'Mountain View');

		await expect(page.locator('#billing_city')).toHaveValue(
			'Mountain View'
		);
		await expect(page.locator('#billing_state')).toHaveValue('CA');
		await expect(page.locator('#billing_postcode')).toHaveValue(/^94043/);
		await expect(page.locator('#billing_country')).toHaveValue('US');

		expect(await placeOrder(page)).toBe('placed');

		const order = latestOrder();
		expect(order.billing_status).toBe('verified');
		expect(order.billing_place_id).toBe(places['us-mountain-view']!.id);
		// Shipping to the billing address shares its selection.
		expect(order.shipping_status).toBe('verified');
	});

	test('fills a German address with the state code after the state list reloads', async ({
		page,
	}) => {
		await openCheckout(page);
		await page.selectOption('#billing_country', 'DE');
		await select(page, 'billing', 'Marienplatz 1', 'München');

		await expect(page.locator('#billing_city')).toHaveValue(/München/);
		await expect(page.locator('#billing_postcode')).toHaveValue('80331');
		await expect(page.locator('#billing_state')).toHaveValue('DE-BY');
	});

	test('warns once about a typed address, then records it as manual', async ({
		page,
	}) => {
		await openCheckout(page);
		await page.fill('#billing_address_1', typed.address_1);
		await page.keyboard.press('Escape');
		await page.fill('#billing_city', typed.city);
		await page.selectOption('#billing_state', typed.state);
		await page.fill('#billing_postcode', typed.postcode);

		const before = latestOrder().id;
		expect(await placeOrder(page)).toBe('warned');
		await expect(page.locator('.adra-aa-soft-warning')).toContainText(
			WARNING
		);
		expect(latestOrder().id).toBe(before);

		// Editing the address asks again.
		await page.fill('#billing_postcode', '62702');
		expect(await placeOrder(page)).toBe('warned');

		expect(await placeOrder(page)).toBe('placed');
		expect(latestOrder().billing_status).toBe('manual');
	});

	test('records an edited suggestion as modified', async ({ page }) => {
		await openCheckout(page);
		await select(page, 'billing', '1600 Amphitheatre', 'Mountain View');
		// WooCommerce fills the city a moment after the street; edit it only once it has.
		await expect(page.locator('#billing_city')).toHaveValue(
			'Mountain View'
		);
		await page.fill('#billing_city', 'Palo Alto');

		expect(await placeOrder(page)).toBe('warned');
		expect(await placeOrder(page)).toBe('placed');

		const order = latestOrder();
		expect(order.billing_status).toBe('modified');
		expect(order.billing_changed).toBe('city');
	});

	test('places a typed address straight away when the warning is off', async ({
		page,
	}) => {
		setSetting('soft_warning', 0);

		try {
			await openCheckout(page);
			await page.fill('#billing_address_1', typed.address_1);
			await page.keyboard.press('Escape');
			await page.fill('#billing_city', typed.city);
			await page.selectOption('#billing_state', typed.state);
			await page.fill('#billing_postcode', typed.postcode);

			expect(await placeOrder(page)).toBe('placed');
			expect(latestOrder().billing_status).toBe('manual');
		} finally {
			setSetting('soft_warning', 1);
		}
	});
});

test.describe('block checkout', () => {
	async function openCheckout(page: Page) {
		await addToCart(page);
		await page.goto(`/${site.pages.blockCheckout}/`);
		await page.locator('#shipping-address_1').waitFor();
		await waitForNoticeFocus(page);
		await page.fill('#email', 'block@example.com');
		await page.fill('#shipping-first_name', 'Block');
		await page.fill('#shipping-last_name', 'Customer');
	}

	const placeOrderButton = (page: Page) =>
		page.locator('.wc-block-components-checkout-place-order-button');

	async function expectWarned(page: Page) {
		const before = latestOrder().id;

		await placeOrderButton(page).click();
		await expect(page.getByText(WARNING).first()).toBeVisible();
		// The warning is client-side; make sure no order slipped through behind it.
		await page.waitForTimeout(1000);
		expect(page.url()).not.toContain('order-received');
		expect(latestOrder().id).toBe(before);
	}

	async function expectPlaced(page: Page) {
		await placeOrderButton(page).click();
		await page.waitForURL(/order-received/, { timeout: 20_000 });
	}

	test('fills the shipping address and records it as verified', async ({
		page,
	}) => {
		await openCheckout(page);
		await page.locator('#shipping-address_1').click();
		await page
			.locator('#shipping-address_1')
			.pressSequentially('1600 Amphitheatre', { delay: 30 });
		await page
			.locator(
				'.wc-block-components-address-autocomplete-suggestions li, [role="listbox"] [role="option"]'
			)
			.filter({ hasText: 'Mountain View' })
			.first()
			.click();

		await expect(page.locator('#shipping-city')).toHaveValue(
			'Mountain View'
		);
		await expect(page.locator('#shipping-state')).toHaveValue('CA');

		await expectPlaced(page);

		const order = latestOrder();
		expect(order.shipping_status).toBe('verified');
		expect(order.shipping_place_id).toBe(places['us-mountain-view']!.id);
		expect(order.billing_status).toBe('verified');
	});

	test('warns once about a typed address, then records it as manual', async ({
		page,
	}) => {
		await openCheckout(page);
		await page.fill('#shipping-address_1', typed.address_1);
		await page.keyboard.press('Escape');
		await page.fill('#shipping-city', typed.city);
		await page.selectOption('#shipping-state', typed.state);
		await page.fill('#shipping-postcode', typed.postcode);
		await page.locator('#shipping-postcode').blur();

		await expectWarned(page);
		await expectPlaced(page);
		expect(latestOrder().shipping_status).toBe('manual');
	});
});
