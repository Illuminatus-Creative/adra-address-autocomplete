<?php
/**
 * Sets up the end-to-end test site: run by bin/e2e-env.sh with `wp eval-file`. Prints JSON the
 * tests read (product, page paths, Gravity Forms form IDs).
 *
 * @package Adra\AddressAutocomplete
 */

// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound -- Runs once, in WP-CLI.

update_option( 'permalink_structure', '/%postname%/' );
update_option(
	'adra_aa_settings',
	array(
		// The tests replace Google with a stand-in, so any key will do.
		'google_api_key' => 'e2e-test-key',
		'soft_warning'   => 1,
	)
);

// WooCommerce: a store selling everywhere, with free shipping and cash on delivery.
update_option( 'woocommerce_coming_soon', 'no' );
update_option( 'woocommerce_default_country', 'US:CA' );
update_option( 'woocommerce_allowed_countries', 'all' );
update_option( 'woocommerce_ship_to_countries', '' );
update_option( 'woocommerce_onboarding_profile', array( 'skipped' => true ) );
update_option( 'woocommerce_address_autocomplete_enabled', 'yes' );
update_option( 'woocommerce_address_autocomplete_provider', 'adra-address-autocomplete' );
update_option(
	'woocommerce_cod_settings',
	array(
		'enabled' => 'yes',
		'title'   => 'Cash on delivery',
	)
);

$zone = new WC_Shipping_Zone( 0 );
$zone->add_shipping_method( 'free_shipping' );
$zone->save();

$product = new WC_Product_Simple();
$product->set_name( 'Test poster' );
$product->set_regular_price( '10' );
$product->set_status( 'publish' );
$product->save();

$page_paths = array(
	// WooCommerce's own checkout page uses the Checkout block.
	'blockCheckout'   => get_post( wc_get_page_id( 'checkout' ) )->post_name,
	'classicCheckout' => 'classic-checkout',
	'myAccount'       => get_post( wc_get_page_id( 'myaccount' ) )->post_name,
);

wp_insert_post(
	array(
		'post_type'    => 'page',
		'post_status'  => 'publish',
		'post_name'    => 'classic-checkout',
		'post_title'   => 'Classic checkout',
		'post_content' => '[woocommerce_checkout]',
	)
);

$customer_id = wp_create_user( 'customer', 'customer', 'customer@example.com' );
( new WP_User( $customer_id ) )->set_role( 'customer' );

// Gravity Forms, when installed: an International and a US Address field.
$forms = array();

if ( class_exists( 'GFAPI' ) ) {
	update_option( 'gform_pending_installation', 0 );

	foreach ( array( 'international', 'us' ) as $address_type ) {
		$inputs = array();

		foreach ( array(
			1 => 'Street Address',
			2 => 'Address Line 2',
			3 => 'City',
			4 => 'State / Province / Region',
			5 => 'ZIP / Postal Code',
			6 => 'Country',
		) as $number => $label ) {
			$inputs[] = array(
				'id'    => "1.$number",
				'label' => $label,
			);
		}

		$form_id = GFAPI::add_form(
			array(
				'title'         => "Address $address_type",
				'fields'        => array(
					array(
						'type'          => 'address',
						'id'            => 1,
						'label'         => 'Shipping address',
						'addressType'   => $address_type,
						'inputs'        => $inputs,
						'adraAaEnabled' => true,
					),
				),
				'button'        => array(
					'type' => 'text',
					'text' => 'Submit',
				),
				'confirmations' => array(
					'default' => array(
						'id'        => 'default',
						'name'      => 'Default',
						'isDefault' => true,
						'type'      => 'message',
						'message'   => 'Thanks.',
					),
				),
			)
		);

		wp_insert_post(
			array(
				'post_type'    => 'page',
				'post_status'  => 'publish',
				'post_name'    => "form-$address_type",
				'post_title'   => "Form $address_type",
				'post_content' => "[gravityform id=\"$form_id\" title=\"false\" ajax=\"true\"]",
			)
		);

		$forms[ $address_type ] = $form_id;
	}
}

flush_rewrite_rules();

echo wp_json_encode(
	array(
		'productId'    => $product->get_id(),
		'pages'        => $page_paths,
		'gravityForms' => (object) $forms,
	)
);
