/**
 * Decides whether a submitted address is still the one picked from a suggestion.
 *
 * The server-side status check must apply the same rules; keep them in sync.
 */

export interface Address {
	address_1: string;
	address_2?: string;
	city: string;
	state: string;
	postcode: string;
	country: string;
}

export type ComparedField =
	'address_1' | 'city' | 'state' | 'postcode' | 'country';

export interface MatchResult {
	status: 'verified' | 'modified';
	changed: ComparedField[];
}

/*
 * address_2 is left out on purpose: people routinely add an apartment or unit number
 * after picking a suggestion, and that doesn't make the street address wrong.
 */
const COMPARED_FIELDS: ComparedField[] = [
	'address_1',
	'city',
	'state',
	'postcode',
	'country',
];

/**
 * Normalizes text so formatting-only differences don't count as edits: case, accents,
 * repeated whitespace and the punctuation people add or drop ("St." vs "St", "Apt #4").
 *
 * @param value Raw input value.
 */
export function normalizeText(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[.,#'\u2019]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Normalizes a postcode, ignoring spaces and hyphens ("SW1A 1AA" vs "sw1a1aa").
 *
 * @param value Raw postcode.
 */
export function normalizePostcode(value: string): string {
	return value.replace(/[\s-]/g, '').toUpperCase();
}

function postcodesMatch(
	selected: string,
	submitted: string,
	country: string
): boolean {
	const a = normalizePostcode(selected);
	const b = normalizePostcode(submitted);

	if (a === b) {
		return true;
	}

	// Google returns 5-digit ZIPs; a customer adding the +4 extension hasn't changed the address.
	if (country.toUpperCase() === 'US') {
		return a.slice(0, 5) === b.slice(0, 5) && /^\d{5}$/.test(a.slice(0, 5));
	}

	return false;
}

/**
 * Compares the address picked from a suggestion with the one being submitted.
 *
 * A field the suggestion left empty can be filled in freely, since Google doesn't return
 * every component for every country.
 *
 * @param selected  Address as filled from the selected suggestion.
 * @param submitted Address as it is about to be submitted.
 */
export function compareAddress(
	selected: Address,
	submitted: Address
): MatchResult {
	const changed = COMPARED_FIELDS.filter((field) => {
		const before = selected[field];
		const after = submitted[field];

		if (normalizeText(before) === '') {
			return false;
		}

		if (field === 'postcode') {
			return !postcodesMatch(before, after, selected.country);
		}

		return normalizeText(before) !== normalizeText(after);
	});

	return {
		status: changed.length ? 'modified' : 'verified',
		changed,
	};
}
