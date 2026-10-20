// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	SelectionTracker,
	activeProviderId,
	initBlockCheckout,
	initClassicCheckout,
} from './woocommerce-checkout';
import type { CheckoutSettings } from './woocommerce-checkout';

const settings: CheckoutSettings = {
	providerId: 'adra-address-autocomplete',
	classicInput: 'adra_aa_selection',
	storeApiNamespace: 'adra-address-autocomplete',
	softWarning: { enabled: true, message: 'Please check this address.' },
};
const mountainView = {
	address_1: '1600 Amphitheatre Pkwy',
	address_2: '',
	city: 'Mountain View',
	state: 'CA',
	postcode: '94043',
	country: 'US',
};

afterEach(() => {
	document.body.replaceChildren();
	delete window.wc;
});

describe('SelectionTracker', () => {
	it('builds the payload the server expects and tells listeners', () => {
		const tracker = new SelectionTracker();
		const listener = vi.fn();

		tracker.subscribe(listener);
		tracker.set('shipping', { placeId: 'p1', address: mountainView });

		expect(listener).toHaveBeenCalledOnce();
		expect(JSON.parse(tracker.payload(['billing']))).toEqual({
			billing: null,
			shipping: { placeId: 'p1', address: mountainView },
			unknown: ['billing'],
		});
	});
});

describe('activeProviderId', () => {
	it('picks the first registered provider, in preference order, that can search the country', () => {
		const registry = {
			serverProviders: [
				{ id: 'woopayments' },
				{ id: 'adra-address-autocomplete' },
			],
			providers: {
				woopayments: {
					canSearch: (country: string) => country === 'US',
				},
				'adra-address-autocomplete': { canSearch: () => true },
			},
		};

		expect(activeProviderId(registry, 'US')).toBe('woopayments');
		expect(activeProviderId(registry, 'DE')).toBe(
			'adra-address-autocomplete'
		);
		expect(activeProviderId(undefined, 'US')).toBeNull();
	});
});

function classicForm(values: Record<string, string> = {}) {
	document.body.innerHTML = `
		<div class="woocommerce"><form class="checkout">
			${['billing', 'shipping']
				.flatMap((type) =>
					[
						'address_1',
						'address_2',
						'city',
						'state',
						'postcode',
						'country',
					].map(
						(field) =>
							`<input id="${type}_${field}" value="${values[`${type}_${field}`] ?? ''}">`
					)
				)
				.join('')}
			<input type="checkbox" id="ship-to-different-address-checkbox">
		</form></div>`;

	let placeOrder: () => boolean = () => true;
	const jQuery = () => ({
		on: (_event: string, handler: () => boolean) => {
			placeOrder = handler;
		},
	});
	const form = document.querySelector('form')!;

	return { form, jQuery, placeOrder: () => placeOrder() };
}

function fill(type: string, address: Record<string, string>) {
	Object.entries(address).forEach(([field, value]) => {
		(
			document.getElementById(`${type}_${field}`) as HTMLInputElement
		).value = value;
	});
}

describe('classic checkout', () => {
	it('keeps the selections in a hidden input for the server', () => {
		const { form, jQuery } = classicForm();
		const tracker = new SelectionTracker();

		initClassicCheckout(form, jQuery, tracker, settings);
		tracker.set('billing', { placeId: 'p1', address: mountainView });

		const input = form.querySelector<HTMLInputElement>(
			'[name="adra_aa_selection"]'
		)!;
		expect(JSON.parse(input.value).billing.placeId).toBe('p1');
	});

	it('stops the first submit of a typed address with a notice, and lets the second through', () => {
		const { form, jQuery, placeOrder } = classicForm();

		initClassicCheckout(form, jQuery, new SelectionTracker(), settings);
		fill('billing', mountainView);

		expect(placeOrder()).toBe(false);
		expect(
			document.querySelector('.adra-aa-soft-warning [role="alert"]')!
				.textContent
		).toBe('Please check this address.');
		expect(placeOrder()).toBe(true);
	});

	it('lets a selected, unchanged address straight through', () => {
		const { form, jQuery, placeOrder } = classicForm();
		const tracker = new SelectionTracker();

		initClassicCheckout(form, jQuery, tracker, settings);
		fill('billing', mountainView);
		tracker.set('billing', { placeId: 'p1', address: mountainView });

		expect(placeOrder()).toBe(true);
		expect(document.querySelector('.adra-aa-soft-warning')).toBeNull();
	});

	it('checks the shipping address when shipping to a different address', () => {
		const { form, jQuery, placeOrder } = classicForm();
		const tracker = new SelectionTracker();

		initClassicCheckout(form, jQuery, tracker, settings);
		fill('billing', mountainView);
		tracker.set('billing', { placeId: 'p1', address: mountainView });
		(
			document.getElementById(
				'ship-to-different-address-checkbox'
			) as HTMLInputElement
		).checked = true;
		fill('shipping', { ...mountainView, city: 'Palo Alto' });

		expect(placeOrder()).toBe(false);
	});

	it('does not warn about the saved address the form loaded with', () => {
		const saved = Object.fromEntries(
			Object.entries(mountainView).map(([field, value]) => [
				`billing_${field}`,
				value,
			])
		);
		const { form, jQuery, placeOrder } = classicForm(saved);

		initClassicCheckout(form, jQuery, new SelectionTracker(), settings);

		expect(placeOrder()).toBe(true);
	});

	it('marks addresses another provider handles as unknown and does not warn', () => {
		window.wc = {
			addressAutocomplete: {
				serverProviders: [
					{ id: 'woopayments' },
					{ id: 'adra-address-autocomplete' },
				],
				providers: {
					woopayments: { canSearch: () => true },
					'adra-address-autocomplete': { canSearch: () => true },
				},
			},
		};
		const { form, jQuery, placeOrder } = classicForm();

		initClassicCheckout(form, jQuery, new SelectionTracker(), settings);
		fill('billing', mountainView);

		expect(placeOrder()).toBe(true);
		expect(
			JSON.parse(
				form.querySelector<HTMLInputElement>(
					'[name="adra_aa_selection"]'
				)!.value
			).unknown
		).toEqual(['billing', 'shipping']);
	});

	it('never warns when the soft warning is turned off', () => {
		const { form, jQuery, placeOrder } = classicForm();

		initClassicCheckout(form, jQuery, new SelectionTracker(), {
			...settings,
			softWarning: { enabled: false, message: '' },
		});
		fill('billing', mountainView);

		expect(placeOrder()).toBe(true);
	});
});

describe('block checkout', () => {
	function blocks(needsShipping = true) {
		const customer = {
			billingAddress: {},
			shippingAddress: {} as Record<string, string>,
		};
		const setExtensionData = vi.fn();
		let validate: () => unknown = () => true;
		const wpData = {
			select: (store: string) =>
				store === 'wc/store/cart'
					? {
							getCustomerData: () => customer,
							getNeedsShipping: () => needsShipping,
						}
					: {},
			dispatch: () => ({ setExtensionData }),
		};
		const events = {
			onCheckoutValidation: (listener: () => unknown) => {
				validate = listener;
				return () => {};
			},
		};

		return {
			customer,
			setExtensionData,
			wpData,
			events,
			validate: () => validate(),
		};
	}

	it('sends the selections as Store API extension data', () => {
		const { wpData, events, setExtensionData } = blocks();
		const tracker = new SelectionTracker();

		initBlockCheckout(wpData, events as never, tracker, settings);
		tracker.set('shipping', { placeId: 'p1', address: mountainView });

		const [namespace, data] = setExtensionData.mock.lastCall!;
		expect(namespace).toBe('adra-address-autocomplete');
		expect(JSON.parse(data.selection).shipping.placeId).toBe('p1');
	});

	it('fails checkout validation once for a typed shipping address', () => {
		const { wpData, events, customer, validate } = blocks();

		initBlockCheckout(
			wpData,
			events as never,
			new SelectionTracker(),
			settings
		);
		customer.shippingAddress = mountainView;

		expect(validate()).toEqual({
			type: 'error',
			errorMessage: 'Please check this address.',
		});
		expect(validate()).toBe(true);
	});

	it('passes validation for a selected, unchanged address', () => {
		const { wpData, events, customer, validate } = blocks();
		const tracker = new SelectionTracker();

		initBlockCheckout(wpData, events as never, tracker, settings);
		customer.shippingAddress = mountainView;
		tracker.set('shipping', { placeId: 'p1', address: mountainView });

		expect(validate()).toBe(true);
	});
});
