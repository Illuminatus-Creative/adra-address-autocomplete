/**
 * Waits for the Maps JavaScript API and loads the Places library.
 *
 * The plugin loads Google with `loading=async&callback=adraAaGoogleReady`; that callback (added
 * inline before the Google script) dispatches GOOGLE_READY_EVENT. When another plugin loads
 * Google instead, its callback isn't ours, so the page's load event is the fallback: async
 * scripts in the page have run by then.
 */

import type { PlacesApi } from './places-client';

export const GOOGLE_READY_EVENT = 'adra-aa:google-ready';

let placesApi: Promise<PlacesApi> | undefined;

function mapsReady(): boolean {
	return (
		typeof google !== 'undefined' &&
		typeof google.maps?.importLibrary === 'function'
	);
}

/**
 * Resolves the Places library, loading it once per page.
 */
export function loadPlacesApi(): Promise<PlacesApi> {
	placesApi ??= new Promise<void>((resolve) => {
		if (mapsReady()) {
			resolve();
			return;
		}

		document.addEventListener(GOOGLE_READY_EVENT, () => resolve(), {
			once: true,
		});

		if (document.readyState !== 'complete') {
			window.addEventListener(
				'load',
				() => {
					if (mapsReady()) {
						resolve();
					}
				},
				{ once: true }
			);
		}
	}).then(
		() =>
			google.maps.importLibrary(
				'places'
			) as Promise<google.maps.PlacesLibrary>
	);

	return placesApi;
}
