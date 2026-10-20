/**
 * The WooCommerce order edit screen: our own dropdown, the country → state rebuild, and the
 * "edited since checkout" note on the address status.
 */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { stubGoogle } from '../support/google';
import { logIn, wpEval } from '../support/wp';

/** An order placed with a verified billing address, as the checkout would record it. */
function createVerifiedOrder(): number {
	return Number(
		wpEval(`
			$address = array( 'first_name' => 'Pat', 'last_name' => 'Doe', 'address_1' => '1600 Amphitheatre Pkwy', 'city' => 'Mountain View', 'state' => 'CA', 'postcode' => '94043', 'country' => 'US' );
			$order   = wc_create_order();
			$order->set_address( $address, 'billing' );
			$order->set_address( $address, 'shipping' );
			$order->update_meta_data( '_adra_aa_billing_status', 'verified' );
			$order->update_meta_data( '_adra_aa_billing_address_key', Adra\\AddressAutocomplete\\Address\\Warning::key( $address ) );
			$order->save();
			echo $order->get_id();
		`)
	);
}

async function openAddress(page: Page, type: 'billing' | 'shipping') {
	await page
		.locator('.order_data_column')
		.filter({ has: page.locator(`#_${type}_address_1`) })
		.locator('a.edit_address')
		.first()
		.click();
	await page.locator(`#_${type}_address_1`).fill('');
}

async function select(page: Page, type: string, query: string, text: string) {
	await page
		.locator(`#_${type}_address_1`)
		.pressSequentially(query, { delay: 30 });
	await page
		.locator('.adra-aa-suggestions:not([hidden]) .adra-aa-suggestion')
		.filter({ hasText: text })
		.first()
		.dispatchEvent('mousedown');
}

test.beforeEach(async ({ context, page }) => {
	await stubGoogle(context);
	await logIn(page);
});

test('fills addresses, rebuilding the state field for the new country', async ({
	page,
}) => {
	const orderId = createVerifiedOrder();

	await page.goto(
		`/wp-admin/admin.php?page=wc-orders&action=edit&id=${orderId}`
	);
	await openAddress(page, 'billing');
	await page.locator('#_billing_address_1').click();
	await page.locator('#_billing_address_1').pressSequentially('Marienplatz', {
		delay: 30,
	});

	const list = page.locator('.adra-aa-suggestions:not([hidden])');
	await expect(list.locator('img[alt="Google"]')).toBeVisible();
	await list
		.locator('.adra-aa-suggestion')
		.first()
		.dispatchEvent('mousedown');

	await expect(page.locator('#_billing_city')).toHaveValue(/München/);
	await expect(page.locator('#_billing_country')).toHaveValue('DE');
	// WooCommerce replaced the state field with Germany's list; Bavaria is selected.
	await expect(page.locator('select#_billing_state')).toHaveValue('DE-BY');

	await openAddress(page, 'shipping');
	await select(page, 'shipping', '10 Downing', 'London');
	await expect(page.locator('#_shipping_postcode')).toHaveValue('SW1A 2AA');
	// No state list for the UK: a text input.
	await expect(page.locator('input#_shipping_state')).toBeVisible();

	await Promise.all([
		page.waitForURL(/wc-orders/),
		page.locator('button.save_order').first().click(),
	]);

	expect(
		wpEval(
			`$o = wc_get_order( ${orderId} ); echo $o->get_billing_state() . '/' . $o->get_billing_country() . '/' . $o->get_shipping_country();`
		)
	).toBe('DE-BY/DE/GB');
	await expect(page.locator('#adra-aa-address-status')).toContainText(
		'edited since checkout'
	);
});

test('fills the billing address on the new order screen', async ({ page }) => {
	await page.goto('/wp-admin/admin.php?page=wc-orders&action=new');
	await openAddress(page, 'billing');
	await select(page, 'billing', '1600 Amphitheatre', 'Mountain View');

	await expect(page.locator('#_billing_city')).toHaveValue('Mountain View');
	await expect(page.locator('#_billing_state')).toHaveValue('CA');
});
