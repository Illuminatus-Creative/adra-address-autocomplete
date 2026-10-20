<?php
/**
 * Address status: how a submitted address relates to the selected suggestion.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\Address;

/**
 * Compares the selected address with the submitted address.
 *
 * Mirrors assets/src/address/match.ts. Both are tested against
 * tests/fixtures/address-match-cases.json; change them together.
 */
final class Status {

	public const VERIFIED = 'verified';
	public const MODIFIED = 'modified';
	public const MANUAL   = 'manual';
	public const UNKNOWN  = 'unknown';

	/*
	 * address_2 is left out on purpose: people routinely add an apartment or unit number after
	 * selecting a suggestion, and that doesn't make the street address wrong.
	 */
	private const COMPARED_FIELDS = array( 'address_1', 'city', 'state', 'postcode', 'country' );

	/**
	 * Works out the address status.
	 *
	 * @param array<string, mixed>|null $selected  Selected address, or null when no suggestion was selected.
	 * @param array<string, mixed>      $submitted Submitted address.
	 * @return array{status: string, changed: list<string>}
	 */
	public static function compare( ?array $selected, array $submitted ): array {
		if ( null === $selected ) {
			return array(
				'status'  => self::MANUAL,
				'changed' => array(),
			);
		}

		$changed = array();

		foreach ( self::COMPARED_FIELDS as $field ) {
			$before = self::text( $selected[ $field ] ?? '' );
			$after  = self::text( $submitted[ $field ] ?? '' );

			// Google doesn't return every part for every country; filling a gap isn't an edit.
			if ( '' === self::normalize_text( $before ) ) {
				continue;
			}

			$same = 'postcode' === $field
				? self::postcodes_match( $before, $after )
				: self::normalize_text( $before ) === self::normalize_text( $after );

			if ( ! $same ) {
				$changed[] = $field;
			}
		}

		return array(
			'status'  => $changed ? self::MODIFIED : self::VERIFIED,
			'changed' => $changed,
		);
	}

	/**
	 * Labels for the status values, for admin screens.
	 *
	 * @return array<string, string>
	 */
	public static function labels(): array {
		return array(
			self::VERIFIED => __( 'Verified: matches the selected suggestion', 'adra-address-autocomplete' ),
			self::MODIFIED => __( 'Modified after selecting a suggestion', 'adra-address-autocomplete' ),
			self::MANUAL   => __( 'Manual: no suggestion selected', 'adra-address-autocomplete' ),
			self::UNKNOWN  => __( 'Unknown: another address provider was used', 'adra-address-autocomplete' ),
		);
	}

	/**
	 * Normalizes text so formatting-only differences don't count as edits: case, accents, repeated
	 * whitespace and the punctuation people add or drop ("St." vs "St", "Apt #4").
	 *
	 * @param string $value Raw value.
	 */
	public static function normalize_text( string $value ): string {
		if ( class_exists( \Normalizer::class ) ) {
			$value = (string) preg_replace( '/\p{M}/u', '', (string) \Normalizer::normalize( $value, \Normalizer::FORM_KD ) );
		} elseif ( function_exists( 'remove_accents' ) ) {
			$value = remove_accents( $value );
		}

		$value = mb_strtolower( $value, 'UTF-8' );
		$value = (string) preg_replace( "/[.,#'\x{2019}]/u", ' ', $value );
		$value = (string) preg_replace( '/\s+/u', ' ', $value );

		return trim( $value );
	}

	/**
	 * Normalizes a postcode, ignoring spaces, hyphens and case.
	 *
	 * @param string $value Raw postcode.
	 */
	public static function normalize_postcode( string $value ): string {
		return mb_strtoupper( (string) preg_replace( '/[\s-]/u', '', $value ), 'UTF-8' );
	}

	/**
	 * Compares postcodes. Adding or removing a US ZIP+4 extension isn't an edit (Google returns either form); changing it is.
	 *
	 * @param string $selected  Selected postcode.
	 * @param string $submitted Submitted postcode.
	 */
	private static function postcodes_match( string $selected, string $submitted ): bool {
		$selected  = self::normalize_postcode( $selected );
		$submitted = self::normalize_postcode( $submitted );

		if ( $selected === $submitted ) {
			return true;
		}

		$zip = '/^(\d{5})(\d{4})?$/';

		return 1 === preg_match( $zip, $selected, $zip_selected )
			&& 1 === preg_match( $zip, $submitted, $zip_submitted )
			&& $zip_selected[1] === $zip_submitted[1]
			&& ( empty( $zip_selected[2] ) || empty( $zip_submitted[2] ) );
	}

	/**
	 * Casts a field value to a string, treating anything else as empty.
	 *
	 * @param mixed $value Field value.
	 */
	private static function text( $value ): string {
		return is_string( $value ) || is_int( $value ) ? (string) $value : '';
	}
}
