#!/usr/bin/env bash
#
# Builds dist/adra-address-autocomplete.zip, the file sites install and update from.
#
# It holds only what a site needs: the plugin's PHP, the built scripts and images, and
# production Composer packages. Needs `npm ci` and Composer already set up.
#
# Usage: bin/build-zip.sh [tag]
#   tag  Optional, e.g. v1.2.0. Must match the plugin's version.

set -euo pipefail

cd "$(dirname "$0")/.."

SLUG=adra-address-autocomplete
STAGE="dist/$SLUG"

fail() {
	echo "build-zip: $*" >&2
	exit 1
}

# The version must agree everywhere WordPress, the updater and npm read it.
header_version=$(sed -n 's/^ \* Version: *//p' "$SLUG.php")
constant_version=$(sed -n "s/^define( 'ADRA_AA_VERSION', '\(.*\)' );/\1/p" "$SLUG.php")
package_version=$(node -p "require('./package.json').version")

[[ -n "$header_version" ]] || fail "no Version in the plugin header"
[[ "$constant_version" == "$header_version" ]] || fail "ADRA_AA_VERSION ($constant_version) doesn't match the header ($header_version)"
[[ "$package_version" == "$header_version" ]] || fail "package.json version ($package_version) doesn't match the header ($header_version)"

if [[ $# -gt 0 && "$1" != "v$header_version" ]]; then
	fail "tag $1 doesn't match the plugin version $header_version (expected v$header_version)"
fi

npm run build --silent

for bundle in admin-settings gravity-forms woocommerce-admin-order woocommerce-provider; do
	[[ -f "assets/build/$bundle.js" && -f "assets/build/$bundle.asset.php" ]] || fail "assets/build/$bundle.js is missing"
done

rm -rf dist
mkdir -p "$STAGE/assets"

cp "$SLUG.php" uninstall.php composer.json composer.lock LICENSE README.md "$STAGE/"
cp -R src "$STAGE/src"
cp -R assets/build assets/images "$STAGE/assets/"
[[ -d languages ]] && cp -R languages "$STAGE/languages"

composer install --working-dir="$STAGE" --no-dev --prefer-dist --optimize-autoloader --no-interaction --no-progress --quiet
rm "$STAGE/composer.json" "$STAGE/composer.lock"
# Composer falls back to a git clone when it can't download a package, which brings its history.
find "$STAGE" -name .git -prune -exec rm -rf {} +

# Every PHP file must parse on the minimum PHP version's syntax (checked with the runner's PHP).
find "$STAGE" -name '*.php' -not -path '*/vendor/*' -print0 | xargs -0 -n1 php -l >/dev/null

(cd dist && zip -rqX "$SLUG.zip" "$SLUG")

echo "Built dist/$SLUG.zip (version $header_version, $(du -k "dist/$SLUG.zip" | cut -f1) KB)"
