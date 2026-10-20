/**
 * When to show the soft warning (a one-time confirm before submitting).
 */

import { compareAddress, normalizePostcode, normalizeText } from './match';
import type { Address } from './match';

export interface Selection {
	placeId: string;
	address: Address;
}

/**
 * Identifies an address regardless of formatting, so a confirmation only covers that address.
 *
 * @param address Address fields.
 */
export function addressKey(address: Address): string {
	return [
		normalizeText(address.address_1),
		normalizeText(address.city),
		normalizeText(address.state),
		normalizeText(address.country),
		normalizePostcode(address.postcode),
	].join('|');
}

/**
 * Whether to stop this submit and ask the person to check the address.
 *
 * No warning when the address still matches the selected suggestion, when it was already on the
 * form when the page loaded (a saved address), or when the person already confirmed it.
 *
 * @param args           Current state.
 * @param args.selection Suggestion selected for this address, if any.
 * @param args.current   Address about to be submitted.
 * @param args.initial   Address on the form when the page loaded.
 * @param args.confirmed Keys of addresses the person already confirmed.
 */
export function needsWarning({
	selection,
	current,
	initial,
	confirmed,
}: {
	selection?: Selection | null;
	current: Address;
	initial?: Address | null;
	confirmed: Set<string>;
}): boolean {
	if (!normalizeText(current.address_1)) {
		return false;
	}

	if (
		selection &&
		compareAddress(selection.address, current).status === 'verified'
	) {
		return false;
	}

	if (initial && addressKey(initial) === addressKey(current)) {
		return false;
	}

	return !confirmed.has(addressKey(current));
}
