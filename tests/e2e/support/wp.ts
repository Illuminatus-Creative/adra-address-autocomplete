/**
 * Access to the test site: WP-CLI for setup and for reading what the plugin stored, and logging in.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

import { siteDir as e2e } from './site-dir';

export const site = JSON.parse(
	readFileSync(join(e2e, 'site.json'), 'utf8')
) as {
	productId: number;
	pages: {
		blockCheckout: string;
		classicCheckout: string;
		myAccount: string;
	};
	gravityForms: { international?: number; us?: number };
};

/**
 * Runs PHP in the test site and returns its output.
 *
 * @param php Code for `wp eval`.
 */
export function wpEval(php: string): string {
	return execFileSync(
		'php',
		[
			join(e2e, 'wp-cli.phar'),
			'--allow-root',
			`--path=${join(e2e, 'wp')}`,
			'eval',
			php,
		],
		{ encoding: 'utf8' }
	).trim();
}

/**
 * Runs PHP that echoes JSON, and decodes it.
 *
 * @param php Code for `wp eval`.
 */
export function wpJson<T>(php: string): T {
	return JSON.parse(wpEval(php)) as T;
}

export interface OrderStatus {
	id: number;
	billing_status: string;
	billing_changed: string;
	billing_place_id: string;
	shipping_status: string;
	shipping_place_id: string;
}

/** The newest order and the address status the plugin recorded on it. */
export function latestOrder(): OrderStatus {
	return wpJson<OrderStatus>(`
		$order = wc_get_orders( array( 'limit' => 1, 'orderby' => 'id', 'order' => 'DESC' ) )[0] ?? null;
		$data  = array( 'id' => $order ? $order->get_id() : 0 );
		foreach ( array( 'billing_status', 'billing_changed', 'billing_place_id', 'shipping_status', 'shipping_place_id' ) as $key ) {
			$data[ $key ] = $order ? (string) $order->get_meta( '_adra_aa_' . $key ) : '';
		}
		echo wp_json_encode( $data );
	`);
}

/**
 * Logs in through wp-login.php.
 *
 * @param page     Page.
 * @param user     Username.
 * @param password Password.
 */
export async function logIn(
	page: Page,
	user = 'admin',
	password = 'admin'
): Promise<void> {
	await page.goto('/wp-login.php');
	await page.fill('#user_login', user);
	await page.fill('#user_pass', password);
	await Promise.all([
		page.waitForURL(/wp-admin|my-account/),
		page.click('#wp-submit'),
	]);
}

/**
 * Sets one of the plugin's settings.
 *
 * @param name  Setting name.
 * @param value Value.
 */
export function setSetting(name: string, value: string | number): void {
	wpEval(
		`$o = get_option( 'adra_aa_settings', array() ); $o[ ${JSON.stringify(
			name
		)} ] = ${JSON.stringify(value)}; update_option( 'adra_aa_settings', $o );`
	);
}

/**
 * Waits for WooCommerce to move focus to the page's first notice, which it does 500 ms after
 * loading so screen readers announce it ("… has been added to your cart"). Typing before then
 * loses keystrokes to the notice.
 *
 * @param page Page.
 */
export async function waitForNoticeFocus(page: Page): Promise<void> {
	await page.waitForFunction(() => {
		const notice = document.querySelector(
			'.woocommerce-message[role="alert"], .woocommerce-error[role="alert"], .wc-block-components-notice-banner[role="alert"]'
		);

		return !notice || notice.ownerDocument.activeElement === notice;
	});
}
