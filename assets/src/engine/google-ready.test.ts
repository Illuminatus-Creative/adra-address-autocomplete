// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const places = { name: 'places library' };

describe('loadPlacesApi', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('loads the Places library at once when Google is already on the page', async () => {
		const importLibrary = vi.fn().mockResolvedValue(places);
		vi.stubGlobal('google', { maps: { importLibrary } });

		const { loadPlacesApi } = await import('./google-ready');

		await expect(loadPlacesApi()).resolves.toBe(places);
		await loadPlacesApi();
		expect(importLibrary).toHaveBeenCalledExactlyOnceWith('places');
	});

	it('waits for the ready event when Google has not loaded yet', async () => {
		const { GOOGLE_READY_EVENT, loadPlacesApi } =
			await import('./google-ready');
		const pending = loadPlacesApi();
		const importLibrary = vi.fn().mockResolvedValue(places);

		vi.stubGlobal('google', { maps: { importLibrary } });
		document.dispatchEvent(new Event(GOOGLE_READY_EVENT));

		await expect(pending).resolves.toBe(places);
	});

	it('falls back to the page load event when another plugin loaded Google', async () => {
		Object.defineProperty(document, 'readyState', {
			configurable: true,
			get: () => 'loading',
		});

		const { loadPlacesApi } = await import('./google-ready');
		const pending = loadPlacesApi();
		const importLibrary = vi.fn().mockResolvedValue(places);

		vi.stubGlobal('google', { maps: { importLibrary } });
		window.dispatchEvent(new Event('load'));

		await expect(pending).resolves.toBe(places);
		// @ts-expect-error -- Removes the override, restoring jsdom's own readyState.
		delete document.readyState;
	});
});
