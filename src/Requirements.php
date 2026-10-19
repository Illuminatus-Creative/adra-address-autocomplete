<?php
/**
 * Version requirements for WordPress and the supported integrations.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete;

/**
 * Decides which parts of the plugin can run in the current environment.
 *
 * Takes versions as arguments so it can be tested without WordPress loaded.
 */
final class Requirements {

	public const WORDPRESS     = '6.7';
	public const WOOCOMMERCE   = '10.3';
	public const GRAVITY_FORMS = '2.9';

	/**
	 * Creates a requirements check for the given versions.
	 *
	 * @param string      $wordpress_version     Running WordPress version.
	 * @param string|null $woocommerce_version   Running WooCommerce version, or null when inactive.
	 * @param string|null $gravity_forms_version Running Gravity Forms version, or null when inactive.
	 */
	public function __construct(
		private string $wordpress_version,
		private ?string $woocommerce_version,
		private ?string $gravity_forms_version,
	) {}

	/**
	 * Reads versions from the running site.
	 */
	public static function from_environment(): self {
		return new self(
			get_bloginfo( 'version' ),
			defined( 'WC_VERSION' ) ? (string) WC_VERSION : null,
			class_exists( 'GFForms' ) ? (string) \GFForms::$version : null,
		);
	}

	/**
	 * Whether WordPress itself is new enough for the plugin to run at all.
	 */
	public function wordpress_supported(): bool {
		return self::at_least( $this->wordpress_version, self::WORDPRESS );
	}

	/**
	 * Whether WooCommerce is active and new enough.
	 */
	public function woocommerce_supported(): bool {
		return null !== $this->woocommerce_version && self::at_least( $this->woocommerce_version, self::WOOCOMMERCE );
	}

	/**
	 * Whether Gravity Forms is active and new enough.
	 */
	public function gravity_forms_supported(): bool {
		return null !== $this->gravity_forms_version && self::at_least( $this->gravity_forms_version, self::GRAVITY_FORMS );
	}

	/**
	 * Whether there is anything for the plugin to do.
	 */
	public function can_run(): bool {
		return $this->wordpress_supported() && ( $this->woocommerce_supported() || $this->gravity_forms_supported() );
	}

	/**
	 * Problems an administrator should be told about.
	 *
	 * @return list<array{code: string, required: string, found: string|null}>
	 */
	public function problems(): array {
		$problems = array();

		if ( ! $this->wordpress_supported() ) {
			$problems[] = array(
				'code'     => 'wordpress_too_old',
				'required' => self::WORDPRESS,
				'found'    => $this->wordpress_version,
			);

			return $problems;
		}

		if ( null !== $this->woocommerce_version && ! $this->woocommerce_supported() ) {
			$problems[] = array(
				'code'     => 'woocommerce_too_old',
				'required' => self::WOOCOMMERCE,
				'found'    => $this->woocommerce_version,
			);
		}

		if ( null !== $this->gravity_forms_version && ! $this->gravity_forms_supported() ) {
			$problems[] = array(
				'code'     => 'gravity_forms_too_old',
				'required' => self::GRAVITY_FORMS,
				'found'    => $this->gravity_forms_version,
			);
		}

		if ( null === $this->woocommerce_version && null === $this->gravity_forms_version ) {
			$problems[] = array(
				'code'     => 'no_integration',
				'required' => '',
				'found'    => null,
			);
		}

		return $problems;
	}

	/**
	 * Compares versions, treating pre-releases of the required version as acceptable.
	 *
	 * Without this, "10.3.0-rc.1" or "6.7-RC1" would fail a "10.3" / "6.7" requirement.
	 *
	 * @param string $found    Version found.
	 * @param string $required Minimum version.
	 */
	private static function at_least( string $found, string $required ): bool {
		$release = preg_replace( '/[-+].*$/', '', $found );
		$release = preg_replace( '/[a-z].*$/i', '', (string) $release );

		return version_compare( rtrim( (string) $release, '.' ), $required, '>=' );
	}
}
