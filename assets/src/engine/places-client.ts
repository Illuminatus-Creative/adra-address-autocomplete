/**
 * Thin wrapper around the Places API (New) in the Maps JavaScript API: suggestions while typing,
 * then details for the chosen one, within one billing session.
 */

import type { PlaceData, Suggestion } from './types';

/**
 * The parts of google.maps.PlacesLibrary this client uses. Declared separately so tests can
 * supply a fake.
 */
export interface PlacesApi {
	AutocompleteSessionToken: new () => google.maps.places.AutocompleteSessionToken;
	AutocompleteSuggestion: {
		fetchAutocompleteSuggestions: (
			request: google.maps.places.AutocompleteRequest
		) => Promise<{
			suggestions: google.maps.places.AutocompleteSuggestion[];
		}>;
	};
}

export interface SearchOptions {
	/** ISO 3166-1 alpha-2 codes to restrict results to. Google accepts at most 15. */
	regionCodes?: string[];
	/** Place types to restrict results to. Google accepts at most 5. */
	primaryTypes?: string[];
}

/*
 * Google's recommended filter for address entry. It includes establishments and points of
 * interest because people search for landmarks ("Sydney Opera House") and expect the address.
 */
export const DEFAULT_PRIMARY_TYPES = [
	'establishment',
	'point_of_interest',
	'premise',
	'street_address',
	'subpremise',
];

const PLACE_FIELDS = [
	'id',
	'addressComponents',
	'adrFormatAddress',
	'formattedAddress',
	'location',
];

function toSuggestion(
	prediction: google.maps.places.PlacePrediction
): Suggestion {
	const text = prediction.text?.text ?? '';

	return {
		id: prediction.placeId,
		text,
		mainText: prediction.mainText?.text ?? text,
		secondaryText: prediction.secondaryText?.text ?? '',
		matches: (prediction.text?.matches ?? []).map((range) => ({
			offset: range.startOffset,
			length: range.endOffset - range.startOffset,
		})),
	};
}

function toPlaceData(place: google.maps.places.Place): PlaceData {
	return {
		id: place.id,
		formattedAddress: place.formattedAddress ?? '',
		adrFormatAddress: place.adrFormatAddress ?? '',
		addressComponents: (place.addressComponents ?? []).map((component) => ({
			longText: component.longText ?? '',
			shortText: component.shortText ?? '',
			types: component.types,
		})),
		location: place.location
			? { lat: place.location.lat(), lng: place.location.lng() }
			: null,
	};
}

export class PlacesClient {
	private sessionToken:
		google.maps.places.AutocompleteSessionToken | undefined;

	private readonly predictions = new Map<
		string,
		google.maps.places.PlacePrediction
	>();

	/**
	 * @param loadApi Resolves the Places library once Google Maps has loaded.
	 */
	constructor(private readonly loadApi: () => Promise<PlacesApi>) {}

	/**
	 * Fetches suggestions for what the user has typed.
	 *
	 * @param input   Text typed so far.
	 * @param options Restrictions for the request.
	 * @return Suggestions, or an empty list if the request failed (the error is logged).
	 */
	async search(
		input: string,
		options: SearchOptions = {}
	): Promise<Suggestion[]> {
		const api = await this.loadApi();

		this.sessionToken ??= new api.AutocompleteSessionToken();

		const request: google.maps.places.AutocompleteRequest = {
			input,
			sessionToken: this.sessionToken,
		};

		const regionCodes = (options.regionCodes ?? []).filter(Boolean);
		const primaryTypes = options.primaryTypes ?? DEFAULT_PRIMARY_TYPES;

		if (regionCodes.length) {
			request.includedRegionCodes = regionCodes.slice(0, 15);
		}

		if (primaryTypes.length) {
			request.includedPrimaryTypes = primaryTypes.slice(0, 5);
		}

		let suggestions: google.maps.places.AutocompleteSuggestion[];

		try {
			({ suggestions } =
				await api.AutocompleteSuggestion.fetchAutocompleteSuggestions(
					request
				));
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(
				'ADRA Address Autocomplete: could not fetch suggestions.',
				error
			);

			return [];
		}

		const results: Suggestion[] = [];

		for (const { placePrediction } of suggestions) {
			if (placePrediction) {
				this.predictions.set(placePrediction.placeId, placePrediction);
				results.push(toSuggestion(placePrediction));
			}
		}

		return results;
	}

	/**
	 * Fetches the address of a suggestion returned by search() in the current session.
	 *
	 * @param id Suggestion ID (the Google place ID).
	 * @return Place data, or null if the ID is unknown or the request failed (the error is logged).
	 */
	async details(id: string): Promise<PlaceData | null> {
		const prediction = this.predictions.get(id);

		if (!prediction) {
			return null;
		}

		// toPlace() carries the session token, so this request is billed as part of the session.
		const place = prediction.toPlace();

		try {
			await place.fetchFields({ fields: PLACE_FIELDS });
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error(
				'ADRA Address Autocomplete: could not fetch the address.',
				error
			);

			return null;
		}

		// Fetching details ends the session; the next search must start a new one.
		this.sessionToken = undefined;
		this.predictions.clear();

		return toPlaceData(place);
	}
}
