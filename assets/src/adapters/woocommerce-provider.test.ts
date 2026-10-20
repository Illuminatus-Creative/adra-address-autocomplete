// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import type { PlaceData, Suggestion } from '../engine/types';
import {
	createWooCommerceProvider,
	focusedAddressType,
} from './woocommerce-provider';
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
	matches: [{ offset: 0, length: 11 }],
};

function provider(details: PlaceData | null = place('de-munich')) {
	const client = {
		search: vi.fn(async () => [suggestion]),
		details: vi.fn(async () => details),
	};

	return {
		client,
		provider: createWooCommerceProvider(client, {
			providerId: 'adra-address-autocomplete',
			states,
		}),
	};
}

describe('WooCommerce provider', () => {
	it('has the ID registered on the server and searches any country', () => {
		const { provider: p } = provider();

		expect(p.id).toBe('adra-address-autocomplete');
		expect(p.canSearch()).toBe(true);
	});

	it('limits the search to the chosen country and returns WooCommerce suggestions', async () => {
		const { client, provider: p } = provider();

		await expect(p.search('marienpl', 'DE')).resolves.toEqual([
			{
				id: 'p1',
				label: 'Marienplatz 1, München, Germany',
				matchedSubstrings: [{ offset: 0, length: 11 }],
			},
		]);
		expect(client.search).toHaveBeenCalledWith('marienpl', {
			regionCodes: ['DE'],
		});

		await p.search('marienpl', '');
		expect(client.search).toHaveBeenLastCalledWith('marienpl', {
			regionCodes: [],
		});
	});

	it.each([
		[
			'de-munich',
			{
				address_1: 'Marienplatz 1',
				city: 'München',
				state: 'DE-BY',
				postcode: '80331',
				country: 'DE',
			},
		],
		[
			'us-mountain-view',
			{
				address_1: '1600 Amphitheatre Pkwy',
				state: 'CA',
				postcode: '94043-1351',
				country: 'US',
			},
		],
		['es-barcelona', { city: 'Barcelona', state: 'B', country: 'ES' }],
		['ie-dublin', { state: 'D', country: 'IE' }],
		['jp-tokyo', { state: 'JP13', country: 'JP' }],
		['gb-london', { state: 'Greater London', country: 'GB' }],
		['fr-paris', { state: '', country: 'FR' }],
	])(
		'returns the %s address with a WooCommerce state',
		async (name, expected) => {
			const { provider: p } = provider(place(name));

			expect(await p.select('p1')).toMatchObject(expected);
		}
	);

	it('returns null and logs instead of throwing', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		const { client, provider: p } = provider(null);

		expect(await p.select('p1')).toBeNull();

		client.details.mockRejectedValueOnce(new Error('offline'));
		client.search.mockRejectedValueOnce(new Error('offline'));

		expect(await p.select('p1')).toBeNull();
		expect(await p.search('x y z', 'US')).toEqual([]);
		expect(log).toHaveBeenCalledTimes(2);
	});
});

describe('WooCommerce provider selections', () => {
	it('reports which address type a selection was for', async () => {
		const onSelected = vi.fn();
		const client = {
			search: vi.fn(async () => [suggestion]),
			details: vi.fn(async () => place('de-munich')),
		};
		const p = createWooCommerceProvider(
			client,
			{ providerId: 'adra-address-autocomplete', states },
			onSelected
		);

		await p.search('marienpl', 'DE', 'shipping');
		const address = await p.select('p1');

		expect(onSelected).toHaveBeenCalledWith('shipping', {
			placeId: 'ChIJh1XS1fR1nkcRM7A6ayJH48Q',
			address,
		});
	});
});

describe('WooCommerce provider on the block checkout', () => {
	it('takes the address type from the focused field, as the block checkout passes none', async () => {
		document.body.innerHTML = '<input id="shipping-address_1">';
		document.getElementById('shipping-address_1')!.focus();
		const onSelected = vi.fn();
		const p = createWooCommerceProvider(
			{
				search: vi.fn(async () => [suggestion]),
				details: vi.fn(async () => place('de-munich')),
			},
			{ providerId: 'adra-address-autocomplete', states },
			onSelected
		);

		await p.search('marienpl', 'DE');
		document.body.replaceChildren();
		await p.select('p1');

		expect(onSelected).toHaveBeenCalledWith('shipping', expect.anything());
	});

	it('reads billing and shipping fields on both checkouts', () => {
		document.body.innerHTML =
			'<input id="billing_address_1"><input id="shipping-city"><input id="email">';

		const types = ['billing_address_1', 'shipping-city', 'email'].map(
			(id) => {
				document.getElementById(id)!.focus();
				return focusedAddressType();
			}
		);

		expect(types).toEqual(['billing', 'shipping', '']);
	});
});
