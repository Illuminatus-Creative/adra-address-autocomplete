<?php
/**
 * Tests for Google_Loader.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\Tests\Unit;

use Adra\AddressAutocomplete\Assets\Google_Loader;
use PHPUnit\Framework\TestCase;

/**
 * Google_Loader unit tests.
 *
 * @covers \Adra\AddressAutocomplete\Assets\Google_Loader
 */
final class GoogleLoaderTest extends TestCase {

	public function test_script_url_loads_asynchronously_with_the_ready_callback(): void {
		$this->assertSame(
			'https://maps.googleapis.com/maps/api/js?key=AIza-Key_1&loading=async&callback=adraAaGoogleReady',
			Google_Loader::script_url( 'AIza-Key_1' )
		);
	}

	public function test_finds_another_enqueued_maps_script(): void {
		$scripts = $this->scripts(
			array(
				Google_Loader::HANDLE => 'https://maps.googleapis.com/maps/api/js?key=ours',
				'jquery'              => '/wp-includes/js/jquery/jquery.min.js',
				'store-locator-maps'  => 'https://maps.googleapis.com/maps/api/js?key=theirs&libraries=places',
			),
			array( Google_Loader::HANDLE, 'jquery', 'store-locator-maps' )
		);

		$this->assertSame( 'store-locator-maps', Google_Loader::other_maps_handle( $scripts ) );
	}

	public function test_ignores_maps_scripts_that_are_only_registered(): void {
		$scripts = $this->scripts(
			array( 'store-locator-maps' => '//maps.googleapis.com/maps/api/js?key=theirs' ),
			array()
		);

		$this->assertNull( Google_Loader::other_maps_handle( $scripts ) );
	}

	public function test_ignores_its_own_handle_and_inline_only_scripts(): void {
		$scripts = $this->scripts(
			array(
				Google_Loader::HANDLE => 'https://maps.googleapis.com/maps/api/js?key=ours',
				'inline-only'         => false,
			),
			array( Google_Loader::HANDLE, 'inline-only' )
		);

		$this->assertNull( Google_Loader::other_maps_handle( $scripts ) );
	}

	/**
	 * Builds a stand-in for WP_Scripts.
	 *
	 * @param array<string, string|false> $sources  Script sources by handle.
	 * @param string[]                    $enqueued Handles that count as enqueued.
	 */
	private function scripts( array $sources, array $enqueued ): object {
		return new class( $sources, $enqueued ) {

			/**
			 * Registered scripts.
			 *
			 * @var array<string, object>
			 */
			public array $registered = array();

			/**
			 * Creates the stand-in.
			 *
			 * @param array<string, string|false> $sources  Script sources by handle.
			 * @param string[]                    $enqueued Handles that count as enqueued.
			 */
			public function __construct( array $sources, private array $enqueued ) {
				foreach ( $sources as $handle => $src ) {
					$this->registered[ $handle ] = (object) array( 'src' => $src );
				}
			}

			/**
			 * Mirrors WP_Dependencies::query() for the "enqueued" list.
			 *
			 * @param string $handle Script handle.
			 * @param string $type   List to check.
			 */
			public function query( string $handle, string $type ): bool {
				return 'enqueued' === $type && in_array( $handle, $this->enqueued, true );
			}
		};
	}
}
