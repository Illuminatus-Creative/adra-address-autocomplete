<?php
/**
 * Router for PHP's built-in server: serves real files and sends everything else to WordPress.
 *
 * @package Adra\AddressAutocomplete
 */

// phpcs:disable WordPress.Security.ValidatedSanitizedInput, WordPress.NamingConventions.PrefixAllGlobals -- Local test server only.

// WordPress isn't loaded yet, so wp_parse_url() isn't available.
$request_path = (string) parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH ); // phpcs:ignore WordPress.WP.AlternativeFunctions.parse_url_parse_url
$request_file = $_SERVER['DOCUMENT_ROOT'] . $request_path;

if ( '/' !== $request_path && is_file( $request_file ) ) {
	return false;
}

if ( is_dir( $request_file ) && is_file( rtrim( $request_file, '/' ) . '/index.php' ) ) {
	$_SERVER['SCRIPT_NAME'] = rtrim( $request_path, '/' ) . '/index.php';
	require rtrim( $request_file, '/' ) . '/index.php';
	return;
}

$_SERVER['SCRIPT_NAME'] = '/index.php';
require $_SERVER['DOCUMENT_ROOT'] . '/index.php';
