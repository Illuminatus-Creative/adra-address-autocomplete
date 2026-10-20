<?php
/**
 * The soft warning.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\Address;

/**
 * Text of the soft warning, and the key that records an address the person already confirmed.
 */
final class Warning {

	/**
	 * Message asking the person to check an address that didn't come from a suggestion unchanged.
	 */
	public static function message(): string {
		/**
		 * Filters the soft warning shown when an address doesn't match a selected suggestion.
		 *
		 * @param string $message Message.
		 */
		return (string) apply_filters(
			'adra_aa_soft_warning_message',
			__( 'We couldn’t match this address to a known address. Please check it, then submit again to use it as entered.', 'adra-address-autocomplete' )
		);
	}

	/**
	 * Identifies an address regardless of formatting, so a confirmation only covers that address.
	 * Also stored with an order's address status, to tell when the address was edited later.
	 *
	 * @param array<string, mixed> $address Address fields.
	 */
	public static function key( array $address ): string {
		$parts = array();

		foreach ( array( 'address_1', 'city', 'state', 'country' ) as $field ) {
			$parts[] = Status::normalize_text( is_string( $address[ $field ] ?? null ) ? $address[ $field ] : '' );
		}

		$parts[] = Status::normalize_postcode( is_string( $address['postcode'] ?? null ) ? $address['postcode'] : '' );

		return substr( hash( 'sha256', implode( '|', $parts ) ), 0, 16 );
	}
}
