/**
 * WooCommerce bundle.
 *
 * Registers the provider as soon as it loads, which is before WooCommerce picks a provider on
 * DOMContentLoaded. Address status and the soft warning start once the page has loaded, when
 * WooCommerce's checkout (classic form or block stores) is in place. My Account has neither.
 */

import {
	SelectionTracker,
	initBlockCheckout,
	initClassicCheckout,
} from './adapters/woocommerce-checkout';
import type {
	AddressType,
	CheckoutSettings,
} from './adapters/woocommerce-checkout';
import { createWooCommerceProvider } from './adapters/woocommerce-provider';
import type { ProviderSettings } from './adapters/woocommerce-provider';
import { loadPlacesApi } from './engine/google-ready';
import { PlacesClient } from './engine/places-client';

declare global {
	interface Window {
		adraAaWooCommerce?: ProviderSettings & CheckoutSettings;
		wc?: {
			addressAutocomplete?: {
				registerAddressAutocompleteProvider?: (
					provider: object
				) => boolean;
				serverProviders?: Array<{ id: string }>;
				providers?: Record<
					string,
					{ canSearch: (country: string) => boolean }
				>;
			};
			blocksCheckoutEvents?: {
				checkoutEvents: Parameters<typeof initBlockCheckout>[1];
			};
		};
		wp?: { data?: Parameters<typeof initBlockCheckout>[0] };
		jQuery?: Parameters<typeof initClassicCheckout>[1];
	}
}

const settings = window.adraAaWooCommerce;

if (settings) {
	const tracker = new SelectionTracker();

	window.wc?.addressAutocomplete?.registerAddressAutocompleteProvider?.(
		createWooCommerceProvider(
			new PlacesClient(loadPlacesApi),
			settings,
			(type, selection) => tracker.set(type as AddressType, selection)
		)
	);

	const start = () => {
		const form = document.querySelector<HTMLFormElement>('form.checkout');
		const events = window.wc?.blocksCheckoutEvents?.checkoutEvents;
		const wpData = window.wp?.data;

		if (form && window.jQuery) {
			initClassicCheckout(form, window.jQuery, tracker, settings);
		} else if (events && wpData?.select('wc/store/checkout')) {
			initBlockCheckout(wpData, events, tracker, settings);
		}
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', start);
	} else {
		start();
	}
}
