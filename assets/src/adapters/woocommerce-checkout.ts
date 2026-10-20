/**
 * Address status and the soft warning on WooCommerce's classic and block checkouts.
 *
 * Selections reach the server as JSON (see src/WooCommerce/Order_Status.php): in a hidden input on
 * the classic checkout, as Store API extension data on the block checkout.
 */

import type { Address } from '../address/match';
import { addressKey, needsWarning } from '../address/warning';
import type { Selection } from '../address/warning';

export type AddressType = 'billing' | 'shipping';

const TYPES: AddressType[] = ['billing', 'shipping'];

export interface CheckoutSettings {
	providerId: string;
	classicInput: string;
	storeApiNamespace: string;
	softWarning: { enabled: boolean; message: string };
}

interface ProviderRegistry {
	serverProviders?: Array<{ id: string }>;
	providers?: Record<string, { canSearch: (country: string) => boolean }>;
}

/**
 * Keeps the selected suggestion for each address type.
 */
export class SelectionTracker {
	private readonly selections: Partial<Record<AddressType, Selection>> = {};
	private readonly listeners: Array<() => void> = [];

	set(type: AddressType, selection: Selection): void {
		this.selections[type] = selection;
		this.listeners.forEach((listener) => listener());
	}

	get(type: AddressType): Selection | null {
		return this.selections[type] ?? null;
	}

	subscribe(listener: () => void): void {
		this.listeners.push(listener);
	}

	/**
	 * @param unknown Address types another provider handled.
	 */
	payload(unknown: AddressType[]): string {
		return JSON.stringify({
			billing: this.get('billing'),
			shipping: this.get('shipping'),
			unknown,
		});
	}
}

/**
 * The provider WooCommerce uses for a country: the first registered provider, in the store's
 * order of preference, that can search there. Mirrors WooCommerce's own choice.
 *
 * @param registry window.wc.addressAutocomplete.
 * @param country  Country code.
 */
export function activeProviderId(
	registry: ProviderRegistry | undefined,
	country: string
): string | null {
	for (const { id } of registry?.serverProviders ?? []) {
		if (registry?.providers?.[id]?.canSearch(country)) {
			return id;
		}
	}

	return null;
}

interface CheckoutState {
	read: (type: AddressType) => Address;
	shippingType: () => AddressType;
	registry: () => ProviderRegistry | undefined;
}

function createWarning(
	tracker: SelectionTracker,
	settings: CheckoutSettings,
	state: CheckoutState
) {
	const initial = {
		billing: state.read('billing'),
		shipping: state.read('shipping'),
	};
	const confirmed = new Set<string>();

	const unknown = (): AddressType[] =>
		TYPES.filter((type) => {
			const id = activeProviderId(
				state.registry(),
				state.read(type).country
			);

			return id !== null && id !== settings.providerId;
		});

	return {
		unknown,

		/**
		 * @return The message to show, or null to let the submit through.
		 */
		check(): string | null {
			const type = state.shippingType();

			if (!settings.softWarning.enabled || unknown().includes(type)) {
				return null;
			}

			const current = state.read(type);

			if (
				!needsWarning({
					selection: tracker.get(type),
					current,
					initial: initial[type],
					confirmed,
				})
			) {
				return null;
			}

			confirmed.add(addressKey(current));

			return settings.softWarning.message;
		},
	};
}

type JQueryLike = (element: Element) => {
	on: (event: string, handler: () => boolean) => void;
};

/**
 * Classic checkout: hidden input with the selections, and the soft warning on place order.
 *
 * @param form     form.checkout.
 * @param jQuery   window.jQuery; WooCommerce asks its checkout_place_order handlers whether to submit.
 * @param tracker  Selections.
 * @param settings Settings from the server.
 */
export function initClassicCheckout(
	form: HTMLFormElement,
	jQuery: JQueryLike,
	tracker: SelectionTracker,
	settings: CheckoutSettings
): void {
	const value = (id: string): string =>
		(document.getElementById(id) as HTMLInputElement | null)?.value ?? '';
	const read = (type: AddressType): Address => ({
		address_1: value(`${type}_address_1`),
		address_2: value(`${type}_address_2`),
		city: value(`${type}_city`),
		state: value(`${type}_state`),
		postcode: value(`${type}_postcode`),
		country: value(`${type}_country`),
	});

	const warning = createWarning(tracker, settings, {
		read,
		shippingType: () =>
			(
				document.getElementById(
					'ship-to-different-address-checkbox'
				) as HTMLInputElement | null
			)?.checked
				? 'shipping'
				: 'billing',
		registry: () => window.wc?.addressAutocomplete,
	});

	const input = document.createElement('input');

	input.type = 'hidden';
	input.name = settings.classicInput;
	form.appendChild(input);

	const update = () => {
		input.value = tracker.payload(warning.unknown());
	};

	tracker.subscribe(update);
	update();

	jQuery(form).on('checkout_place_order', () => {
		update();

		const message = warning.check();

		if (message === null) {
			return true;
		}

		showClassicNotice(form, message);

		return false;
	});
}

/* Same markup WooCommerce uses for checkout errors. */
function showClassicNotice(form: HTMLFormElement, message: string): void {
	form.parentElement
		?.querySelectorAll('.woocommerce-NoticeGroup-checkout')
		.forEach((notice) => notice.remove());

	const group = document.createElement('div');
	const list = document.createElement('ul');
	const item = document.createElement('li');

	group.className =
		'woocommerce-NoticeGroup woocommerce-NoticeGroup-checkout adra-aa-soft-warning';
	list.className = 'woocommerce-error';
	list.setAttribute('role', 'alert');
	item.textContent = message;
	list.appendChild(item);
	group.appendChild(list);
	form.prepend(group);
	group.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
}

interface WpData {
	select: (store: string) => any;
	dispatch: (store: string) => any;
}

interface CheckoutEvents {
	onCheckoutValidation: (
		listener: () => true | { type: 'error'; errorMessage: string }
	) => () => void;
}

/**
 * Block checkout: Store API extension data with the selections, and the soft warning through
 * WooCommerce's checkout validation event.
 *
 * @param wpData   window.wp.data.
 * @param events   window.wc.blocksCheckoutEvents.checkoutEvents.
 * @param tracker  Selections.
 * @param settings Settings from the server.
 */
export function initBlockCheckout(
	wpData: WpData,
	events: CheckoutEvents,
	tracker: SelectionTracker,
	settings: CheckoutSettings
): void {
	const read = (type: AddressType): Address => {
		const customer = wpData.select('wc/store/cart').getCustomerData();
		const address =
			(type === 'billing'
				? customer?.billingAddress
				: customer?.shippingAddress) ?? {};

		return {
			address_1: address.address_1 ?? '',
			address_2: address.address_2 ?? '',
			city: address.city ?? '',
			state: address.state ?? '',
			postcode: address.postcode ?? '',
			country: address.country ?? '',
		};
	};

	const warning = createWarning(tracker, settings, {
		read,
		// With shipping, the shipping form is the main one ("use same address for billing").
		shippingType: () =>
			wpData.select('wc/store/cart').getNeedsShipping()
				? 'shipping'
				: 'billing',
		registry: () => window.wc?.addressAutocomplete,
	});

	const update = () =>
		wpData
			.dispatch('wc/store/checkout')
			.setExtensionData(settings.storeApiNamespace, {
				selection: tracker.payload(warning.unknown()),
			});

	tracker.subscribe(update);
	update();

	events.onCheckoutValidation(() => {
		update();

		const message = warning.check();

		return message === null
			? true
			: { type: 'error', errorMessage: message };
	});
}
