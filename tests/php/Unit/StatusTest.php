<?php
/**
 * Tests for Status.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\Tests\Unit;

use Adra\AddressAutocomplete\Address\Status;
use PHPUnit\Framework\TestCase;

/**
 * Status unit tests.
 *
 * @covers \Adra\AddressAutocomplete\Address\Status
 */
final class StatusTest extends TestCase {

	/**
	 * The cases shared with the JavaScript comparison.
	 *
	 * @dataProvider shared_cases
	 *
	 * @param array<string, string>                        $selected  Selected address.
	 * @param array<string, string>                        $submitted Submitted address.
	 * @param array{status: string, changed: list<string>} $expected  Expected result.
	 */
	public function test_matches_the_javascript_comparison( array $selected, array $submitted, array $expected ): void {
		$this->assertSame( $expected, Status::compare( $selected, $submitted ) );
	}

	/**
	 * Reads tests/fixtures/address-match-cases.json.
	 *
	 * @return array<string, array{array<string, string>, array<string, string>, array<string, mixed>}>
	 */
	public static function shared_cases(): array {
		$fixture = json_decode( (string) file_get_contents( __DIR__ . '/../../fixtures/address-match-cases.json' ), true );
		$cases   = array();

		foreach ( $fixture['cases'] as $case ) {
			$selected               = $case['selected'] ?? $fixture['selected'];
			$cases[ $case['name'] ] = array( $selected, array_merge( $selected, $case['submitted'] ), $case['expected'] );
		}

		return $cases;
	}

	public function test_no_selection_is_manual(): void {
		$this->assertSame(
			array(
				'status'  => Status::MANUAL,
				'changed' => array(),
			),
			Status::compare( null, array( 'address_1' => '1 Main St' ) )
		);
	}

	public function test_non_string_values_count_as_empty(): void {
		$result = Status::compare(
			array(
				'address_1' => '1 Main St',
				'city'      => array( 'x' ),
			),
			array(
				'address_1' => '1 Main St',
				'city'      => 'Springfield',
			)
		);

		$this->assertSame( Status::VERIFIED, $result['status'] );
	}
}
