<?php
/**
 * PHPUnit bootstrap: the autoloader, plus stand-ins for the few WordPress functions the
 * unit-tested classes call. The tests don't load WordPress.
 *
 * @package Adra\AddressAutocomplete
 */

// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- Stand-ins for WordPress functions.

if ( ! function_exists( 'sanitize_text_field' ) ) {
	/**
	 * Close enough to WordPress's version for these tests: strips tags and line breaks, collapses
	 * whitespace and trims.
	 *
	 * @param string $str Raw text.
	 */
	function sanitize_text_field( $str ) {
		// phpcs:ignore WordPress.WP.AlternativeFunctions.strip_tags_strip_tags -- WordPress isn't loaded.
		return trim( (string) preg_replace( '/\s+/', ' ', strip_tags( (string) $str ) ) );
	}
}

require dirname( __DIR__, 2 ) . '/vendor/autoload.php';
