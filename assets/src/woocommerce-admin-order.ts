/**
 * Admin order screen bundle.
 */

import './ui/dropdown.css';

import { createAdminOrderAdapter } from './adapters/woocommerce-admin-order';
import type { JQueryLike } from './adapters/woocommerce-admin-order';
import type { WooCommerceStates } from './adapters/woocommerce-state';
import { loadPlacesApi } from './engine/google-ready';
import { PlacesClient } from './engine/places-client';

declare global {
	interface Window {
		adraAaWooCommerceAdmin?: {
			poweredBy: string;
			googleLogoUrl: string;
		};
		/** WooCommerce's order screen settings; `countries` is its states, as a JSON string. */
		woocommerce_admin_meta_boxes_order?: { countries?: string };
	}
}

/**
 * WooCommerce's states for the store's countries, from the data its own order script uses.
 */
function states(): WooCommerceStates {
	const json = window.woocommerce_admin_meta_boxes_order?.countries;

	try {
		return json ? JSON.parse(json.replace(/&quot;/g, '"')) : {};
	} catch {
		return {};
	}
}

document.addEventListener('DOMContentLoaded', () => {
	const jQuery = (window as unknown as { jQuery?: JQueryLike }).jQuery;
	const settings = window.adraAaWooCommerceAdmin;

	if (!jQuery) {
		return;
	}

	createAdminOrderAdapter(
		new PlacesClient(loadPlacesApi),
		jQuery,
		states(),
		settings && {
			label: settings.poweredBy,
			logoUrl: settings.googleLogoUrl,
		}
	).init();
});
