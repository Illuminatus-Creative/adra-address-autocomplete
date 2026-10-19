<?php
/**
 * Tests for Requirements.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\Tests\Unit;

use Adra\AddressAutocomplete\Requirements;
use PHPUnit\Framework\TestCase;

/**
 * Requirements unit tests.
 *
 * @covers \Adra\AddressAutocomplete\Requirements
 */
final class RequirementsTest extends TestCase {

	public function test_runs_with_only_woocommerce(): void {
		$requirements = new Requirements( '6.8.1', '10.3.0', null );

		$this->assertTrue( $requirements->can_run() );
		$this->assertTrue( $requirements->woocommerce_supported() );
		$this->assertFalse( $requirements->gravity_forms_supported() );
		$this->assertSame( array(), $requirements->problems() );
	}

	public function test_runs_with_only_gravity_forms(): void {
		$requirements = new Requirements( '6.8.1', null, '3.1.3.4' );

		$this->assertTrue( $requirements->can_run() );
		$this->assertSame( array(), $requirements->problems() );
	}

	public function test_old_woocommerce_is_disabled_but_gravity_forms_still_runs(): void {
		$requirements = new Requirements( '6.8.1', '10.2.3', '3.1.3.4' );

		$this->assertTrue( $requirements->can_run() );
		$this->assertFalse( $requirements->woocommerce_supported() );
		$this->assertSame(
			array(
				array(
					'code'     => 'woocommerce_too_old',
					'required' => Requirements::WOOCOMMERCE,
					'found'    => '10.2.3',
				),
			),
			$requirements->problems()
		);
	}

	public function test_nothing_runs_without_an_integration(): void {
		$requirements = new Requirements( '6.8.1', null, null );

		$this->assertFalse( $requirements->can_run() );
		$this->assertSame( array( 'no_integration' ), array_column( $requirements->problems(), 'code' ) );
	}

	public function test_old_wordpress_stops_everything_and_reports_only_that(): void {
		$requirements = new Requirements( '6.6.2', '10.3.0', '3.1.3.4' );

		$this->assertFalse( $requirements->can_run() );
		$this->assertSame( array( 'wordpress_too_old' ), array_column( $requirements->problems(), 'code' ) );
	}

	/**
	 * Pre-releases of the required version count as that version.
	 *
	 * @dataProvider prerelease_versions
	 *
	 * @param string $wordpress   WordPress version.
	 * @param string $woocommerce WooCommerce version.
	 */
	public function test_prereleases_of_the_required_version_are_accepted( string $wordpress, string $woocommerce ): void {
		$requirements = new Requirements( $wordpress, $woocommerce, null );

		$this->assertTrue( $requirements->can_run() );
	}

	/**
	 * Pre-release version strings as WordPress and WooCommerce publish them.
	 *
	 * @return array<string, array{string, string}>
	 */
	public static function prerelease_versions(): array {
		return array(
			'release candidates' => array( '6.7-RC1', '10.3.0-rc.1' ),
			'beta'               => array( '6.7-beta2', '10.3.0-beta.2' ),
			'dev build'          => array( '6.7-alpha-59000', '10.3.0-dev' ),
		);
	}

	public function test_prerelease_of_an_older_version_is_rejected(): void {
		$requirements = new Requirements( '6.8.1', '10.2.0-rc.1', null );

		$this->assertFalse( $requirements->woocommerce_supported() );
	}
}
