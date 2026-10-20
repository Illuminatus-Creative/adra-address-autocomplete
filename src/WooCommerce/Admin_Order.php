<?php
/**
 * Autocomplete on the WooCommerce order edit screen.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\WooCommerce;

use Adra\AddressAutocomplete\Assets\Bundle;
use Adra\AddressAutocomplete\Assets\Google_Loader;

/**
 * Loads the admin order adapter on the order edit and new order screens (HPOS and the legacy
 * post screen). WooCommerce's address autocomplete doesn't run there.
 */
final class Admin_Order {

	/** WooCommerce's order screen script, which rebuilds the state field when the country changes. */
	private const WC_SCRIPT = 'wc-admin-order-meta-boxes';

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
		// After WooCommerce enqueues its order script (priority 10).
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ), 20 );
	}

	/**
	 * Enqueues the adapter on the order screen.
	 */
	public function enqueue(): void {
		$screen = get_current_screen();

		if ( null === $screen || wc_get_page_screen_id( 'shop-order' ) !== $screen->id || ! wp_script_is( self::WC_SCRIPT, 'enqueued' ) ) {
			return;
		}

		/**
		 * Whether to add address autocomplete to the order edit screen.
		 *
		 * @param bool $enabled Default true.
		 */
		if ( ! apply_filters( 'adra_aa_admin_order_autocomplete', true ) ) {
			return;
		}

		$handle = Bundle::register( 'woocommerce-admin-order', array( self::WC_SCRIPT, 'jquery' ) );

		// Without a key there's nothing to search with.
		if ( null === $handle || ! $this->loader->enqueue() ) {
			return;
		}

		wp_localize_script(
			$handle,
			'adraAaWooCommerceAdmin',
			array(
				'poweredBy'     => __( 'Powered by', 'adra-address-autocomplete' ),
				'googleLogoUrl' => plugins_url( 'assets/images/google.svg', ADRA_AA_FILE ),
			)
		);

		wp_enqueue_script( $handle );
		wp_enqueue_style( $handle );
	}
}
