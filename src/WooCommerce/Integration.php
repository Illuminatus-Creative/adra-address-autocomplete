<?php
/**
 * WooCommerce integration.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\WooCommerce;

use Adra\AddressAutocomplete\Assets\Bundle;
use Adra\AddressAutocomplete\Assets\Google_Loader;

/**
 * Plugs Google Places into WooCommerce's address autocomplete framework (WooCommerce 10.3+).
 *
 * WooCommerce draws the suggestions and fills the fields; this plugin supplies the searches and
 * the selected address, with the state as a WooCommerce state code.
 */
final class Integration {

	/** WooCommerce's shared script, present when its address autocomplete is turned on. */
	private const WC_SCRIPT = 'wc-address-autocomplete-common';

	/**
	 * Creates the integration.
	 *
	 * @param Google_Loader $loader Google Maps loader.
	 */
	public function __construct( private Google_Loader $loader ) {}

	/**
	 * Registers hooks.
	 */
	public function register(): void {
		add_filter( 'woocommerce_address_providers', array( $this, 'add_provider' ) );
		// After WooCommerce enqueues its own scripts (priority 10).
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue' ), 20 );
	}

	/**
	 * Adds this plugin to WooCommerce's address providers.
	 *
	 * @param mixed $providers Providers registered so far.
	 * @return array<int, mixed>
	 */
	public function add_provider( $providers ): array {
		$providers   = is_array( $providers ) ? $providers : array();
		$providers[] = new Provider();

		return $providers;
	}

	/**
	 * Enqueues the provider on checkout and My Account pages, when WooCommerce's address
	 * autocomplete is turned on.
	 *
	 * WooCommerce loads its own script on every page once the feature is on; Google Maps is only
	 * loaded where there's an address form, to keep other pages fast.
	 */
	public function enqueue(): void {
		if ( ! wp_script_is( self::WC_SCRIPT, 'enqueued' ) || ! ( is_checkout() || is_account_page() ) ) {
			return;
		}

		$handle = Bundle::register( 'woocommerce-provider', array( self::WC_SCRIPT ) );

		if ( null === $handle ) {
			return;
		}

		wp_localize_script(
			$handle,
			'adraAaWooCommerce',
			array(
				'providerId' => Provider::ID,
				'states'     => $this->states(),
			)
		);

		wp_enqueue_script( $handle );
		$this->loader->enqueue();
	}

	/**
	 * WooCommerce's states for the countries the store sells or ships to.
	 *
	 * Countries WooCommerce has no list for are left out, which the browser side reads as a
	 * free-text state field, as WooCommerce does.
	 *
	 * @return array<string, mixed>
	 */
	private function states(): array {
		$countries = WC()->countries;

		return array_merge(
			(array) $countries->get_allowed_country_states(),
			(array) $countries->get_shipping_country_states()
		);
	}
}
