import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_PRIMARY_TYPES, PlacesClient } from './places-client';
import type { PlacesApi } from './places-client';

class FakeToken {
	static created = 0;
	readonly n = ++FakeToken.created;
}

function fakePlace(id: string) {
	return {
		id,
		formattedAddress: '1 Main St, Springfield',
		adrFormatAddress: '<span class="street-address">1 Main St</span>',
		addressComponents: [
			{
				longText: 'United States',
				shortText: 'US',
				types: ['country', 'political'],
			},
			{ longText: null, shortText: null, types: ['postal_code'] },
		],
		location: { lat: () => 39.8, lng: () => -89.6 },
		fetchFields: vi.fn().mockResolvedValue(undefined),
	};
}

function fakePrediction(placeId: string) {
	const place = fakePlace(placeId);

	return {
		placeId,
		text: {
			text: `${placeId} Main St, Springfield`,
			matches: [{ startOffset: 0, endOffset: 4 }],
		},
		mainText: { text: `${placeId} Main St` },
		secondaryText: { text: 'Springfield' },
		toPlace: vi.fn(() => place),
		place,
	};
}

function fakeApi(predictions = [fakePrediction('p1'), fakePrediction('p2')]) {
	const fetchAutocompleteSuggestions = vi.fn().mockResolvedValue({
		suggestions: [
			...predictions.map((placePrediction) => ({ placePrediction })),
			{ placePrediction: null, queryPrediction: {} },
		],
	});

	const api = {
		AutocompleteSessionToken: FakeToken,
		AutocompleteSuggestion: { fetchAutocompleteSuggestions },
	} as unknown as PlacesApi;

	return { api, fetchAutocompleteSuggestions, predictions };
}

describe('PlacesClient.search', () => {
	it('maps place predictions to suggestions and skips query predictions', async () => {
		const { api } = fakeApi();
		const results = await new PlacesClient(async () => api).search('main');

		expect(results).toEqual([
			{
				id: 'p1',
				text: 'p1 Main St, Springfield',
				mainText: 'p1 Main St',
				secondaryText: 'Springfield',
				matches: [{ offset: 0, length: 4 }],
			},
			expect.objectContaining({ id: 'p2' }),
		]);
	});

	it('sends the default address types and caps Google’s list limits', async () => {
		const { api, fetchAutocompleteSuggestions } = fakeApi();
		const client = new PlacesClient(async () => api);
		const regions = Array.from({ length: 20 }, (_, i) => `R${i}`);

		await client.search('main', { regionCodes: ['', ...regions] });
		await client.search('main', { primaryTypes: [] });

		const [first] = fetchAutocompleteSuggestions.mock.calls[0]!;
		const [second] = fetchAutocompleteSuggestions.mock.calls[1]!;

		expect(first.includedRegionCodes).toEqual(regions.slice(0, 15));
		expect(first.includedPrimaryTypes).toEqual(DEFAULT_PRIMARY_TYPES);
		expect(second).not.toHaveProperty('includedRegionCodes');
		expect(second).not.toHaveProperty('includedPrimaryTypes');
	});

	it('reuses one session token until details are fetched', async () => {
		const { api, fetchAutocompleteSuggestions } = fakeApi();
		const client = new PlacesClient(async () => api);

		await client.search('mai');
		await client.search('main');
		await client.details('p1');
		await client.search('elm');

		const tokens = fetchAutocompleteSuggestions.mock.calls.map(
			([request]) => request.sessionToken
		);

		expect(tokens[0]).toBe(tokens[1]);
		expect(tokens[2]).not.toBe(tokens[1]);
	});

	it('returns an empty list and logs when Google rejects the request', async () => {
		const { api, fetchAutocompleteSuggestions } = fakeApi();
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});

		fetchAutocompleteSuggestions.mockRejectedValueOnce(
			new Error('API not enabled')
		);

		expect(await new PlacesClient(async () => api).search('main')).toEqual(
			[]
		);
		expect(log).toHaveBeenCalledOnce();
	});
});

describe('PlacesClient.details', () => {
	it('fetches through the prediction so the request stays in the session', async () => {
		const { api, predictions } = fakeApi();
		const client = new PlacesClient(async () => api);

		await client.search('main');
		const place = await client.details('p2');

		expect(predictions[1]!.toPlace).toHaveBeenCalledOnce();
		expect(predictions[1]!.place.fetchFields).toHaveBeenCalledWith({
			fields: [
				'id',
				'addressComponents',
				'adrFormatAddress',
				'formattedAddress',
				'location',
			],
		});
		expect(place).toEqual({
			id: 'p2',
			formattedAddress: '1 Main St, Springfield',
			adrFormatAddress: '<span class="street-address">1 Main St</span>',
			addressComponents: [
				{
					longText: 'United States',
					shortText: 'US',
					types: ['country', 'political'],
				},
				{ longText: '', shortText: '', types: ['postal_code'] },
			],
			location: { lat: 39.8, lng: -89.6 },
		});
	});

	it('returns null for an unknown or spent suggestion ID', async () => {
		const { api } = fakeApi();
		const client = new PlacesClient(async () => api);

		expect(await client.details('p1')).toBeNull();

		await client.search('main');
		await client.details('p1');

		expect(await client.details('p2')).toBeNull();
	});

	it('returns null and logs when fetching fails, keeping the session', async () => {
		const { api, predictions, fetchAutocompleteSuggestions } = fakeApi();
		const client = new PlacesClient(async () => api);
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});

		await client.search('main');
		predictions[0]!.place.fetchFields.mockRejectedValueOnce(
			new Error('quota')
		);

		expect(await client.details('p1')).toBeNull();
		expect(log).toHaveBeenCalledOnce();

		await client.search('main');
		const tokens = fetchAutocompleteSuggestions.mock.calls.map(
			([r]) => r.sessionToken
		);
		expect(tokens[1]).toBe(tokens[0]);
	});
});
