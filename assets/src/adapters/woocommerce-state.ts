/**
 * WooCommerce's state value for a place.
 *
 * WooCommerce distinguishes three cases per country (see woocommerce/i18n/states.php):
 * a list of states (a select; the value is a state code), an empty list (no state field), and
 * no entry at all (a free-text "State / County" field).
 */

import { matchRegion, optionsFromMap } from '../engine/match-option';
import type { ParsedPlace } from '../engine/types';

export type WooCommerceStates = Record<
	string,
	Record<string, string> | [] | null | undefined
>;

/**
 * @param place  Parsed place.
 * @param states WooCommerce's states for all countries, as WC()->countries->get_states() returns them.
 * @return A state code, free text, or an empty string when the state should be left blank.
 */
export function wooCommerceState(
	place: ParsedPlace,
	states: WooCommerceStates
): string {
	const countryStates = states[place.countryCode];

	if (countryStates === null || countryStates === undefined) {
		return place.region;
	}

	if (Array.isArray(countryStates)) {
		return '';
	}

	return matchRegion(place, optionsFromMap(countryStates)) ?? '';
}
