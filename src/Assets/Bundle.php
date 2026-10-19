<?php
/**
 * Registers scripts built by @wordpress/scripts.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\Assets;

/**
 * Registers a bundle from assets/build/, using the dependencies and version webpack records in
 * the matching .asset.php file.
 */
final class Bundle {

	public const HANDLE_PREFIX = 'adra-aa-';

	/**
	 * Registers a built script, and its stylesheet if it has one.
	 *
	 * @param string $name Entry name, e.g. "admin-settings".
	 * @return string|null Script handle, or null when the bundle hasn't been built.
	 */
	public static function register( string $name ): ?string {
		$path       = plugin_dir_path( ADRA_AA_FILE ) . 'assets/build/';
		$asset_file = $path . $name . '.asset.php';

		if ( ! is_readable( $asset_file ) ) {
			return null;
		}

		$asset  = require $asset_file;
		$handle = self::HANDLE_PREFIX . $name;

		wp_register_script(
			$handle,
			plugins_url( 'assets/build/' . $name . '.js', ADRA_AA_FILE ),
			$asset['dependencies'] ?? array(),
			$asset['version'] ?? ADRA_AA_VERSION,
			array( 'in_footer' => true )
		);

		wp_set_script_translations( $handle, 'adra-address-autocomplete', plugin_dir_path( ADRA_AA_FILE ) . 'languages' );

		if ( is_readable( $path . $name . '.css' ) ) {
			wp_register_style(
				$handle,
				plugins_url( 'assets/build/' . $name . '.css', ADRA_AA_FILE ),
				array(),
				$asset['version'] ?? ADRA_AA_VERSION
			);

			if ( is_readable( $path . $name . '-rtl.css' ) ) {
				wp_style_add_data( $handle, 'rtl', 'replace' );
			}
		}

		return $handle;
	}
}
