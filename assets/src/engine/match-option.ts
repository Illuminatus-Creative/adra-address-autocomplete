/**
 * Matches Google's names and codes against the options of a select (or a list of states),
 * whose values may be codes ("CA", "DE-BY") or names ("California").
 */

import type { Option, ParsedPlace } from './types';

/*
 * Words that differ between Google's names and state lists without changing the place:
 * "County Dublin" / "Co. Dublin" vs "Dublin", "Tokyo Prefecture" vs "Tokyo".
 */
const NAME_NOISE =
	/^(?:county|co|province of|provincia di|provincia de|state of|prefecture of) | (?:county|province|prefecture|state)$/g;

/**
 * Normalizes a place name for comparison: accents, case, punctuation and the noise words above.
 *
 * @param name Place name.
 */
export function normalizeName(name: string): string {
	return name
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[.,'’]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(NAME_NOISE, '')
		.trim();
}

/**
 * Finds the option for any of the given names or codes.
 *
 * Candidates are tried in order. For each one, an exact value match wins, then a case-insensitive
 * value match, then a normalized label match.
 *
 * @param candidates Names or codes to look for, most preferred first.
 * @param options    Options to search.
 * @return The matching option's value, or undefined.
 */
export function matchOption(
	candidates: string[],
	options: Option[]
): string | undefined {
	for (const candidate of candidates) {
		if (!candidate) {
			continue;
		}

		const upper = candidate.toUpperCase();
		const normalized = normalizeName(candidate);

		const found =
			options.find((option) => option.value === candidate) ??
			options.find((option) => option.value.toUpperCase() === upper) ??
			options.find(
				(option) =>
					normalized !== '' &&
					(normalizeName(option.label) === normalized ||
						normalizeName(option.value) === normalized)
			);

		if (found) {
			return found.value;
		}
	}

	return undefined;
}

/**
 * Finds the state/province option for a place.
 *
 * Tries each administrative area Google returned, in order, as a code, as an ISO 3166-2 code
 * ("BY" as "DE-BY") and as a name, then the region text from adrFormatAddress.
 *
 * @param place   Parsed place.
 * @param options State or province options for the place's country.
 * @return The matching option's value, or undefined when nothing matches. Callers should
 *         leave the field empty rather than guess.
 */
export function matchRegion(
	place: ParsedPlace,
	options: Option[]
): string | undefined {
	const candidates = place.regionCandidates.flatMap((candidate) => [
		candidate.shortText,
		place.countryCode && candidate.shortText
			? `${place.countryCode}-${candidate.shortText}`
			: '',
		candidate.longText,
	]);

	return matchOption([...candidates, place.region], options);
}

/**
 * Converts a `{ code: name }` map, as WooCommerce provides states, into options.
 *
 * @param map Codes mapped to names.
 */
export function optionsFromMap(map: Record<string, string>): Option[] {
	return Object.entries(map).map(([value, label]) => ({ value, label }));
}
