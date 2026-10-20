/**
 * Stand-in for the Maps JavaScript API's Places library, serving the recorded places in
 * tests/fixtures/places/. It answers the plugin's script request, so the real loader (key in the
 * URL, ready callback) still runs. Suggestions are the places whose formatted address contains
 * every word typed, within the requested countries.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { BrowserContext } from '@playwright/test';

const fixtures = join(__dirname, '../../fixtures/places');

export const places = Object.fromEntries(
	readdirSync(fixtures)
		.filter((file) => file.endsWith('.json'))
		.map((file) => [
			file.replace(/\.json$/, ''),
			JSON.parse(readFileSync(join(fixtures, file), 'utf8')).place,
		])
) as Record<string, { id: string; formattedAddress: string }>;

/* Runs in the browser. */
function install(data: unknown[], callback: string | null) {
	type Place = {
		id: string;
		formattedAddress: string;
		addressComponents: Array<{ shortText: string; types: string[] }>;
		location: { lat: number; lng: number };
	};
	const all = data as Place[];
	const normalize = (text: string) =>
		text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
	const countryOf = (place: Place) =>
		place.addressComponents.find((c) => c.types.includes('country'))
			?.shortText;
	const prediction = (place: Place) => {
		const [first = '', ...others] = place.formattedAddress.split(', ');

		return {
			placeId: place.id,
			text: { text: place.formattedAddress, matches: [] },
			mainText: { text: first },
			secondaryText: { text: others.join(', ') },
			toPlace: () => ({
				...place,
				location: {
					lat: () => place.location.lat,
					lng: () => place.location.lng,
				},
				fetchFields: async () => ({}),
			}),
		};
	};

	const requests: unknown[] = [];

	(window as unknown as Record<string, unknown>).adraAaGoogleRequests =
		requests;
	(window as unknown as Record<string, unknown>).google = {
		maps: {
			importLibrary: async () => ({
				AutocompleteSessionToken: class {},
				AutocompleteSuggestion: {
					fetchAutocompleteSuggestions: async (request: {
						input: string;
						includedRegionCodes?: string[];
					}) => {
						requests.push({
							input: request.input,
							includedRegionCodes: request.includedRegionCodes,
						});

						const words = normalize(request.input)
							.split(/[\s,]+/)
							.filter(Boolean);
						const regions = request.includedRegionCodes ?? [];

						return {
							suggestions: all
								.filter(
									(place) =>
										(!regions.length ||
											regions.includes(
												countryOf(place) ?? ''
											)) &&
										words.every((word) =>
											normalize(
												place.formattedAddress
											).includes(word)
										)
								)
								.map((place) => ({
									placePrediction: prediction(place),
								})),
						};
					},
				},
			}),
		},
	};

	if (callback) {
		(window as unknown as Record<string, () => void>)[callback]?.();
	}
}

/**
 * Serves the stand-in for every page in the context, and blocks any other Google request.
 *
 * @param context Browser context.
 */
export async function stubGoogle(context: BrowserContext): Promise<void> {
	await context.route(/googleapis\.com|gstatic\.com/, (route) =>
		route.abort()
	);
	await context.route(/maps\.googleapis\.com\/maps\/api\/js/, (route) => {
		const callback = new URL(route.request().url()).searchParams.get(
			'callback'
		);

		return route.fulfill({
			contentType: 'application/javascript',
			body: `(${install.toString()})(${JSON.stringify(
				Object.values(places)
			)}, ${JSON.stringify(callback)});`,
		});
	});
}
