# ADRA Address Autocomplete

Google Places address autocomplete for Gravity Forms and WooCommerce, by The Ad Ranch. Its goal is fewer undeliverable addresses: it suggests real addresses as people type, records whether each submitted address matches a suggestion, and asks people to double-check addresses that don't.

Status: in development. See [docs/plan.md](docs/plan.md) for scope, decisions and phases. Terms are defined in [docs/glossary.md](docs/glossary.md).

## Requirements

- WordPress 6.7+
- PHP 8.1+
- Gravity Forms 3.0.3+ and/or WooCommerce 10.3+
- A Google Cloud API key with the Maps JavaScript API and Places API (New) enabled, one per client site

## Development

```sh
composer install
npm install

composer lint      # WordPress Coding Standards + PHP compatibility
composer test      # PHPUnit
npm run lint:js    # ESLint (WordPress config)
npm run typecheck  # TypeScript
npm run test:js    # Vitest
npm run build      # Bundles assets/src into assets/build (needed before the plugin's scripts load)
npm run build:zip  # Builds dist/adra-address-autocomplete.zip, as released
```

PHP classes live in `src/` under the `Adra\AddressAutocomplete` namespace and are autoloaded by Composer (PSR-4), so a clone needs `composer install` before the plugin will activate.

### End-to-end tests

The Playwright tests run against a real WordPress + WooCommerce site on SQLite and PHP's built-in server (no MySQL or Docker). Google is replaced by a stand-in that serves the recorded places in `tests/fixtures/places/`, so no key or network is needed while testing.

```sh
npx playwright install chromium
bin/e2e-env.sh       # builds the site in your temp folder (run again for a fresh one)
npm run test:e2e
```

Gravity Forms is commercial, so `bin/e2e-env.sh` only installs it when `GRAVITY_FORMS_ZIP` points to a zip (a path or URL); otherwise its tests are skipped. In CI, set the repository secret `GRAVITY_FORMS_ZIP_URL` to include them. See the top of `bin/e2e-env.sh` for the other settings.

## Releasing

1. Set the new version in three places: the `Version:` header and `ADRA_AA_VERSION` in `adra-address-autocomplete.php`, and `version` in `package.json`.
2. Merge to `main`.
3. Tag the merge commit and push the tag: `git tag v1.2.0 && git push origin v1.2.0`. Or, on GitHub, Releases → Draft a new release, with a new tag `v1.2.0` on `main`, and publish it.

The release workflow runs every check, builds `adra-address-autocomplete.zip` with `bin/build-zip.sh`, and publishes it as a GitHub release (or attaches it to the release made on the website, a few minutes after publishing it). It refuses a tag that isn't on `main` or doesn't match the version. A tag with a suffix (`v1.2.0-rc.1`) becomes a pre-release, which sites ignore.

To install the plugin on a site for the first time, upload that zip under Plugins → Add New → Upload Plugin. The source code zips GitHub adds to each release don't work: they lack `vendor/` and the built scripts.

## Updates

Sites check this repository's latest GitHub release twice a day ([plugin-update-checker](https://github.com/YahnisElsts/plugin-update-checker)) and show updates on the Plugins screen like any other plugin. The plugin's row also has a "Check for updates" link.

- Only the release's `adra-address-autocomplete.zip` is installed. If the latest release doesn't have it, no update is offered; the update checker never falls back to a source zip. "Check for updates" then says it "could not determine if updates are available", which is also what it says before the first release exists.
- A plugin folder that's a git checkout never checks for updates. Turn checks off elsewhere with `add_filter( 'adra_aa_check_for_updates', '__return_false' );` in a must-use plugin.
- GitHub allows 60 unauthenticated API requests an hour per IP address. Sites check twice a day, so this only matters on hosts with many sites behind one address.
- Anyone who can push a tag can ship code to every client site. Keep `main` protected and two-factor authentication on for everyone with write access.

## Credits

The autocomplete engine is ported from GP Address Autocomplete by Gravity Wiz, which is licensed under the GPL.

`assets/images/google.svg` is Google's logo, shown under address suggestions as Google's Places API policies require (the same file WooCommerce ships for its Google provider). It is a Google trademark.

## License

GPL-2.0-only. See [LICENSE](LICENSE).
