<?php
/**
 * Address status box on the WooCommerce order screen.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\WooCommerce;

use Adra\AddressAutocomplete\Address\Status;
use Adra\AddressAutocomplete\Address\Warning;
use WC_Order;

/**
 * Shows the address status on the order edit screen (HPOS and the legacy post screen).
 */
final class Order_Display {

	/**
	 * Registers hooks.
	 */
	public function register(): void {
		add_action( 'add_meta_boxes', array( $this, 'add_meta_box' ) );
	}

	/**
	 * Adds the box to the order screen.
	 */
	public function add_meta_box(): void {
		$screen = function_exists( 'wc_get_page_screen_id' ) ? wc_get_page_screen_id( 'shop-order' ) : 'shop_order';

		add_meta_box( 'adra-aa-address-status', __( 'Address status', 'adra-address-autocomplete' ), array( $this, 'render' ), $screen, 'side' );
	}

	/**
	 * Prints the box.
	 *
	 * @param \WP_Post|WC_Order $post_or_order Order, or its post on the legacy screen.
	 */
	public function render( $post_or_order ): void {
		$order = $post_or_order instanceof WC_Order ? $post_or_order : wc_get_order( $post_or_order->ID ?? 0 );

		if ( ! $order instanceof WC_Order ) {
			return;
		}

		$labels = Status::labels();
		$types  = array(
			'billing'  => __( 'Billing address', 'adra-address-autocomplete' ),
			'shipping' => __( 'Shipping address', 'adra-address-autocomplete' ),
		);
		$shown  = 0;

		echo '<ul>';

		foreach ( $types as $type => $type_label ) {
			$status = (string) $order->get_meta( Order_Status::meta_key( $type, 'status' ) );

			if ( '' === $status ) {
				continue;
			}

			$changed = array_filter( explode( ',', (string) $order->get_meta( Order_Status::meta_key( $type, 'changed' ) ) ) );
			++$shown;

			printf( '<li><strong>%s</strong><br>%s', esc_html( $type_label ), esc_html( $labels[ $status ] ?? $status ) );

			if ( $changed ) {
				printf(
					/* translators: %s: comma-separated list of address parts, e.g. "city, postcode". */
					'<br>' . esc_html__( 'Changed: %s', 'adra-address-autocomplete' ),
					esc_html( implode( ', ', $changed ) )
				);
			}

			if ( self::edited_since_checkout( $order, $type ) ) {
				printf( '<br><em>%s</em>', esc_html__( 'The address has been edited since checkout. This status is for the address as ordered.', 'adra-address-autocomplete' ) );
			}

			echo '</li>';
		}

		echo '</ul>';

		if ( 0 === $shown ) {
			printf( '<p>%s</p>', esc_html__( 'Not recorded for this order.', 'adra-address-autocomplete' ) );
		}
	}

	/**
	 * Whether the address differs from the one the status was recorded for.
	 *
	 * @param WC_Order $order Order.
	 * @param string   $type  "billing" or "shipping".
	 */
	private static function edited_since_checkout( WC_Order $order, string $type ): bool {
		$recorded = (string) $order->get_meta( Order_Status::meta_key( $type, 'address_key' ) );

		return '' !== $recorded && Warning::key( $order->get_address( $type ) ) !== $recorded;
	}
}
