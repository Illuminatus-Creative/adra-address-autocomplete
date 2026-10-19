/**
 * Place data in the shape of the Places API (New), reduced to the fields the plugin requests.
 *
 * The REST API and the Maps JavaScript API return the same field names; `location` is
 * flattened to numbers so fixtures recorded from either source can be compared directly.
 */
export interface AddressComponent {
	longText: string;
	shortText: string;
	types: string[];
}

export interface PlaceData {
	id: string;
	formattedAddress: string;
	adrFormatAddress: string;
	addressComponents: AddressComponent[];
	location: { lat: number; lng: number } | null;
}

/**
 * An administrative area Google returned, in the order regions should be tried when
 * matching against a list of states or provinces.
 */
export interface RegionCandidate {
	level: 1 | 2;
	longText: string;
	shortText: string;
}

/**
 * A place broken into address parts, independent of any form or checkout.
 */
export interface ParsedPlace {
	placeId: string;
	formattedAddress: string;
	location: { lat: number; lng: number } | null;
	address_1: string;
	address_2: string;
	city: string;
	postcode: string;
	/** Region as text, for free-text state/county inputs. */
	region: string;
	regionCandidates: RegionCandidate[];
	/** ISO 3166-1 alpha-2 code, e.g. "US". Empty when Google returned no country. */
	country: string;
	countryName: string;
}

export interface Suggestion {
	id: string;
	text: string;
	mainText: string;
	secondaryText: string;
	matches: Array<{ offset: number; length: number }>;
}

export interface Option {
	value: string;
	label: string;
}
