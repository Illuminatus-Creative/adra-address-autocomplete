/**
 * WooCommerce provider bundle. Registers with WooCommerce's address autocomplete as soon as it
 * loads, which is before WooCommerce picks a provider on DOMContentLoaded.
 */

import { createWooCommerceProvider } from './adapters/woocommerce-provider';
import type { ProviderSettings } from './adapters/woocommerce-provider';
import { loadPlacesApi } from './engine/google-ready';
import { PlacesClient } from './engine/places-client';

declare global {
	interface Window {
		adraAaWooCommerce?: ProviderSettings;
		wc?: {
			addressAutocomplete?: {
				registerAddressAutocompleteProvider: (
					provider: ReturnType<typeof createWooCommerceProvider>
				) => boolean;
			};
		};
	}
}

const settings = window.adraAaWooCommerce;

if (settings) {
	window.wc?.addressAutocomplete?.registerAddressAutocompleteProvider(
		createWooCommerceProvider(new PlacesClient(loadPlacesApi), settings)
	);
}
