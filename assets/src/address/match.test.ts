import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	compareAddress,
	normalizePostcode,
	normalizeText,
	type Address,
} from './match';

const selected: Address = {
	address_1: '1600 Amphitheatre Pkwy',
	address_2: '',
	city: 'Mountain View',
	state: 'CA',
	postcode: '94043',
	country: 'US',
};

describe('normalizeText', () => {
	it('ignores case, accents, punctuation and extra whitespace', () => {
		expect(normalizeText('  Königstraße  12, Apt. #4 ')).toBe(
			'konigstraße 12 apt 4'
		);
		expect(normalizeText("O'Connell St.")).toBe('o connell st');
	});
});

describe('normalizePostcode', () => {
	it('ignores spaces, hyphens and case', () => {
		expect(normalizePostcode('sw1a 1aa')).toBe('SW1A1AA');
		expect(normalizePostcode('1234-567')).toBe('1234567');
	});
});

describe('compareAddress', () => {
	it('treats an unchanged address as verified', () => {
		expect(compareAddress(selected, { ...selected })).toEqual({
			status: 'verified',
			changed: [],
		});
	});

	it('ignores formatting-only differences', () => {
		const submitted = {
			...selected,
			address_1: '1600 amphitheatre pkwy.',
			city: ' MOUNTAIN VIEW ',
		};

		expect(compareAddress(selected, submitted).status).toBe('verified');
	});

	it('ignores address line 2', () => {
		const submitted = { ...selected, address_2: 'Suite 400' };

		expect(compareAddress(selected, submitted).status).toBe('verified');
	});

	it('reports which fields were edited', () => {
		const submitted = {
			...selected,
			address_1: '1601 Amphitheatre Pkwy',
			city: 'Palo Alto',
		};

		expect(compareAddress(selected, submitted)).toEqual({
			status: 'modified',
			changed: ['address_1', 'city'],
		});
	});

	it('allows filling a field the suggestion left empty', () => {
		const partial = { ...selected, state: '', postcode: '' };
		const submitted = { ...selected, state: 'CA', postcode: '94043' };

		expect(compareAddress(partial, submitted).status).toBe('verified');
	});

	it('treats clearing a filled field as an edit', () => {
		const submitted = { ...selected, postcode: '' };

		expect(compareAddress(selected, submitted).changed).toEqual([
			'postcode',
		]);
	});

	it('accepts a ZIP+4 extension on a US address', () => {
		const submitted = { ...selected, postcode: '94043-1351' };

		expect(compareAddress(selected, submitted).status).toBe('verified');
	});

	it('rejects a different US ZIP', () => {
		const submitted = { ...selected, postcode: '94044' };

		expect(compareAddress(selected, submitted).changed).toEqual([
			'postcode',
		]);
	});

	it('does not apply the ZIP+4 rule outside the US', () => {
		const portugal: Address = {
			address_1: 'Rua Augusta 1',
			city: 'Lisboa',
			state: '',
			postcode: '1100-053',
			country: 'PT',
		};

		expect(
			compareAddress(portugal, { ...portugal, postcode: '1100-999' })
				.status
		).toBe('modified');
	});
});

describe('shared cases (also run against src/Address/Status.php)', () => {
	interface SharedCase {
		name: string;
		selected?: Address;
		submitted: Partial<Address>;
		expected: { status: string; changed: string[] };
	}

	const shared = JSON.parse(
		readFileSync(
			join(__dirname, '../../../tests/fixtures/address-match-cases.json'),
			'utf8'
		)
	) as { selected: Address; cases: SharedCase[] };

	it.each(shared.cases)('$name', ({ selected: own, submitted, expected }) => {
		const before = own ?? shared.selected;

		expect(compareAddress(before, { ...before, ...submitted })).toEqual(
			expected
		);
	});
});
