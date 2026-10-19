import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { wooCommerceState } from '../adapters/woocommerce-state';
import type { WooCommerceStates } from '../adapters/woocommerce-state';
import { parsePlace } from './parse-place';
import type { PlaceData } from './types';

interface Fixture {
	_source: string;
	place: PlaceData;
	expected: {
		address1: string;
		address2: string;
		city: string;
		postcode: string;
		region: string;
		countryCode: string;
		wcState: string;
	} | null;
}

const fixturesDir = join(__dirname, '../../../tests/fixtures');
const states = JSON.parse(
	readFileSync(join(fixturesDir, 'wc-states.json'), 'utf8')
) as WooCommerceStates;

const fixtures = readdirSync(join(fixturesDir, 'places'))
	.filter((file) => file.endsWith('.json'))
	.map((file) => ({
		name: file.replace(/\.json$/, ''),
		fixture: JSON.parse(
			readFileSync(join(fixturesDir, 'places', file), 'utf8')
		) as Fixture,
	}));

describe('parsePlace', () => {
	it.each(fixtures)('parses $name', ({ fixture }) => {
		expect(
			fixture.expected,
			'Fill in "expected" for this fixture.'
		).not.toBeNull();

		const parsed = parsePlace(fixture.place);
		const { wcState, ...expected } = fixture.expected!;

		expect(parsed).toMatchObject(expected);
		expect(wooCommerceState(parsed, states)).toBe(wcState);
	});

	it('keeps the place ID, formatted address and location', () => {
		const { fixture } = fixtures.find(
			({ name }) => name === 'us-mountain-view'
		)!;
		const parsed = parsePlace(fixture.place);

		expect(parsed.placeId).toBe(fixture.place.id);
		expect(parsed.formattedAddress).toBe(fixture.place.formattedAddress);
		expect(parsed.location).toEqual(fixture.place.location);
	});

	it('copes with a place that has no address data', () => {
		expect(
			parsePlace({
				id: 'x',
				formattedAddress: '',
				adrFormatAddress: '',
				addressComponents: [],
				location: null,
			})
		).toMatchObject({
			address1: '',
			city: '',
			region: '',
			countryCode: '',
			regionCandidates: [],
		});
	});
});
