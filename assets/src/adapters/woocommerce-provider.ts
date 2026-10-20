/**
 * The browser half of the WooCommerce provider: the object WooCommerce's address autocomplete
 * calls to search and to fetch the selected address. WooCommerce draws the suggestions and fills
 * the fields, setting the country first and the state once the state list has updated.
 */

import { parsePlace } from '../engine/parse-place';
import type { PlacesClient } from '../engine/places-client';
import { wooCommerceState } from './woocommerce-state';
import type { WooCommerceStates } from './woocommerce-state';

export interface ProviderSettings {
	providerId: string;
	states: WooCommerceStates;
}

/** Address fields WooCommerce fills, by its own field names. */
export interface WooCommerceAddress {
	address_1: string;
	address_2: string;
	city: string;
	state: string;
	postcode: string;
	country: string;
}

export interface WooCommerceSuggestion {
	id: string;
	label: string;
	matchedSubstrings: Array<{ offset: number; length: number }>;
}

type Client = Pick<PlacesClient, 'search' | 'details'>;

export function createWooCommerceProvider(
	client: Client,
	settings: ProviderSettings
) {
	return {
		id: settings.providerId,

		/**
		 * Google covers every country. With no country chosen yet, searches are unrestricted.
		 */
		canSearch: (): boolean => true,

		/**
		 * @param query   What the customer has typed (WooCommerce waits for 3 characters).
		 * @param country Country chosen on the form, as an ISO 3166-1 alpha-2 code.
		 */
		async search(
			query: string,
			country: string
		): Promise<WooCommerceSuggestion[]> {
			try {
				const suggestions = await client.search(query, {
					regionCodes: country ? [country] : [],
				});

				return suggestions.map((suggestion) => ({
					id: suggestion.id,
					label: suggestion.text,
					matchedSubstrings: suggestion.matches,
				}));
			} catch (error) {
				// eslint-disable-next-line no-console
				console.error(
					'ADRA Address Autocomplete: search failed.',
					error
				);

				return [];
			}
		},

		/**
		 * @param id Suggestion ID returned by search().
		 * @return The address, or null so WooCommerce leaves the fields alone.
		 */
		async select(id: string): Promise<WooCommerceAddress | null> {
			try {
				const data = await client.details(id);

				if (!data) {
					return null;
				}

				const place = parsePlace(data);

				return {
					address_1: place.address_1,
					address_2: place.address_2,
					city: place.city,
					state: wooCommerceState(place, settings.states),
					postcode: place.postcode,
					country: place.country,
				};
			} catch (error) {
				// eslint-disable-next-line no-console
				console.error(
					'ADRA Address Autocomplete: select failed.',
					error
				);

				return null;
			}
		},
	};
}
