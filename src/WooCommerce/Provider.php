<?php
/**
 * WooCommerce address provider.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\WooCommerce;

use WC_Address_Provider;

/**
 * Registers this plugin with WooCommerce's address autocomplete, which draws the suggestion list
 * on the classic checkout, the block checkout and My Account. The browser side is
 * assets/src/woocommerce-provider.ts.
 */
final class Provider extends WC_Address_Provider {

	public const ID = 'adra-address-autocomplete';

	/**
	 * Sets the provider's ID, name and Google attribution.
	 */
	public function __construct() {
		$this->id   = self::ID;
		$this->name = __( 'Google Places (ADRA Address Autocomplete)', 'adra-address-autocomplete' );

		// Google requires its logo wherever Places results appear without a Google map. Same markup
		// and logo file as WooCommerce's own Google-powered provider.
		$this->branding_html = sprintf(
			'%s&nbsp;<img style="height: 15px; width: 45px; margin-bottom: -2px;" src="%s" alt="Google" />',
			/* translators: Followed by the Google logo, under address suggestions. */
			esc_html__( 'Powered by', 'adra-address-autocomplete' ),
			esc_url( plugins_url( 'assets/images/google.svg', ADRA_AA_FILE ) )
		);
	}
}
