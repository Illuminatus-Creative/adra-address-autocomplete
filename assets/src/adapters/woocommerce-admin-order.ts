/**
 * Admin order screen adapter: WooCommerce's address autocomplete doesn't run on the order edit
 * screen, so this attaches our own dropdown to the billing and shipping street inputs and fills
 * the address.
 *
 * WooCommerce's order script rebuilds the state field (select or text input) when the country
 * changes, and does it synchronously in the country's jQuery change handler. So the country is
 * set through jQuery first, then the state field is looked up again and filled.
 */

import { parsePlace } from '../engine/parse-place';
import type { PlacesClient } from '../engine/places-client';
import type { ParsedPlace } from '../engine/types';
import { SuggestionDropdown } from '../ui/dropdown';
import type { DropdownOptions } from '../ui/dropdown';
import { wooCommerceState } from './woocommerce-state';
import type { WooCommerceStates } from './woocommerce-state';

/** The part of jQuery used here: WooCommerce and selectWoo listen for jQuery events. */
export type JQueryLike = (element: Element) => {
	val: (value: string) => unknown;
	trigger: (event: string) => unknown;
};

type Client = Pick<PlacesClient, 'search' | 'details'>;
type AddressType = 'billing' | 'shipping';

/** The order screen's street input is half a column wide; suggestions need more room. */
const MIN_WIDTH = 360;

/** Places API (New) accepts up to 15 region codes. */
const MAX_REGION_CODES = 15;

const TYPES: AddressType[] = ['billing', 'shipping'];

function field(type: AddressType, name: string): HTMLElement | null {
	return document.getElementById(`_${type}_${name}`);
}

/**
 * Country codes to limit suggestions to: the codes in the address's country list when there are
 * few enough for Google, otherwise none (no limit).
 *
 * @param type Address type.
 */
export function regionCodesFor(type: AddressType): string[] {
	const select = field(type, 'country');

	if (!(select instanceof HTMLSelectElement)) {
		return [];
	}

	const codes = Array.from(select.options)
		.map((option) => option.value)
		.filter(Boolean);

	return codes.length <= MAX_REGION_CODES ? codes : [];
}

export function createAdminOrderAdapter(
	client: Client,
	jQuery: JQueryLike,
	states: WooCommerceStates,
	attribution?: DropdownOptions['attribution']
) {
	function setValue(element: HTMLElement | null, value: string): void {
		if (
			element instanceof HTMLInputElement ||
			element instanceof HTMLSelectElement
		) {
			jQuery(element).val(value);
			jQuery(element).trigger('change');
		}
	}

	/**
	 * Sets the country, if the store's list has it. Returns whether the field now holds the
	 * place's country, so the state can be matched against the right list.
	 *
	 * @param type  Address type.
	 * @param place Parsed place.
	 */
	function fillCountry(type: AddressType, place: ParsedPlace): boolean {
		const country = field(type, 'country');

		if (!(country instanceof HTMLSelectElement)) {
			return false;
		}

		if (country.value !== place.country) {
			const available = Array.from(country.options).some(
				(option) => option.value === place.country
			);

			if (!available) {
				return false;
			}

			setValue(country, place.country);
		}

		return true;
	}

	async function fill(type: AddressType, suggestionId: string) {
		const data = await client.details(suggestionId);

		if (!data) {
			return;
		}

		const place = parsePlace(data);

		setValue(field(type, 'address_1'), place.address_1);
		setValue(field(type, 'address_2'), place.address_2);
		setValue(field(type, 'city'), place.city);
		setValue(field(type, 'postcode'), place.postcode);

		// A country the store doesn't sell to is left for staff to deal with, state included.
		if (fillCountry(type, place)) {
			// Looked up after the country: WooCommerce has replaced the element by now.
			setValue(field(type, 'state'), wooCommerceState(place, states));
		}
	}

	/**
	 * Attaches to the billing and shipping street inputs present on the page.
	 */
	function init(): void {
		for (const type of TYPES) {
			const input = field(type, 'address_1');

			if (!(input instanceof HTMLInputElement)) {
				continue;
			}

			SuggestionDropdown.attach(input, {
				search: (query) =>
					client.search(query, { regionCodes: regionCodesFor(type) }),
				onSelect: (suggestion) => fill(type, suggestion.id),
				attribution,
				minWidth: MIN_WIDTH,
			});
		}
	}

	return { init };
}
