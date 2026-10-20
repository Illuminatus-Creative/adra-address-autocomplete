/**
 * Tests the saved Google key from the browser, where Google applies the key's website
 * restrictions, and explains the usual setup mistakes in plain terms.
 */

import { __, sprintf } from '@wordpress/i18n';

import type { PlacesApi } from '../engine/places-client';

export interface KeyCheckResult {
	ok: boolean;
	message: string;
}

declare global {
	interface Window {
		/** Called by Google Maps when it rejects the key. */
		gm_authFailure?: () => void;
	}
}

/**
 * Turns Google's error text into the fix the user needs to make.
 *
 * @param error   Error message from Google.
 * @param siteUrl Address pattern to add to the key's website restrictions.
 */
export function explainError(error: string, siteUrl: string): string {
	if (/referer|referrer/i.test(error)) {
		return sprintf(
			/* translators: %s: this site's address pattern. */
			__(
				'Google refused this site. Add %s under the key’s Website restrictions.',
				'adra-address-autocomplete'
			),
			siteUrl
		);
	}

	if (/billing/i.test(error)) {
		return __(
			'Billing is off for the key’s Google Cloud project. Turn it on.',
			'adra-address-autocomplete'
		);
	}

	if (
		/not been used|disabled|not enabled|SERVICE_DISABLED|blocked/i.test(
			error
		)
	) {
		return __(
			'The Places API (New) is not enabled for this key. Enable it in the Google Cloud project, and allow it under the key’s API restrictions.',
			'adra-address-autocomplete'
		);
	}

	if (/api key not valid|invalid/i.test(error)) {
		return __(
			'Google says the key is not valid. Copy it again from Google Cloud.',
			'adra-address-autocomplete'
		);
	}

	return sprintf(
		/* translators: %s: error message from Google. */
		__('Google rejected the request: %s', 'adra-address-autocomplete'),
		error
	);
}

/**
 * Runs one search with the loaded key.
 *
 * @param loadApi   Resolves the Places library.
 * @param siteUrl   Address pattern to suggest for the key's website restrictions.
 * @param timeoutMs How long to wait for Google before giving up.
 */
export function checkKey(
	loadApi: () => Promise<PlacesApi>,
	siteUrl: string,
	timeoutMs = 15000
): Promise<KeyCheckResult> {
	return new Promise((resolve) => {
		const timer = setTimeout(
			() =>
				resolve({
					ok: false,
					message: __(
						'Google Maps did not load. Check that nothing on this site (an ad blocker, a security plugin, a Content Security Policy) blocks maps.googleapis.com.',
						'adra-address-autocomplete'
					),
				}),
			timeoutMs
		);

		const finish = (result: KeyCheckResult) => {
			clearTimeout(timer);
			resolve(result);
		};

		// Google reports key, referrer and billing problems here, with details only in the console.
		window.gm_authFailure = () =>
			finish({
				ok: false,
				message: sprintf(
					/* translators: %s: this site's address pattern. */
					__(
						'Google rejected the key. Check that it is correct, that %s is allowed under its Website restrictions, and that billing is on. The browser console has Google’s exact reason.',
						'adra-address-autocomplete'
					),
					siteUrl
				),
			});

		loadApi()
			.then((api) =>
				api.AutocompleteSuggestion.fetchAutocompleteSuggestions({
					input: '10 Downing Street',
					sessionToken: new api.AutocompleteSessionToken(),
				})
			)
			.then(({ suggestions }) =>
				finish({
					ok: true,
					message: sprintf(
						/* translators: %d: number of suggestions. */
						__(
							'The key works. Google returned %d suggestions.',
							'adra-address-autocomplete'
						),
						suggestions.length
					),
				})
			)
			.catch((error: unknown) =>
				finish({
					ok: false,
					message: explainError(
						error instanceof Error ? error.message : String(error),
						siteUrl
					),
				})
			);
	});
}
