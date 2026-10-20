<?php
/**
 * Plugin bootstrap.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete;

use Adra\AddressAutocomplete\Admin\Notices;
use Adra\AddressAutocomplete\Assets\Google_Loader;
use Adra\AddressAutocomplete\Gravity_Forms\Integration as Gravity_Forms_Integration;
use Adra\AddressAutocomplete\Settings\Options;
use Adra\AddressAutocomplete\Settings\Settings_Page;
use Adra\AddressAutocomplete\WooCommerce\Integration as WooCommerce_Integration;

/**
 * Wires up the parts of the plugin the current site supports.
 */
final class Plugin {

	/**
	 * Creates the plugin.
	 *
	 * @param Requirements $requirements Environment checks.
	 * @param Options      $options      Plugin settings.
	 */
	public function __construct(
		private Requirements $requirements,
		private Options $options,
	) {}

	/**
	 * Registers hooks. Called on plugins_loaded.
	 */
	public function register(): void {
		add_action( 'init', array( $this, 'load_textdomain' ) );

		( new Notices( $this->requirements ) )->register();

		if ( ! $this->requirements->can_run() ) {
			return;
		}

		$loader = new Google_Loader( $this->options );
		$loader->register();

		if ( is_admin() ) {
			( new Settings_Page( $this->options, $loader ) )->register();
		}

		if ( $this->requirements->gravity_forms_supported() ) {
			( new Gravity_Forms_Integration( $loader, $this->options ) )->register();
		}

		if ( $this->requirements->woocommerce_supported() ) {
			( new WooCommerce_Integration( $loader, $this->options ) )->register();
		}
	}

	/**
	 * Loads bundled translations. Must run on init or later since WordPress 6.7.
	 */
	public function load_textdomain(): void {
		load_plugin_textdomain( 'adra-address-autocomplete', false, dirname( plugin_basename( ADRA_AA_FILE ) ) . '/languages' );
	}
}
