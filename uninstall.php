<?php
/**
 * Removes the plugin's settings when it is deleted.
 *
 * Address status saved on orders and form entries is kept: it belongs to those records.
 *
 * @package Adra\AddressAutocomplete
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'adra_aa_settings' );
