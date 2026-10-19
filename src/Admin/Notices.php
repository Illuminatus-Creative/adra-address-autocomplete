<?php
/**
 * Admin notices for unmet requirements.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\Admin;

use Adra\AddressAutocomplete\Requirements;

/**
 * Tells administrators why part or all of the plugin is inactive.
 */
final class Notices {

	/**
	 * Creates the notices handler.
	 *
	 * @param Requirements $requirements Environment checks.
	 */
	public function __construct( private Requirements $requirements ) {}

	/**
	 * Registers hooks.
	 */
	public function register(): void {
		add_action( 'admin_notices', array( $this, 'render' ) );
	}

	/**
	 * Prints one notice per problem.
	 */
	public function render(): void {
		if ( ! current_user_can( 'activate_plugins' ) ) {
			return;
		}

		foreach ( $this->requirements->problems() as $problem ) {
			$message = $this->message( $problem );

			if ( '' !== $message ) {
				printf( '<div class="notice notice-warning"><p>%s</p></div>', esc_html( $message ) );
			}
		}
	}

	/**
	 * Builds the translated message for a problem.
	 *
	 * @param array{code: string, required: string, found: string|null} $problem Problem from Requirements::problems().
	 */
	private function message( array $problem ): string {
		switch ( $problem['code'] ) {
			case 'wordpress_too_old':
				/* translators: 1: required WordPress version, 2: installed version. */
				return sprintf( __( 'ADRA Address Autocomplete requires WordPress %1$s or later (found %2$s). It is inactive.', 'adra-address-autocomplete' ), $problem['required'], (string) $problem['found'] );

			case 'woocommerce_too_old':
				/* translators: 1: required WooCommerce version, 2: installed version. */
				return sprintf( __( 'ADRA Address Autocomplete requires WooCommerce %1$s or later (found %2$s). WooCommerce autocomplete is disabled.', 'adra-address-autocomplete' ), $problem['required'], (string) $problem['found'] );

			case 'gravity_forms_too_old':
				/* translators: 1: required Gravity Forms version, 2: installed version. */
				return sprintf( __( 'ADRA Address Autocomplete requires Gravity Forms %1$s or later (found %2$s). Gravity Forms autocomplete is disabled.', 'adra-address-autocomplete' ), $problem['required'], (string) $problem['found'] );

			case 'no_integration':
				return __( 'ADRA Address Autocomplete needs Gravity Forms or WooCommerce to be active. It has nothing to do until one of them is.', 'adra-address-autocomplete' );
		}

		return '';
	}
}
