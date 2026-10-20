/**
 * Decides whether the submitted address still matches the selected address.
 *
 * Mirrors src/Address/Status.php. Both are tested against
 * tests/fixtures/address-match-cases.json; change them together.
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

/*
 * Adding or removing a US ZIP+4 extension isn't an edit (Google returns either form); changing
 * it is. Keyed on
 * the postcode's shape, not the country, because forms store the country as a code or a name.
 */
function postcodesMatch(selected: string, submitted: string): boolean {
	const a = normalizePostcode(selected);
	const b = normalizePostcode(submitted);
	const zip = /^(\d{5})(\d{4})?$/;
	const zipA = zip.exec(a);
	const zipB = zip.exec(b);

	return (
		a === b ||
		(!!zipA &&
			!!zipB &&
			zipA[1] === zipB[1] &&
			(!zipA[2] || !zipB[2] || zipA[2] === zipB[2]))
	);
}

/**
 * Compares the selected address with the submitted address.
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
			return !postcodesMatch(before, after);
		}

		return normalizeText(before) !== normalizeText(after);
	});

	return {
		status: changed.length ? 'modified' : 'verified',
		changed,
	};
}
