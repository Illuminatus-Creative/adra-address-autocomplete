<?php
/**
 * Stored plugin settings.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\Settings;

/**
 * Reads the plugin's settings. The Google key can also come from wp-config.php, which wins.
 */
final class Options {

	public const OPTION       = 'adra_aa_settings';
	public const KEY_CONSTANT = 'ADRA_AA_GOOGLE_API_KEY';

	/**
	 * Creates the settings reader.
	 *
	 * @param string|null          $constant_key Value of ADRA_AA_GOOGLE_API_KEY, or null when not defined.
	 * @param array<string, mixed> $stored       Stored option value.
	 */
	public function __construct(
		private ?string $constant_key,
		private array $stored,
	) {}

	/**
	 * Reads settings from the running site.
	 */
	public static function from_wordpress(): self {
		$stored = get_option( self::OPTION, array() );

		return new self(
			defined( self::KEY_CONSTANT ) ? (string) constant( self::KEY_CONSTANT ) : null,
			is_array( $stored ) ? $stored : array(),
		);
	}

	/**
	 * The Google API key in use, or an empty string when none is set.
	 */
	public function google_api_key(): string {
		if ( $this->key_is_from_constant() ) {
			return trim( (string) $this->constant_key );
		}

		return is_string( $this->stored['google_api_key'] ?? null ) ? $this->stored['google_api_key'] : '';
	}

	/**
	 * Whether the key is set in wp-config.php, making the settings field read-only.
	 */
	public function key_is_from_constant(): bool {
		return null !== $this->constant_key && '' !== trim( $this->constant_key );
	}

	/**
	 * Whether to show the soft warning for addresses that don't match a selected suggestion. On by default.
	 */
	public function soft_warning_enabled(): bool {
		return (bool) ( $this->stored['soft_warning'] ?? true );
	}

	/**
	 * Cleans a pasted key: strips whitespace (pasting often adds a newline) and checks the characters
	 * Google uses.
	 *
	 * @param string $raw Submitted value.
	 * @return string|null The cleaned key (empty to clear it), or null when it can't be a Google key.
	 */
	public static function clean_key( string $raw ): ?string {
		$key = (string) preg_replace( '/\s+/', '', $raw );

		return 1 === preg_match( '/^[A-Za-z0-9_-]*$/', $key ) ? $key : null;
	}
}
