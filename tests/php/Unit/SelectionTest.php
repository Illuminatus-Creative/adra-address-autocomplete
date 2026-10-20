<?php
/**
 * Tests for Selection.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\Tests\Unit;

use Adra\AddressAutocomplete\Address\Selection;
use PHPUnit\Framework\TestCase;

/**
 * Selection unit tests.
 *
 * @covers \Adra\AddressAutocomplete\Address\Selection
 */
final class SelectionTest extends TestCase {

	/**
	 * Keeps the known fields, sanitized, and drops everything else.
	 */
	public function test_keeps_only_known_sanitized_fields(): void {
		$decoded = Selection::decode(
			(string) json_encode( // phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode -- WordPress isn't loaded.
				array(
					'placeId' => 'ChIJ<b>abc</b>-_1',
					'address' => array(
						'address_1' => ' 1600 <script>x</script>Amphitheatre   Pkwy ',
						'city'      => array( 'not', 'a', 'string' ),
						'country'   => 'US',
						'extra'     => 'dropped',
					),
					'name'    => 'Googleplex',
				)
			)
		);

		$this->assertSame(
			array(
				'placeId' => 'ChIJbabcb-_1',
				'address' => array(
					'address_1' => '1600 xAmphitheatre Pkwy',
					'address_2' => '',
					'city'      => '',
					'state'     => '',
					'postcode'  => '',
					'country'   => 'US',
				),
			),
			$decoded
		);
	}

	/**
	 * Rejects anything that isn't a selection.
	 *
	 * @dataProvider invalid
	 *
	 * @param mixed $raw Posted value.
	 */
	public function test_rejects_invalid_input( $raw ): void {
		$this->assertNull( Selection::decode( $raw ) );
	}

	/**
	 * Values that aren't selections.
	 *
	 * @return array<string, array{mixed}>
	 */
	public static function invalid(): array {
		return array(
			'null'           => array( null ),
			'empty string'   => array( '' ),
			'not JSON'       => array( '{nope' ),
			'no address'     => array( '{"placeId":"p1"}' ),
			'address string' => array( '{"placeId":"p1","address":"1 Main St"}' ),
			'too long'       => array( '{"placeId":"' . str_repeat( 'a', 4000 ) . '","address":{}}' ),
			'number'         => array( 42 ),
		);
	}
}
