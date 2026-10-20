// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PlaceData, Suggestion } from '../engine/types';
import {
	createAdminOrderAdapter,
	regionCodesFor,
} from './woocommerce-admin-order';
import type { WooCommerceStates } from './woocommerce-state';

const fixtures = join(__dirname, '../../../tests/fixtures');
const states = JSON.parse(
	readFileSync(join(fixtures, 'wc-states.json'), 'utf8')
) as WooCommerceStates;
const place = (name: string): PlaceData =>
	JSON.parse(readFileSync(join(fixtures, `places/${name}.json`), 'utf8'))
		.place;

const suggestion: Suggestion = {
	id: 'p1',
	text: 'Marienplatz 1, München, Germany',
	mainText: 'Marienplatz 1',
	secondaryText: 'München, Germany',
	matches: [],
};

/**
 * The order screen's address fields, with the state as a text input (as for GB).
 * @param countries
 * @param country
 */
function orderScreen(countries = ['US', 'DE', 'GB'], country = 'GB') {
	document.body.innerHTML = ['billing', 'shipping']
		.map(
			(type) => `<div class="edit_address">
				${['address_1', 'address_2', 'city', 'postcode']
					.map((name) => `<input id="_${type}_${name}">`)
					.join('')}
				<select id="_${type}_country">
					<option value="">Select a country</option>
					${countries.map((code) => `<option value="${code}">${code}</option>`).join('')}
				</select>
				<input id="_${type}_state" class="js_field-state">
			</div>`
		)
		.join('');
	document.querySelectorAll('select').forEach((select) => {
		select.value = country;
	});
}

/**
 * Stand-in for jQuery plus WooCommerce's country handler, which replaces the state field with a
 * select of the country's states, or a text input when it has none.
 */
const events: string[] = [];
const jQuery = (element: Element) => ({
	val: (value: string) => {
		(element as HTMLInputElement).value = value;
	},
	trigger: (event: string) => {
		events.push(`${element.id}:${event}`);

		if (!element.id.endsWith('_country')) {
			return;
		}

		const old = document.getElementById(
			element.id.replace('country', 'state')
		)!;
		const list = states[(element as HTMLSelectElement).value];
		const replacement =
			list && !Array.isArray(list)
				? Object.assign(document.createElement('select'), {
						innerHTML:
							'<option value=""></option>' +
							Object.entries(list)
								.map(
									([code, name]) =>
										`<option value="${code}">${name}</option>`
								)
								.join(''),
					})
				: document.createElement('input');

		replacement.id = old.id;
		old.replaceWith(replacement);
	},
});

async function selectFor(type: string, data: PlaceData) {
	const client = {
		search: vi.fn(async () => [suggestion]),
		details: vi.fn(async () => data),
	};

	createAdminOrderAdapter(client, jQuery, states).init();

	const input = document.getElementById(
		`_${type}_address_1`
	) as HTMLInputElement;
	input.focus();
	input.value = 'Marienpl';
	input.dispatchEvent(new Event('input', { bubbles: true }));
	await vi.waitFor(() => {
		expect(document.querySelector('.adra-aa-suggestion')).not.toBeNull();
	});
	document
		.querySelector('.adra-aa-suggestion')!
		.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
	await vi.waitFor(() => expect(client.details).toHaveBeenCalled());
	await new Promise((resolve) => setTimeout(resolve));

	return client;
}

const value = (id: string) =>
	(document.getElementById(id) as HTMLInputElement | HTMLSelectElement).value;

afterEach(() => {
	document.body.replaceChildren();
	events.length = 0;
});

describe('admin order adapter', () => {
	it('fills the address, sets the country first, then the rebuilt state select', async () => {
		orderScreen();
		await selectFor('shipping', place('de-munich'));

		expect(value('_shipping_address_1')).toBe('Marienplatz 1');
		expect(value('_shipping_city')).toBe('München');
		expect(value('_shipping_postcode')).toBe('80331');
		expect(value('_shipping_country')).toBe('DE');
		expect(document.getElementById('_shipping_state')).toBeInstanceOf(
			HTMLSelectElement
		);
		expect(value('_shipping_state')).toBe('DE-BY');
		expect(events.indexOf('_shipping_country:change')).toBeLessThan(
			events.indexOf('_shipping_state:change')
		);
		// The other address is untouched.
		expect(value('_billing_city')).toBe('');
	});

	it('doesn’t trigger a country change when the country is already right', async () => {
		orderScreen(['US', 'DE', 'GB'], 'DE');
		document.getElementById('_billing_state')!.outerHTML =
			'<select id="_billing_state"><option value="DE-BY">Bavaria</option></select>';
		await selectFor('billing', place('de-munich'));

		expect(events).not.toContain('_billing_country:change');
		expect(value('_billing_state')).toBe('DE-BY');
	});

	it('leaves the country and state alone for a country the store doesn’t sell to', async () => {
		orderScreen(['US', 'GB'], 'GB');
		await selectFor('billing', place('de-munich'));

		expect(value('_billing_city')).toBe('München');
		expect(value('_billing_country')).toBe('GB');
		expect(value('_billing_state')).toBe('');
	});

	it('limits suggestions to the store’s countries when Google allows that many', async () => {
		orderScreen(['US', 'DE', 'GB']);
		const client = await selectFor('billing', place('de-munich'));

		expect(client.search).toHaveBeenCalledWith('Marienpl', {
			regionCodes: ['US', 'DE', 'GB'],
		});
	});

	it('doesn’t limit suggestions for stores selling to more than 15 countries', () => {
		orderScreen(Array.from({ length: 16 }, (_, i) => `C${i}`));

		expect(regionCodesFor('billing')).toEqual([]);
	});
});
