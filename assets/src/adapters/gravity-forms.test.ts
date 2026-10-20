// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlaceData, Suggestion } from '../engine/types';
import { createGravityFormsAdapter } from './gravity-forms';

function fixture(name: string): PlaceData {
	return JSON.parse(
		readFileSync(
			join(__dirname, `../../../tests/fixtures/places/${name}.json`),
			'utf8'
		)
	).place;
}

const suggestion: Suggestion = {
	id: 'place-1',
	text: '1600 Amphitheatre Pkwy',
	mainText: '1600 Amphitheatre Pkwy',
	secondaryText: 'Mountain View, CA, USA',
	matches: [],
};

/* Markup in the shape Gravity Forms 3.1 renders for form 1, Address field 5. */
function internationalField(): string {
	return `
		<form id="gform_1">
			<input type="text" id="input_1_5_1" name="input_5.1">
			<input type="text" id="input_1_5_2" name="input_5.2">
			<input type="text" id="input_1_5_3" name="input_5.3">
			<input type="text" id="input_1_5_4" name="input_5.4">
			<input type="text" id="input_1_5_5" name="input_5.5">
			<select id="input_1_5_6" name="input_5.6">
				<option value=""></option>
				<option value="CA">Canada</option>
				<option value="DE">Germany</option>
				<option value="US">United States</option>
			</select>
			<input type="hidden" name="adra_aa_selected_5" class="adra-aa-selected" value="">
		</form>`;
}

function usField(): string {
	return `
		<form id="gform_1">
			<input type="text" id="input_1_5_1" name="input_5.1">
			<input type="text" id="input_1_5_2" name="input_5.2">
			<input type="text" id="input_1_5_3" name="input_5.3">
			<select id="input_1_5_4" name="input_5.4">
				<option value=""></option>
				<option value="Arizona">Arizona</option>
				<option value="California">California</option>
			</select>
			<input type="text" id="input_1_5_5" name="input_5.5">
			<input type="hidden" id="input_1_5_6" name="input_5.6" value="United States">
			<input type="hidden" name="adra_aa_selected_5" class="adra-aa-selected" value="">
		</form>`;
}

const value = (n: number) =>
	(document.getElementById(`input_1_5_${n}`) as HTMLInputElement).value;

function client(place: PlaceData) {
	return {
		search: vi.fn(async () => [suggestion]),
		details: vi.fn(async () => place),
	};
}

async function selectFirstSuggestion() {
	const input = document.getElementById('input_1_5_1') as HTMLInputElement;

	input.value = '1600 amph';
	input.dispatchEvent(new Event('input'));
	await vi.advanceTimersByTimeAsync(200);

	document
		.querySelector('.adra-aa-suggestion')!
		.dispatchEvent(
			new MouseEvent('mousedown', { bubbles: true, cancelable: true })
		);
	await vi.runAllTimersAsync();
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	document.body.replaceChildren();
	vi.useRealTimers();
});

describe('Gravity Forms adapter', () => {
	it('fills an International address field and records what it filled', async () => {
		document.body.innerHTML = internationalField();
		const changed: string[] = [];
		document
			.getElementById('gform_1')!
			.addEventListener('change', (event) =>
				changed.push((event.target as HTMLElement).id)
			);

		createGravityFormsAdapter(client(fixture('us-mountain-view'))).init({
			formId: 1,
			fieldId: 5,
		});
		await selectFirstSuggestion();

		expect([1, 2, 3, 4, 5, 6].map(value)).toEqual([
			'1600 Amphitheatre Pkwy',
			'Google Building 41',
			'Mountain View',
			'California',
			'94043-1351',
			'US',
		]);
		expect(changed).toEqual(
			expect.arrayContaining(['input_1_5_1', 'input_1_5_6'])
		);

		const selected = JSON.parse(
			(
				document.querySelector(
					'[name="adra_aa_selected_5"]'
				) as HTMLInputElement
			).value
		);

		expect(selected).toEqual({
			placeId: 'ChIJiSSC8QK6j4AR98Thup8mqTc',
			address: {
				address_1: '1600 Amphitheatre Pkwy',
				address_2: 'Google Building 41',
				city: 'Mountain View',
				state: 'California',
				postcode: '94043-1351',
				country: 'US',
			},
		});
	});

	it('picks the state option on a US field and leaves the hidden country alone', async () => {
		document.body.innerHTML = usField();

		createGravityFormsAdapter(client(fixture('us-mountain-view'))).init({
			formId: 1,
			fieldId: 5,
			regionCodes: ['us'],
		});
		await selectFirstSuggestion();

		expect(value(4)).toBe('California');
		expect(value(6)).toBe('United States');
	});

	it('passes the field’s region codes to the search', async () => {
		document.body.innerHTML = usField();
		const places = client(fixture('us-mountain-view'));

		createGravityFormsAdapter(places).init({
			formId: 1,
			fieldId: 5,
			regionCodes: ['us'],
		});
		await selectFirstSuggestion();

		expect(places.search).toHaveBeenCalledWith('1600 amph', {
			regionCodes: ['us'],
		});
	});

	it('leaves the country alone when the form doesn’t offer it', async () => {
		document.body.innerHTML = internationalField();
		(document.getElementById('input_1_5_6') as HTMLSelectElement).value =
			'CA';

		createGravityFormsAdapter(client(fixture('jp-tokyo'))).init({
			formId: 1,
			fieldId: 5,
		});
		await selectFirstSuggestion();

		expect(value(6)).toBe('CA');
		expect(value(3)).toBe('Minato City');
	});

	it('does nothing when Google returns no details', async () => {
		document.body.innerHTML = internationalField();
		const places = client(fixture('us-mountain-view'));
		places.details.mockResolvedValueOnce(null as unknown as PlaceData);

		createGravityFormsAdapter(places).init({ formId: 1, fieldId: 5 });
		await selectFirstSuggestion();

		expect(value(3)).toBe('');
		expect(
			(
				document.querySelector(
					'[name="adra_aa_selected_5"]'
				) as HTMLInputElement
			).value
		).toBe('');
	});

	it('attaches once per input and re-attaches when Gravity Forms replaces the markup', () => {
		document.body.innerHTML = internationalField();
		const adapter = createGravityFormsAdapter(
			client(fixture('us-mountain-view'))
		);

		adapter.init({ formId: 1, fieldId: 5 });
		adapter.init({ formId: 1, fieldId: 5 });
		expect(document.querySelectorAll('.adra-aa-suggestions')).toHaveLength(
			1
		);

		document.getElementById('gform_1')!.outerHTML = internationalField();
		adapter.init({ formId: 1, fieldId: 5 });

		expect(document.querySelectorAll('.adra-aa-suggestions')).toHaveLength(
			1
		);
		expect(
			document.getElementById('input_1_5_1')!.getAttribute('role')
		).toBe('combobox');
	});

	it('skips a field whose street input is hidden or missing', () => {
		document.body.innerHTML = '<form id="gform_1"></form>';

		createGravityFormsAdapter(client(fixture('us-mountain-view'))).init({
			formId: 1,
			fieldId: 5,
		});

		expect(document.querySelector('.adra-aa-suggestions')).toBeNull();
	});
});
