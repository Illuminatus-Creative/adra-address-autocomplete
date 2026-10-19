/**
 * Turns Google place data into address parts. Ported from GP Address Autocomplete's fillFields(),
 * with the form-specific parts (writing inputs, matching select options) moved to the adapters.
 */

import { parseAdrFormatAddress } from './adr';
import type {
	AddressComponent,
	ParsedPlace,
	PlaceData,
	RegionCandidate,
} from './types';

/*
 * Where adrFormatAddress has no region, these countries' first-level area is the useful
 * one. Applied only to these countries because elsewhere it gives odd results (for London
 * or Berlin, for example).
 */
const REGION_FROM_LEVEL_1 = ['NL', 'NZ', 'FR'];

/* As above, for England, where the second level is the county. */
const REGION_FROM_LEVEL_2 = ['GB'];

/*
 * Countries whose state/province lists (in WooCommerce, for example) hold the second level:
 * provinces in Spain and Italy, where the first level is the autonomous community or region.
 */
const LEVEL_2_FIRST = ['ES', 'IT'];

function primaryType(component: AddressComponent): string {
	return component.types.filter((type) => type !== 'political')[0] ?? '';
}

function findComponent(
	components: AddressComponent[],
	type: string
): AddressComponent | undefined {
	return components.find((component) => primaryType(component) === type);
}

function regionCandidates(
	components: AddressComponent[],
	countryCode: string
): RegionCandidate[] {
	const candidates: RegionCandidate[] = [];

	for (const level of [1, 2] as const) {
		const component = findComponent(
			components,
			`administrative_area_level_${level}`
		);

		if (component) {
			candidates.push({
				level,
				longText: component.longText,
				shortText: component.shortText,
			});
		}
	}

	if (LEVEL_2_FIRST.includes(countryCode)) {
		candidates.sort((a, b) => b.level - a.level);
	}

	return candidates;
}

function regionText(
	adrRegion: string,
	candidates: RegionCandidate[],
	countryCode: string
): string {
	if (adrRegion) {
		// adrFormatAddress often abbreviates the region ("CA"); prefer the full name.
		const abbreviated = candidates.find(
			(candidate) => candidate.shortText === adrRegion
		);

		return abbreviated ? abbreviated.longText : adrRegion;
	}

	let fallbackLevel: 1 | 2 | null = null;

	if (REGION_FROM_LEVEL_1.includes(countryCode)) {
		fallbackLevel = 1;
	} else if (REGION_FROM_LEVEL_2.includes(countryCode)) {
		fallbackLevel = 2;
	}

	return (
		candidates.find((candidate) => candidate.level === fallbackLevel)
			?.longText ?? ''
	);
}

/**
 * Breaks a place into address parts.
 *
 * @param place Place data from the Places API (New).
 */
export function parsePlace(place: PlaceData): ParsedPlace {
	const adr = parseAdrFormatAddress(place.adrFormatAddress);
	const components = place.addressComponents;
	const country = findComponent(components, 'country');
	const countryCode = country?.shortText.toUpperCase() ?? '';
	const candidates = regionCandidates(components, countryCode);

	return {
		placeId: place.id,
		formattedAddress: place.formattedAddress,
		location: place.location,
		address1: adr['street-address'] ?? '',
		address2: adr['extended-address'] ?? '',
		// Singapore addresses have no locality in adrFormatAddress.
		city:
			adr.locality ||
			findComponent(components, 'locality')?.longText ||
			'',
		postcode: adr['postal-code'] ?? '',
		region: regionText(adr.region ?? '', candidates, countryCode),
		regionCandidates: candidates,
		countryCode,
		countryName: country?.longText ?? '',
	};
}
