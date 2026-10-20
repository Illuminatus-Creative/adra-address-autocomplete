<?php
/**
 * The selected address, as posted by the browser.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\Address;

/**
 * Decodes the selected address the browser sends with a submission.
 *
 * It comes from the browser, so a determined person could forge a "verified" status. The status
 * is meant to catch mistakes, not fraud.
 */
final class Selection {

	public const FIELDS = array( 'address_1', 'address_2', 'city', 'state', 'postcode', 'country' );

	/**
	 * Decodes one selection: `{"placeId": "...", "address": {...}}`, keeping only known string fields.
	 *
	 * @param mixed $raw JSON string, or an already decoded array.
	 * @return array{placeId: string, address: array<string, string>}|null
	 */
	public static function decode( $raw ): ?array {
		if ( is_string( $raw ) ) {
			if ( '' === $raw || strlen( $raw ) > 4000 ) {
				return null;
			}

			$raw = json_decode( $raw, true );
		}

		if ( ! is_array( $raw ) || ! is_array( $raw['address'] ?? null ) ) {
			return null;
		}

		$address = array();

		foreach ( self::FIELDS as $name ) {
			$value            = $raw['address'][ $name ] ?? '';
			$address[ $name ] = is_string( $value ) ? sanitize_text_field( $value ) : '';
		}

		$place_id = $raw['placeId'] ?? '';

		return array(
			'placeId' => is_string( $place_id ) ? (string) preg_replace( '/[^A-Za-z0-9_-]/', '', $place_id ) : '',
			'address' => $address,
		);
	}
}
