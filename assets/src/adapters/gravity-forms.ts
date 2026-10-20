/**
 * Gravity Forms adapter: attaches the suggestion dropdown to an Address field's street input and
 * fills the field's inputs from the selected place.
 */

import type { Address } from '../address/match';
import { matchOption, matchRegion } from '../engine/match-option';
import { parsePlace } from '../engine/parse-place';
import type { PlacesClient } from '../engine/places-client';
import type { Option, ParsedPlace } from '../engine/types';
import { SuggestionDropdown } from '../ui/dropdown';
import type { DropdownOptions } from '../ui/dropdown';

export interface FieldConfig {
	formId: number;
	fieldId: number;
	/** ISO 3166-1 alpha-2 codes to limit suggestions to. Empty for no limit. */
	regionCodes?: string[];
}

type FieldName = keyof Required<Address>;
type Client = Pick<PlacesClient, 'search' | 'details'>;
type FieldElement = HTMLInputElement | HTMLSelectElement;

/* Gravity Forms' Address sub-input numbers. */
const INPUTS: Record<FieldName, number> = {
	address_1: 1,
	address_2: 2,
	city: 3,
	state: 4,
	postcode: 5,
	country: 6,
};

function optionsOf(select: HTMLSelectElement): Option[] {
	return Array.from(select.options)
		.filter((option) => option.value !== '')
		.map((option) => ({ value: option.value, label: option.text }));
}

/*
 * Gravity Forms puts hidden State and Country inputs (US and Canadian address types) in its
 * tamper check, so changing them makes the submission fail. They are left alone.
 */
function isHidden(element: FieldElement): boolean {
	return element instanceof HTMLInputElement && element.type === 'hidden';
}

function setValue(element: FieldElement | null, value: string): void {
	if (!element || isHidden(element)) {
		return;
	}

	element.value = value;
	element.dispatchEvent(new Event('input', { bubbles: true }));
	element.dispatchEvent(new Event('change', { bubbles: true }));
}

export function createGravityFormsAdapter(
	client: Client,
	attribution?: DropdownOptions['attribution']
) {
	const attached = new Map<
		string,
		{ input: HTMLInputElement; dropdown: SuggestionDropdown }
	>();

	function element(
		config: FieldConfig,
		name: FieldName
	): FieldElement | null {
		const found = document.getElementById(
			`input_${config.formId}_${config.fieldId}_${INPUTS[name]}`
		);

		return found instanceof HTMLInputElement ||
			found instanceof HTMLSelectElement
			? found
			: null;
	}

	function fillState(config: FieldConfig, place: ParsedPlace): void {
		const state = element(config, 'state');

		if (state instanceof HTMLSelectElement) {
			// Clear rather than keep a state that belongs to a previous address.
			setValue(state, matchRegion(place, optionsOf(state)) ?? '');
		} else {
			setValue(state, place.region);
		}
	}

	function fillCountry(config: FieldConfig, place: ParsedPlace): void {
		const country = element(config, 'country');

		if (!(country instanceof HTMLSelectElement)) {
			return;
		}

		// Option values are codes since Gravity Forms 3.0.3; the name covers filtered lists.
		const value = matchOption(
			[place.country, place.countryName],
			optionsOf(country)
		);

		// A country missing from the form's list is left as the person chose it.
		if (value !== undefined) {
			setValue(country, value);
		}
	}

	function rememberSelection(config: FieldConfig, placeId: string): void {
		const hidden = document.querySelector<HTMLInputElement>(
			`#gform_${config.formId} input[name="adra_aa_selected_${config.fieldId}"]`
		);

		if (!hidden) {
			return;
		}

		const address = {} as Record<FieldName, string>;

		for (const name of Object.keys(INPUTS) as FieldName[]) {
			address[name] = element(config, name)?.value ?? '';
		}

		hidden.value = JSON.stringify({ placeId, address });
	}

	async function fill(
		config: FieldConfig,
		suggestionId: string
	): Promise<void> {
		const data = await client.details(suggestionId);

		if (!data) {
			return;
		}

		const place = parsePlace(data);

		setValue(element(config, 'address_1'), place.address_1);
		setValue(element(config, 'address_2'), place.address_2);
		setValue(element(config, 'city'), place.city);
		setValue(element(config, 'postcode'), place.postcode);
		fillCountry(config, place);
		fillState(config, place);

		// Recorded as the form now holds it, so the server compares like with like.
		rememberSelection(config, place.placeId);
	}

	/**
	 * Attaches autocomplete to a field. Safe to call on every render: it skips a field already
	 * attached to the same input, and re-attaches when Gravity Forms has replaced the markup.
	 *
	 * @param config Field settings from the server.
	 */
	function init(config: FieldConfig): void {
		const key = `${config.formId}-${config.fieldId}`;
		const input = element(config, 'address_1');
		const existing = attached.get(key);

		if (!(input instanceof HTMLInputElement) || existing?.input === input) {
			return;
		}

		existing?.dropdown.destroy();
		attached.delete(key);

		const dropdown = SuggestionDropdown.attach(input, {
			search: (query) =>
				client.search(query, { regionCodes: config.regionCodes ?? [] }),
			onSelect: (suggestion) => fill(config, suggestion.id),
			attribution,
		});

		if (dropdown) {
			attached.set(key, { input, dropdown });
		}
	}

	return { init };
}
