import { describe, expect, it } from 'vitest';

import type { Address } from './match';
import { addressKey, needsWarning } from './warning';

const address: Address = {
	address_1: '1600 Amphitheatre Pkwy',
	address_2: '',
	city: 'Mountain View',
	state: 'CA',
	postcode: '94043',
	country: 'US',
};
const selection = { placeId: 'p1', address };

describe('needsWarning', () => {
	it('does not warn when the address matches the selection', () => {
		expect(
			needsWarning({
				selection,
				current: { ...address, address_2: 'Apt 4' },
				confirmed: new Set(),
			})
		).toBe(false);
	});

	it('warns once for an edited or typed address', () => {
		const confirmed = new Set<string>();
		const edited = { ...address, city: 'Palo Alto' };

		expect(needsWarning({ selection, current: edited, confirmed })).toBe(
			true
		);
		expect(needsWarning({ current: address, confirmed })).toBe(true);

		confirmed.add(addressKey(edited));
		expect(needsWarning({ selection, current: edited, confirmed })).toBe(
			false
		);
	});

	it('warns again when a confirmed address is edited', () => {
		const confirmed = new Set([addressKey(address)]);

		expect(
			needsWarning({
				current: { ...address, postcode: '94044' },
				confirmed,
			})
		).toBe(true);
	});

	it('does not warn about an address that was on the form when the page loaded', () => {
		expect(
			needsWarning({
				current: address,
				initial: { ...address },
				confirmed: new Set(),
			})
		).toBe(false);
	});

	it('leaves an empty street to the form’s own required check', () => {
		expect(
			needsWarning({
				current: { ...address, address_1: ' ' },
				confirmed: new Set(),
			})
		).toBe(false);
	});

	it('ignores formatting in the confirmation key', () => {
		expect(addressKey({ ...address, city: ' MOUNTAIN view.' })).toBe(
			addressKey(address)
		);
	});
});
