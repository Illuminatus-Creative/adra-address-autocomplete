<?php
/**
 * Tests for Warning.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\Tests\Unit;

use Adra\AddressAutocomplete\Address\Warning;
use PHPUnit\Framework\TestCase;

/**
 * Warning unit tests.
 *
 * @covers \Adra\AddressAutocomplete\Address\Warning
 */
final class WarningTest extends TestCase {

	private const ADDRESS = array(
		'address_1' => '1600 Amphitheatre Pkwy',
		'city'      => 'Mountain View',
		'state'     => 'CA',
		'postcode'  => '94043',
		'country'   => 'US',
	);

	/**
	 * Formatting and address line 2 don't change the key, so a confirmation survives them.
	 */
	public function test_key_ignores_formatting_and_line_2(): void {
		$reformatted = array(
			'address_1' => '1600 amphitheatre pkwy.',
			'address_2' => 'Suite 4',
			'city'      => ' MOUNTAIN  VIEW ',
			'postcode'  => '9404 3',
		) + self::ADDRESS;

		$this->assertSame( Warning::key( self::ADDRESS ), Warning::key( $reformatted ) );
	}

	/**
	 * Any real edit changes the key, so the warning shows again.
	 */
	public function test_key_changes_with_the_address(): void {
		foreach ( array_keys( self::ADDRESS ) as $field ) {
			$this->assertNotSame(
				Warning::key( self::ADDRESS ),
				Warning::key( array( $field => 'X' ) + self::ADDRESS ),
				$field
			);
		}
	}
}
