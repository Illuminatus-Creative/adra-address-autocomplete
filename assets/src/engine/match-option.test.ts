import { describe, expect, it } from 'vitest';

import {
	matchOption,
	matchRegion,
	normalizeName,
	optionsFromMap,
} from './match-option';
import type { Option, ParsedPlace } from './types';

const byName = (...names: string[]): Option[] =>
	names.map((name) => ({ value: name, label: name }));

function place(overrides: Partial<ParsedPlace>): ParsedPlace {
	return {
		placeId: 'x',
		formattedAddress: '',
		location: null,
		address_1: '',
		address_2: '',
		city: '',
		postcode: '',
		region: '',
		regionCandidates: [],
		country: '',
		countryName: '',
		...overrides,
	};
}

describe('normalizeName', () => {
	it('drops accents, case, punctuation and county/province wording', () => {
		expect(normalizeName('Québec')).toBe('quebec');
		expect(normalizeName('County Dublin')).toBe('dublin');
		expect(normalizeName('Co. Dublin')).toBe('dublin');
		expect(normalizeName('Santa Clara County')).toBe('santa clara');
		expect(normalizeName('Cork')).toBe('cork');
	});
});

describe('matchOption', () => {
	it('prefers an exact value, then a case-insensitive value, then the label', () => {
		const options: Option[] = [
			{ value: 'us', label: 'Exact lower' },
			{ value: 'US', label: 'Exact upper' },
		];

		expect(matchOption(['US'], options)).toBe('US');
		expect(matchOption(['uS'], options)).toBe('us');
		expect(matchOption(['Exact Upper'], options)).toBe('US');
	});

	it('tries candidates in order and skips empty ones', () => {
		const options = byName('United States', 'Canada');

		expect(
			matchOption(['', 'XX', 'Canada', 'United States'], options)
		).toBe('Canada');
		expect(matchOption(['XX'], options)).toBeUndefined();
	});

	it('matches a Gravity Forms province select written without accents', () => {
		expect(matchOption(['QC', 'Québec'], byName('Ontario', 'Quebec'))).toBe(
			'Quebec'
		);
	});
});

describe('matchRegion', () => {
	it('matches a state select whose values are names', () => {
		const california = place({
			country: 'US',
			region: 'California',
			regionCandidates: [
				{ level: 1, longText: 'California', shortText: 'CA' },
			],
		});

		expect(matchRegion(california, byName('Arizona', 'California'))).toBe(
			'California'
		);
	});

	it('matches ISO 3166-2 style codes', () => {
		const bavaria = place({
			country: 'DE',
			regionCandidates: [
				{ level: 1, longText: 'Bayern', shortText: 'BY' },
			],
		});

		expect(
			matchRegion(
				bavaria,
				optionsFromMap({ 'DE-BE': 'Berlin', 'DE-BY': 'Bavaria' })
			)
		).toBe('DE-BY');
	});

	it('returns undefined rather than guessing', () => {
		const unknown = place({
			country: 'US',
			regionCandidates: [
				{ level: 1, longText: 'Atlantis', shortText: 'AT' },
			],
		});

		expect(matchRegion(unknown, byName('Arizona'))).toBeUndefined();
	});
});
