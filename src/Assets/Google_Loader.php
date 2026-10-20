<?php
/**
 * Loads the Google Maps JavaScript API once per page.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\Assets;

use Adra\AddressAutocomplete\Settings\Options;

/**
 * Registers the Maps JavaScript API for the integrations to enqueue when they need it.
 *
 * The plugin's own scripts don't depend on this handle; they wait for Google to be ready instead.
 * That lets the loader step aside when another plugin already loads Google Maps, since loading it
 * twice on one page breaks it.
 */
final class Google_Loader {

	public const HANDLE         = 'adra-aa-google';
	public const READY_CALLBACK = 'adraAaGoogleReady';
	public const READY_EVENT    = 'adra-aa:google-ready';

	private const MAPS_URL = 'https://maps.googleapis.com/maps/api/js';

	/**
	 * Handle of another plugin's Google Maps script this loader stepped aside for, if any.
	 *
	 * @var string|null
	 */
	private ?string $stepped_aside_for = null;

	/**
	 * Creates the loader.
	 *
	 * @param Options $options Plugin settings.
	 */
	public function __construct( private Options $options ) {}

	/**
	 * Registers hooks.
	 */
	public function register(): void {
		foreach ( array( 'wp_enqueue_scripts', 'admin_enqueue_scripts' ) as $hook ) {
			add_action( $hook, array( $this, 'register_script' ), 5 );
			add_action( $hook, array( $this, 'avoid_double_loading' ), 1000 );
		}
	}

	/**
	 * Registers the Google script, when a key is set.
	 */
	public function register_script(): void {
		$key = $this->options->google_api_key();

		if ( '' === $key ) {
			return;
		}

		// Null version: a ?ver= parameter would only defeat caching of Google's own script.
		// phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion
		wp_register_script( self::HANDLE, self::script_url( $key ), array(), null, array( 'strategy' => 'async' ) );

		wp_add_inline_script(
			self::HANDLE,
			sprintf(
				'window.%s=function(){document.dispatchEvent(new Event(%s));};',
				self::READY_CALLBACK,
				wp_json_encode( self::READY_EVENT )
			),
			'before'
		);
	}

	/**
	 * Enqueues the Google script. Called by integrations on pages that need autocomplete.
	 *
	 * @return bool Whether it was enqueued: false without a key, or when turned off with the
	 *              adra_aa_load_google_maps filter.
	 */
	public function enqueue(): bool {
		/**
		 * Whether this plugin should load the Google Maps JavaScript API.
		 *
		 * Return false when the site loads Google Maps another way. That copy must use a key with
		 * the Places API (New) enabled.
		 *
		 * @param bool $load Default true.
		 */
		if ( ! apply_filters( 'adra_aa_load_google_maps', true ) || ! wp_script_is( self::HANDLE, 'registered' ) ) {
			return false;
		}

		wp_enqueue_script( self::HANDLE );

		return true;
	}

	/**
	 * Drops this plugin's copy of Google Maps when another plugin already enqueued one.
	 */
	public function avoid_double_loading(): void {
		if ( ! wp_script_is( self::HANDLE, 'enqueued' ) ) {
			return;
		}

		$this->stepped_aside_for = self::other_maps_handle( wp_scripts() );

		if ( null !== $this->stepped_aside_for ) {
			wp_dequeue_script( self::HANDLE );
		}
	}

	/**
	 * Handle of the other plugin's Google Maps script in use on this page instead of ours, if any.
	 * Known once scripts have been enqueued.
	 */
	public function stepped_aside_for(): ?string {
		return $this->stepped_aside_for;
	}

	/**
	 * Builds the Maps JavaScript API URL.
	 *
	 * @param string $key Google API key.
	 */
	public static function script_url( string $key ): string {
		return self::MAPS_URL . '?' . http_build_query(
			array(
				'key'      => $key,
				'loading'  => 'async',
				'callback' => self::READY_CALLBACK,
			),
			'',
			'&',
			PHP_QUERY_RFC3986
		);
	}

	/**
	 * Finds another enqueued script that loads the Maps JavaScript API.
	 *
	 * @param \WP_Dependencies $scripts Registered scripts.
	 * @return string|null Its handle, or null.
	 */
	public static function other_maps_handle( $scripts ): ?string {
		foreach ( $scripts->registered as $handle => $script ) {
			if (
				self::HANDLE !== $handle
				&& is_string( $script->src )
				&& str_contains( $script->src, '//maps.googleapis.com/maps/api/js' )
				&& $scripts->query( $handle, 'enqueued' )
			) {
				return $handle;
			}
		}

		return null;
	}
}
