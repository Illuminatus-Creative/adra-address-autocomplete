// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlacesApi } from '../engine/places-client';
import { checkKey, explainError } from './key-check';

const site = 'https://client.example/*';

function api(fetchAutocompleteSuggestions: () => Promise<unknown>): PlacesApi {
	return {
		AutocompleteSessionToken: class {},
		AutocompleteSuggestion: { fetchAutocompleteSuggestions },
	} as unknown as PlacesApi;
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	delete window.gm_authFailure;
	vi.useRealTimers();
});

describe('explainError', () => {
	it.each([
		['RefererNotAllowedMapError', 'Add https://client.example/*'],
		[
			'PERMISSION_DENIED: Requests from referer https://x are blocked.',
			'Add https://client.example/*',
		],
		['BillingNotEnabledMapError', 'Billing is off'],
		[
			'Places API (New) has not been used in project 123 before or it is disabled.',
			'Places API (New) is not enabled',
		],
		['API key not valid. Please pass a valid API key.', 'not valid'],
	])('explains "%s"', (error, expected) => {
		expect(explainError(error, site)).toContain(expected);
	});

	it('passes unrecognised errors through', () => {
		expect(explainError('Something odd', site)).toBe(
			'Google rejected the request: Something odd'
		);
	});
});

describe('checkKey', () => {
	it('reports success with the number of suggestions', async () => {
		const result = checkKey(
			async () => api(async () => ({ suggestions: [1, 2, 3] })),
			site
		);

		await expect(result).resolves.toEqual({
			ok: true,
			message: 'The key works. Google returned 3 suggestions.',
		});
	});

	it('explains a rejected request', async () => {
		const result = checkKey(
			async () =>
				api(() =>
					Promise.reject(new Error('BillingNotEnabledMapError'))
				),
			site
		);

		await expect(result).resolves.toMatchObject({
			ok: false,
			message: expect.stringContaining('Billing is off'),
		});
	});

	it('reports Google’s auth failure callback', async () => {
		const result = checkKey(() => new Promise(() => {}), site);

		window.gm_authFailure!();

		await expect(result).resolves.toMatchObject({
			ok: false,
			message: expect.stringContaining('Google rejected the key'),
		});
	});

	it('gives up when Google never loads', async () => {
		const result = checkKey(() => new Promise(() => {}), site, 1000);

		await vi.advanceTimersByTimeAsync(1000);

		await expect(result).resolves.toMatchObject({
			ok: false,
			message: expect.stringContaining('Google Maps did not load'),
		});
	});
});
