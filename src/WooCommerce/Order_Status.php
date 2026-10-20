<?php
/**
 * Address status on WooCommerce orders.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\WooCommerce;

use Adra\AddressAutocomplete\Address\Selection;
use Adra\AddressAutocomplete\Address\Status;
use WC_Order;

/**
 * Records, on each order, how its billing and shipping addresses relate to the suggestions the
 * customer selected.
 *
 * The browser sends the selections as JSON: `{"billing": selection|null, "shipping": selection|null,
 * "unknown": ["billing"]}`, in a hidden input on the classic checkout and as Store API extension
 * data on the block checkout. "unknown" lists address types another provider handled. When nothing
 * is sent (WooCommerce's address autocomplete is off), no status is recorded.
 */
final class Order_Status {

	/** Store API extension namespace, and the classic checkout's hidden input name. */
	public const STORE_API_NAMESPACE = 'adra-address-autocomplete';
	public const CLASSIC_INPUT       = 'adra_aa_selection';

	public const TYPES = array( 'billing', 'shipping' );

	/**
	 * Registers hooks.
	 */
	public function register(): void {
		add_action( 'woocommerce_checkout_create_order', array( $this, 'save_classic' ) );
		add_action( 'woocommerce_store_api_checkout_update_order_from_request', array( $this, 'save_blocks' ), 10, 2 );
		add_action( 'woocommerce_blocks_loaded', array( $this, 'register_store_api_data' ) );
	}

	/**
	 * Lets the block checkout send the selections with the order.
	 */
	public function register_store_api_data(): void {
		if ( ! function_exists( 'woocommerce_store_api_register_endpoint_data' ) ) {
			return;
		}

		woocommerce_store_api_register_endpoint_data(
			array(
				'endpoint'        => \Automattic\WooCommerce\StoreApi\Schemas\V1\CheckoutSchema::IDENTIFIER,
				'namespace'       => self::STORE_API_NAMESPACE,
				'schema_callback' => static fn() => array(
					'selection' => array(
						'description' => __( 'Selected addresses, as JSON.', 'adra-address-autocomplete' ),
						'type'        => array( 'string', 'null' ),
						'context'     => array( 'view', 'edit' ),
					),
				),
				'schema_type'     => ARRAY_A,
			)
		);
	}

	/**
	 * Records the status on a classic checkout order, before it is saved.
	 *
	 * @param WC_Order $order New order.
	 */
	public function save_classic( $order ): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- WooCommerce verifies the checkout nonce before creating the order.
		if ( $order instanceof WC_Order && isset( $_POST[ self::CLASSIC_INPUT ] ) ) {
			// phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Decoded and reduced to known, sanitized fields by apply().
			$this->apply( $order, wp_unslash( $_POST[ self::CLASSIC_INPUT ] ) );
		}
	}

	/**
	 * Records the status on a block checkout order.
	 *
	 * @param WC_Order         $order   Order being placed.
	 * @param \WP_REST_Request $request Store API request.
	 */
	public function save_blocks( $order, $request ): void {
		$extensions = $request['extensions'] ?? array();
		$payload    = $extensions[ self::STORE_API_NAMESPACE ]['selection'] ?? null;

		if ( $order instanceof WC_Order && is_string( $payload ) ) {
			$this->apply( $order, $payload );
			$order->save();
		}
	}

	/**
	 * Works out and stores each address type's status.
	 *
	 * @param WC_Order $order   Order.
	 * @param mixed    $payload JSON from the browser.
	 */
	public function apply( WC_Order $order, $payload ): void {
		$data = is_string( $payload ) && strlen( $payload ) <= 9000 ? json_decode( $payload, true ) : null;

		if ( ! is_array( $data ) ) {
			return;
		}

		$unknown   = array_intersect( self::TYPES, (array) ( $data['unknown'] ?? array() ) );
		$addresses = array( 'billing' => $order->get_address( 'billing' ) );

		if ( $order->has_shipping_address() ) {
			$addresses['shipping'] = $order->get_address( 'shipping' );
		}

		foreach ( self::results( $addresses, $data, $unknown ) as $type => $result ) {
			$order->update_meta_data( self::meta_key( $type, 'status' ), $result['status'] );
			$order->update_meta_data( self::meta_key( $type, 'changed' ), implode( ',', $result['changed'] ) );
			$order->update_meta_data( self::meta_key( $type, 'place_id' ), $result['placeId'] );
		}
	}

	/**
	 * Status for each address type.
	 *
	 * When the customer selected a suggestion for one address and the other is the same address
	 * (shipping to the billing address, or "use same address for billing"), the other gets the
	 * same result.
	 *
	 * @param array<string, array<string, string>> $addresses Order addresses by type.
	 * @param array<string, mixed>                 $data      Decoded payload.
	 * @param string[]                             $unknown   Types another provider handled.
	 * @return array<string, array{status: string, changed: list<string>, placeId: string}>
	 */
	public static function results( array $addresses, array $data, array $unknown ): array {
		$selections = array();
		$results    = array();

		foreach ( array_keys( $addresses ) as $type ) {
			$selections[ $type ] = Selection::decode( $data[ $type ] ?? null );
		}

		foreach ( $addresses as $type => $address ) {
			if ( in_array( $type, $unknown, true ) ) {
				$results[ $type ] = array(
					'status'  => Status::UNKNOWN,
					'changed' => array(),
					'placeId' => '',
				);
				continue;
			}

			$selection = $selections[ $type ];

			if ( null === $selection ) {
				foreach ( $addresses as $other => $other_address ) {
					if ( $other !== $type && null !== $selections[ $other ] && Status::VERIFIED === Status::compare( $other_address, $address )['status'] ) {
						$selection = $selections[ $other ];
					}
				}
			}

			$results[ $type ] = Status::compare( $selection['address'] ?? null, $address ) + array( 'placeId' => $selection['placeId'] ?? '' );
		}

		return $results;
	}

	/**
	 * Order meta key.
	 *
	 * @param string $type  "billing" or "shipping".
	 * @param string $field "status", "changed" or "place_id".
	 */
	public static function meta_key( string $type, string $field ): string {
		return '_adra_aa_' . $type . '_' . $field;
	}
}
