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
```

PHP classes live in `src/` under the `Adra\AddressAutocomplete` namespace and are autoloaded by Composer (PSR-4), so a clone needs `composer install` before the plugin will activate.

## Credits

The autocomplete engine is being ported from GP Address Autocomplete by Gravity Wiz, which is licensed under the GPL.

## License

GPL-2.0-only. See [LICENSE](LICENSE).
