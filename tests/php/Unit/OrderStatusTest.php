<?php
/**
 * Tests for Order_Status.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\Tests\Unit;

use Adra\AddressAutocomplete\WooCommerce\Order_Status;
use PHPUnit\Framework\TestCase;

/**
 * Order_Status unit tests.
 *
 * @covers \Adra\AddressAutocomplete\WooCommerce\Order_Status
 */
final class OrderStatusTest extends TestCase {

	private const MOUNTAIN_VIEW = array(
		'address_1' => '1600 Amphitheatre Pkwy',
		'address_2' => '',
		'city'      => 'Mountain View',
		'state'     => 'CA',
		'postcode'  => '94043',
		'country'   => 'US',
	);

	/**
	 * A selection for the Mountain View address.
	 *
	 * @return array{placeId: string, address: array<string, string>}
	 */
	private static function selection(): array {
		return array(
			'placeId' => 'p1',
			'address' => self::MOUNTAIN_VIEW,
		);
	}

	/**
	 * Each address type gets its own status.
	 */
	public function test_records_each_address_type(): void {
		$results = Order_Status::results(
			array(
				'billing'  => array( 'address_1' => '1 Main St' ) + self::MOUNTAIN_VIEW,
				'shipping' => array( 'city' => 'Palo Alto' ) + self::MOUNTAIN_VIEW,
			),
			array(
				'billing'  => null,
				'shipping' => self::selection(),
			),
			array()
		);

		$this->assertSame(
			array(
				'status'  => 'manual',
				'changed' => array(),
				'placeId' => '',
			),
			$results['billing']
		);
		$this->assertSame(
			array(
				'status'  => 'modified',
				'changed' => array( 'city' ),
				'placeId' => 'p1',
			),
			$results['shipping']
		);
	}

	/**
	 * Shipping to the billing address shares the billing selection, and vice versa.
	 */
	public function test_a_matching_address_shares_the_other_selection(): void {
		$addresses = array(
			'billing'  => self::MOUNTAIN_VIEW,
			'shipping' => array( 'address_2' => 'Suite 4' ) + self::MOUNTAIN_VIEW,
		);

		foreach ( array( 'billing', 'shipping' ) as $selected ) {
			$results = Order_Status::results( $addresses, array( $selected => self::selection() ), array() );

			$this->assertSame( 'verified', $results['billing']['status'], $selected );
			$this->assertSame( 'verified', $results['shipping']['status'], $selected );
			$this->assertSame( 'p1', $results['shipping']['placeId'], $selected );
		}
	}

	/**
	 * A different address doesn't borrow the other type's selection.
	 */
	public function test_a_different_address_stays_manual(): void {
		$results = Order_Status::results(
			array(
				'billing'  => self::MOUNTAIN_VIEW,
				'shipping' => array( 'postcode' => '94044' ) + self::MOUNTAIN_VIEW,
			),
			array( 'billing' => self::selection() ),
			array()
		);

		$this->assertSame( 'manual', $results['shipping']['status'] );
	}

	/**
	 * Addresses another provider handled are unknown, whatever was sent for them.
	 */
	public function test_records_unknown_for_another_provider(): void {
		$results = Order_Status::results(
			array( 'billing' => self::MOUNTAIN_VIEW ),
			array( 'billing' => self::selection() ),
			array( 'billing' )
		);

		$this->assertSame(
			array(
				'billing' => array(
					'status'  => 'unknown',
					'changed' => array(),
					'placeId' => '',
				),
			),
			$results
		);
	}

	/**
	 * Only the types the order has are recorded.
	 */
	public function test_skips_types_the_order_does_not_have(): void {
		$results = Order_Status::results(
			array( 'billing' => self::MOUNTAIN_VIEW ),
			array( 'shipping' => self::selection() ),
			array()
		);

		$this->assertSame( array( 'billing' ), array_keys( $results ) );
		$this->assertSame( 'manual', $results['billing']['status'] );
	}
}
