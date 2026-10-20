/**
 * Settings page: the "Test key" button.
 */

import { __ } from '@wordpress/i18n';

import { loadPlacesApi } from '../engine/google-ready';
import { checkKey } from './key-check';

const button = document.getElementById('adra-aa-test-key');
const result = document.getElementById('adra-aa-test-key-result');

button?.addEventListener('click', async () => {
	if (!(button instanceof HTMLButtonElement) || !result) {
		return;
	}

	button.disabled = true;
	result.className = 'notice inline';
	result.textContent = __('Testing…', 'adra-address-autocomplete');

	const { ok, message } = await checkKey(
		loadPlacesApi,
		`${window.location.origin}/*`
	);
	const paragraph = document.createElement('p');

	paragraph.textContent = message;
	result.className = `notice inline ${ok ? 'notice-success' : 'notice-error'}`;
	result.replaceChildren(paragraph);
	button.disabled = false;
});
