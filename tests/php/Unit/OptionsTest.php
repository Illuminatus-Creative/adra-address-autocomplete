<?php
/**
 * Tests for Options.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\Tests\Unit;

use Adra\AddressAutocomplete\Settings\Options;
use PHPUnit\Framework\TestCase;

/**
 * Options unit tests.
 *
 * @covers \Adra\AddressAutocomplete\Settings\Options
 */
final class OptionsTest extends TestCase {

	public function test_uses_the_stored_key(): void {
		$options = new Options( null, array( 'google_api_key' => 'AIzaStored' ) );

		$this->assertSame( 'AIzaStored', $options->google_api_key() );
		$this->assertFalse( $options->key_is_from_constant() );
	}

	public function test_wp_config_constant_wins_and_is_trimmed(): void {
		$options = new Options( "  AIzaConstant\n", array( 'google_api_key' => 'AIzaStored' ) );

		$this->assertSame( 'AIzaConstant', $options->google_api_key() );
		$this->assertTrue( $options->key_is_from_constant() );
	}

	public function test_an_empty_constant_is_ignored(): void {
		$options = new Options( ' ', array( 'google_api_key' => 'AIzaStored' ) );

		$this->assertSame( 'AIzaStored', $options->google_api_key() );
		$this->assertFalse( $options->key_is_from_constant() );
	}

	public function test_no_key_and_malformed_storage_give_an_empty_key(): void {
		$this->assertSame( '', ( new Options( null, array() ) )->google_api_key() );
		$this->assertSame( '', ( new Options( null, array( 'google_api_key' => array( 'x' ) ) ) )->google_api_key() );
	}

	public function test_clean_key_strips_pasted_whitespace(): void {
		$this->assertSame( 'AIzaSyA-b_c123', Options::clean_key( " AIzaSyA-b_c123\n" ) );
		$this->assertSame( '', Options::clean_key( '   ' ) );
	}

	public function test_clean_key_rejects_characters_google_keys_never_contain(): void {
		$this->assertNull( Options::clean_key( 'AIza<script>' ) );
		$this->assertNull( Options::clean_key( 'AIza"onfocus=alert(1)' ) );
	}
}
