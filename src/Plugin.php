<?php
/**
 * Plugin bootstrap.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete;

use Adra\AddressAutocomplete\Admin\Notices;

/**
 * Wires up the parts of the plugin the current site supports.
 */
final class Plugin {

	/**
	 * Creates the plugin.
	 *
	 * @param Requirements $requirements Environment checks.
	 */
	public function __construct( private Requirements $requirements ) {}

	/**
	 * Registers hooks. Called on plugins_loaded.
	 */
	public function register(): void {
		add_action( 'init', array( $this, 'load_textdomain' ) );

		( new Notices( $this->requirements ) )->register();
	}

	/**
	 * Loads bundled translations. Must run on init or later since WordPress 6.7.
	 */
	public function load_textdomain(): void {
		load_plugin_textdomain( 'adra-address-autocomplete', false, dirname( plugin_basename( ADRA_AA_FILE ) ) . '/languages' );
	}
}
