<?php
/**
 * Plugin Name:       ADRA Address Autocomplete
 * Plugin URI:        https://github.com/Illuminatus-Creative/adra-address-autocomplete
 * Description:       Google Places address autocomplete for Gravity Forms and WooCommerce, with address status tracking.
 * Version:           0.1.0
 * Requires at least: 6.7
 * Requires PHP:      8.1
 * Author:            The Ad Ranch
 * License:           GPL-2.0-only
 * License URI:       https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 * Text Domain:       adra-address-autocomplete
 * Domain Path:       /languages
 * WC requires at least: 10.3
 *
 * @package Adra\AddressAutocomplete
 */

defined( 'ABSPATH' ) || exit;

define( 'ADRA_AA_VERSION', '0.1.0' );
define( 'ADRA_AA_FILE', __FILE__ );

/*
 * Checked before loading anything under src/, which uses PHP 8.1 syntax and would
 * fatal on older versions instead of showing a notice.
 */
if ( version_compare( PHP_VERSION, '8.1', '<' ) || ! is_readable( __DIR__ . '/vendor/autoload.php' ) ) {
	add_action(
		'admin_notices',
		static function () {
			if ( ! current_user_can( 'activate_plugins' ) ) {
				return;
			}

			$message = version_compare( PHP_VERSION, '8.1', '<' )
				/* translators: %s: current PHP version. */
				? sprintf( __( 'ADRA Address Autocomplete requires PHP 8.1 or later. This site runs PHP %s.', 'adra-address-autocomplete' ), PHP_VERSION )
				: __( 'ADRA Address Autocomplete is missing its vendor/ folder. Install it from a release zip, or run composer install.', 'adra-address-autocomplete' );

			printf( '<div class="notice notice-error"><p>%s</p></div>', esc_html( $message ) );
		}
	);

	return;
}

require __DIR__ . '/vendor/autoload.php';

add_action(
	'before_woocommerce_init',
	static function () {
		if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', ADRA_AA_FILE, true );
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', ADRA_AA_FILE, true );
		}
	}
);

add_action(
	'plugins_loaded',
	static function () {
		$plugin = new \Adra\AddressAutocomplete\Plugin(
			\Adra\AddressAutocomplete\Requirements::from_environment(),
			\Adra\AddressAutocomplete\Settings\Options::from_wordpress()
		);
		$plugin->register();
	}
);
