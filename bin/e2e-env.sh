#!/usr/bin/env bash
#
# Builds the WordPress site the end-to-end tests run against, in .e2e/. It uses SQLite and PHP's
# built-in server, so it needs neither MySQL nor Docker. Everything is downloaded from GitHub.
# Running it again starts from a fresh site.
#
# Environment:
#   WP_VERSION         WordPress version (default 7.1.3).
#   WC_VERSION         WooCommerce version (default 11.2.1).
#   SQLITE_VERSION     SQLite Database Integration version (default 3.1.0).
#   GRAVITY_FORMS_ZIP  Path or URL of a Gravity Forms zip. Optional: it's commercial, so it isn't
#                      downloaded, and the Gravity Forms tests are skipped without it.
#   E2E_CACHE          Folder of already downloaded zips (woocommerce.zip,
#                      plugin-sqlite-database-integration.zip, wp-cli.phar) to use instead.
#   E2E_PORT           Port the site is served on (default 8889).

set -euo pipefail

cd "$(dirname "$0")/.."

WP_VERSION=${WP_VERSION:-7.1.3}
WC_VERSION=${WC_VERSION:-11.2.1}
SQLITE_VERSION=${SQLITE_VERSION:-3.1.0}
WP_CLI_VERSION=2.12.0
E2E_PORT=${E2E_PORT:-8889}

ROOT=$(pwd)
DIR="$ROOT/.e2e"
SITE="$DIR/wp"
PLUGINS="$SITE/wp-content/plugins"

# Downloads $2 to $DIR/$1, unless it's in $E2E_CACHE.
fetch() {
	if [[ -n "${E2E_CACHE:-}" && -f "$E2E_CACHE/$1" ]]; then
		cp "$E2E_CACHE/$1" "$DIR/$1"
	else
		curl -fsSL --retry 3 -o "$DIR/$1" "$2"
	fi
}

wp() {
	php "$DIR/wp-cli.phar" --allow-root --path="$SITE" "$@"
}

rm -rf "$SITE"
mkdir -p "$DIR"

echo "WordPress $WP_VERSION"
git clone --quiet --depth 1 --branch "$WP_VERSION" https://github.com/WordPress/WordPress.git "$SITE" 2>/dev/null
rm -rf "$SITE/.git"

[[ -f "$DIR/wp-cli.phar" ]] || fetch wp-cli.phar "https://github.com/wp-cli/wp-cli/releases/download/v$WP_CLI_VERSION/wp-cli-$WP_CLI_VERSION.phar"

echo "SQLite Database Integration $SQLITE_VERSION"
fetch plugin-sqlite-database-integration.zip "https://github.com/WordPress/sqlite-database-integration/releases/download/v$SQLITE_VERSION/plugin-sqlite-database-integration.zip"
unzip -q "$DIR/plugin-sqlite-database-integration.zip" -d "$DIR/sqlite"
mv "$DIR/sqlite/plugin-sqlite-database-integration" "$PLUGINS/sqlite-database-integration"
rm -rf "$DIR/sqlite"
sed -e "s#{SQLITE_IMPLEMENTATION_FOLDER_PATH}#$PLUGINS/sqlite-database-integration#" \
	-e "s#{SQLITE_PLUGIN}#sqlite-database-integration/load.php#" \
	"$PLUGINS/sqlite-database-integration/db.copy" > "$SITE/wp-content/db.php"

cat > "$SITE/wp-config.php" <<PHP
<?php
define( 'DB_NAME', 'wp' );
define( 'DB_USER', '' );
define( 'DB_PASSWORD', '' );
define( 'DB_HOST', '' );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );
define( 'DB_DIR', __DIR__ . '/wp-content/database/' );
define( 'DB_FILE', 'wp.sqlite' );
foreach ( array( 'AUTH_KEY', 'SECURE_AUTH_KEY', 'LOGGED_IN_KEY', 'NONCE_KEY', 'AUTH_SALT', 'SECURE_AUTH_SALT', 'LOGGED_IN_SALT', 'NONCE_SALT' ) as \$salt ) {
	define( \$salt, 'e2e' );
}
\$table_prefix = 'wp_';
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', false );
// Keeps the tests from depending on wordpress.org, woocommerce.com or GitHub.
define( 'WP_HTTP_BLOCK_EXTERNAL', true );
define( 'WP_ENVIRONMENT_TYPE', 'local' );
// WP-CLI's install guesses the site URL from the folder name (".../wp"); state it instead.
define( 'WP_HOME', 'http://127.0.0.1:$E2E_PORT' );
define( 'WP_SITEURL', 'http://127.0.0.1:$E2E_PORT' );
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}
require_once ABSPATH . 'wp-settings.php';
PHP

wp core install --url="http://127.0.0.1:$E2E_PORT" --title="ADRA e2e" --admin_user=admin --admin_password=admin --admin_email=admin@example.com --skip-email --quiet

echo "WooCommerce $WC_VERSION"
fetch woocommerce.zip "https://github.com/woocommerce/woocommerce/releases/download/$WC_VERSION/woocommerce.zip"
unzip -q "$DIR/woocommerce.zip" -d "$PLUGINS"

if [[ -n "${GRAVITY_FORMS_ZIP:-}" ]]; then
	echo "Gravity Forms"
	if [[ "$GRAVITY_FORMS_ZIP" =~ ^https?:// ]]; then
		curl -fsSL --retry 3 -o "$DIR/gravityforms.zip" "$GRAVITY_FORMS_ZIP"
	else
		cp "$GRAVITY_FORMS_ZIP" "$DIR/gravityforms.zip"
	fi
	unzip -q "$DIR/gravityforms.zip" -d "$PLUGINS"
	rm "$DIR/gravityforms.zip"
fi

ln -s "$ROOT" "$PLUGINS/adra-address-autocomplete"

wp plugin activate woocommerce --quiet
[[ -d "$PLUGINS/gravityforms" ]] && wp plugin activate gravityforms --quiet
wp plugin activate adra-address-autocomplete --quiet

wp eval-file tests/e2e/setup/site.php > "$DIR/site.json"

echo "Site ready: http://127.0.0.1:$E2E_PORT ($(cat "$DIR/site.json"))"
