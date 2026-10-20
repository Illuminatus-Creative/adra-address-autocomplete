<?php
/**
 * Updates from GitHub Releases.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\Updates;

use YahnisElsts\PluginUpdateChecker\v5\PucFactory;

/**
 * Shows updates on the Plugins screen from the repository's GitHub Releases, using
 * plugin-update-checker.
 *
 * Only the release zip built by the release workflow is ever installed. GitHub's source zips lack
 * vendor/ and the built scripts, so installing one would break the plugin; the update checker's
 * fallbacks to them (the newest tag, then the branch) are turned off.
 */
final class Updater {

	public const REPOSITORY = 'https://github.com/Illuminatus-Creative/adra-address-autocomplete/';
	public const SLUG       = 'adra-address-autocomplete';

	/** Release asset the release workflow attaches. */
	public const ASSET = 'adra-address-autocomplete.zip';

	/**
	 * Starts checking for updates.
	 *
	 * @param string $plugin_file Main plugin file.
	 */
	public static function register( string $plugin_file ): void {
		/**
		 * Whether to check GitHub for updates. Off for a git checkout, so an update can't replace
		 * a working copy.
		 *
		 * @param bool $check Default true, or false when the plugin folder is a git checkout.
		 */
		if ( ! apply_filters( 'adra_aa_check_for_updates', ! file_exists( dirname( $plugin_file ) . '/.git' ) ) ) {
			return;
		}

		$checker = PucFactory::buildUpdateChecker( self::REPOSITORY, $plugin_file, self::SLUG );
		$api     = $checker->getVcsApi();

		/*
		 * Another plugin can load an older copy of plugin-update-checker 5, which would then be
		 * used. Without REQUIRE_RELEASE_ASSETS it would fall back to the source zip.
		 */
		if ( ! defined( get_class( $api ) . '::REQUIRE_RELEASE_ASSETS' ) ) {
			return;
		}

		$checker->setBranch( 'main' );
		$api->enableReleaseAssets( '/^' . preg_quote( self::ASSET, '/' ) . '$/', $api::REQUIRE_RELEASE_ASSETS );

		add_filter(
			$checker->getUniqueName( 'vcs_update_detection_strategies' ),
			static fn( $strategies ) => array_intersect_key( (array) $strategies, array( $api::STRATEGY_LATEST_RELEASE => true ) )
		);
	}
}
