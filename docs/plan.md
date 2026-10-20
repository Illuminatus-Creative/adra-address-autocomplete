# ADRA Address Autocomplete — Build Plan

Plugin by The Ad Ranch. Internal use on our own and client sites. Terms follow [glossary.md](glossary.md).

## Goal

Reduce wasted postage by helping people enter deliverable addresses, and flag the ones that didn't come from a selected suggestion.

## Scope

In scope:

- Gravity Forms: Address field autocomplete.
- WooCommerce: billing and shipping address autocomplete on
  - classic checkout
  - block checkout
  - My Account → Addresses
  - admin order edit screen
- Recording whether each submitted address matches a selected suggestion.

Out of scope: Map field, Travel Estimate field, Routes API, Gravity Wiz add-on compatibility (Easy Passthrough, Populate Anything), migrating data from GP Address Autocomplete.

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Source | Port the autocomplete engine from `gp-address-autocomplete/js/src/frontend.ts`. Rewrite the PHP. | The PHP depends on Gravity Perks base classes that aren't in this repo. The PHP for Map/Travel Estimate is out of scope. |
| Licence | GPL-2.0-only. Keep a credit to Gravity Wiz for the ported code. No "Gravity Wiz", "Gravity Perks" or "GP" naming. | The original's header says "GPL2" with no "or later", so the conservative reading is v2 only. Giving it to clients is distribution under the GPL. |
| Repository | New **public** repo `Illuminatus-Creative/adra-address-autocomplete`, containing only the plugin. This repo stays private as the Gravity Wiz reference. | Public means no GitHub token on client sites for updates. The plugin holds no secrets (Google keys are set per site). |
| Google API | Places API (New) only. Drop the legacy `google.maps.places.Autocomplete` code path. | New Google Cloud projects can't enable the legacy Places API (since March 2025). |
| Where Google is called | In the browser via the Maps JavaScript API, using a key restricted by HTTP referrer and by API. | A server-side proxy would be a public endpoint that spends our Google quota. |
| WooCommerce checkout + My Account | Register as a WooCommerce core address provider (`WC_Address_Provider` + `woocommerce_address_providers`). WooCommerce draws the dropdown. | WooCommerce handles classic checkout (since 10.1), block checkout (since 10.3), and the country → state reload order. Its classic script binds to `#billing_address_1` / `#shipping_address_1` on any frontend page, so My Account should be covered too (confirm in testing). |
| WooCommerce admin order edit | Our own adapter + our own dropdown. | WooCommerce's framework doesn't run on the admin order screen. |
| Gravity Forms | Our own adapter + our own dropdown, ported from GPAA. | No core framework to plug into. |
| WooPayments stores | Both providers show up in WooCommerce → Settings → General → Address autocomplete. The admin picks the preferred one. | Address status tracking only works when our provider handles the selection. |
| Minimum versions | WooCommerce 10.3, Gravity Forms 3.0.3 (country choices became codes; older versions untested), WordPress 6.7, PHP 8.1. | WooCommerce 10.3 is the first release with block checkout support for providers. All client stores are up to date, so we don't need a fallback for older WooCommerce versions. |
| Google keys | One Google Cloud project and key per client, set per site (`ADRA_AA_GOOGLE_API_KEY` in `wp-config.php`, or the settings page). | Each client is billed for their own usage. |
| Updates | GitHub Releases + [plugin-update-checker](https://github.com/YahnisElsts/plugin-update-checker) (MIT, v5), using a release zip asset built by GitHub Actions. | Updates show up on client sites' normal Plugins screen. |
| Bad addresses | Record the address status **and** show a soft warning as a one-time confirm at submit. | Agreed with The Ad Ranch. A one-time confirm gets read; an inline message gets scrolled past. |
| Prefixes | Slug and text domain `adra-address-autocomplete`. PHP namespace `Adra\AddressAutocomplete`. Options and meta `adra_aa_`. Constants `ADRA_AA_`. Script handles `adra-aa-`. JS hooks `adra_aa.`. | Can run alongside GP Address Autocomplete without name collisions. |

## Address status

When a suggestion is selected, the client records the normalized address. On submit, the server compares the submitted address with it (case- and whitespace-insensitive, `address_2` ignored):

- `verified`: matches the selected suggestion
- `modified`: a suggestion was selected, then edited
- `manual`: no suggestion was selected
- `unknown`: another provider handled the selection (e.g. WooPayments)

Where it's stored:

- WooCommerce: order meta `_adra_aa_billing_status` and `_adra_aa_shipping_status`, plus the Google `place_id`. Written through `$order->update_meta_data()` so it works with both HPOS and legacy order storage. Shown as a badge in the order edit screen, with an optional order list column.
- Gravity Forms: entry meta `adra_aa_status_{fieldId}`, `adra_aa_changed_{fieldId}` (edited parts) and `adra_aa_place_id_{fieldId}`. The status is registered as entry meta, so it can be shown in the entry list, filtered on and used in conditional logic, and an "Address status" box shows it on the entry screen. Not recorded when the field is hidden by conditional logic.
- My Account addresses: not recorded (there's no order or entry to attach it to).

Soft warning:

- Shown when the status would be `manual` or `modified`. Never blocks a valid submission for good.
- Wording (filterable): "We couldn't match this address to a known address. Please check it before continuing."
- One-time confirm: the first submit with an unconfirmed address stops and shows the warning. Submitting again with the same address goes through. Editing the address again re-arms the check.
- Gravity Forms: server-side in `gform_validation`. The field fails validation with the warning, and a hidden `adra_aa_confirmed_{fieldId}` input carries a hash of the warned address, so the next submit with that address passes.
- Classic checkout: client-side, by returning `false` from the `checkout_place_order` handler the first time.
- Block checkout: client-side, through an `onCheckoutValidation` observer registered with `registerPlugin`, which returns the warning the first time.
- The warning is a convenience, not a security control, so client-side is fine for WooCommerce. The status itself is always computed server-side.
- Applies to classic checkout, block checkout and Gravity Forms. Not shown on the admin order screen.
- Settings: on/off, and on/off for addresses outside the countries Google covers well.

How the data reaches the server:

- Classic checkout: hidden inputs added through `woocommerce_after_checkout_billing_form` / `woocommerce_after_checkout_shipping_form`.
- Block checkout: `setExtensionData( 'adra-address-autocomplete', … )` on the client. The server registers the schema with `woocommerce_store_api_register_endpoint_data` and saves it in `woocommerce_store_api_checkout_update_order_from_request`.
- Gravity Forms: a hidden input per field (the pattern from GPAA `add_coord_input`).

## Plugin structure

```
adra-address-autocomplete/
├─ adra-address-autocomplete.php   header, requirement checks, boot on plugins_loaded,
│                                  declares HPOS + cart_checkout_blocks compatibility
├─ uninstall.php                   removes options; keeps order/entry meta
├─ composer.json  phpcs.xml.dist  phpunit.xml.dist
├─ package.json  tsconfig.json     @wordpress/scripts (build, ESLint, Vitest)
├─ src/
│  ├─ Plugin.php                   loads modules based on active plugins
│  ├─ Settings/Options.php         API key: ADRA_AA_GOOGLE_API_KEY constant, else option
│  ├─ Settings/Settings_Page.php   Settings → Address Autocomplete (works without GF or WC)
│  ├─ Assets/Google_Loader.php     one Maps JS loader; steps aside if another plugin loads Google Maps
│  ├─ Assets/Bundle.php            registers webpack bundles from assets/build/
│  ├─ Assets/Script_Data.php       countries + WooCommerce state lists for JS
│  ├─ Address/Status.php           compares selected vs submitted address
│  ├─ Gravity_Forms/Addon.php      GFAddOn: field setting, init scripts, entry meta, entry detail
│  ├─ WooCommerce/Provider.php     extends WC_Address_Provider
│  ├─ WooCommerce/Checkout_Classic.php
│  ├─ WooCommerce/Checkout_Blocks.php
│  ├─ WooCommerce/Admin_Order.php  order edit screen (HPOS + legacy post screen)
│  └─ WooCommerce/Order_Display.php
├─ assets/src/
│  ├─ admin/settings.ts, key-check.ts  "Test key" button
│  ├─ address/match.ts             selected vs submitted address comparison
│  ├─ engine/places-client.ts      session tokens, fetchAutocompleteSuggestions, fetchFields
│  ├─ engine/google-ready.ts       waits for Google, loads the Places library
│  ├─ engine/adr.ts                adrFormatAddress parser
│  ├─ engine/parse-place.ts        place → { address1, address2, city, postcode, region, countryCode, … }
│  ├─ engine/match-option.ts       Google names/codes → select option or state code
│  ├─ ui/dropdown.ts (+ .css)      suggestion list, keyboard nav, ARIA combobox, iOS positioning fix
│  ├─ adapters/woocommerce-state.ts  WooCommerce state value (code / blank / free text)
│  ├─ adapters/gravity-forms.ts
│  ├─ adapters/wc-provider.ts      wc.addressAutocomplete.registerAddressAutocompleteProvider
│  ├─ adapters/wc-admin-order.ts
│  └─ status/tracker.ts
└─ languages/
```

JS hooks move from `window.gform.applyFilters` to `@wordpress/hooks` so the engine runs without Gravity Forms loaded.

## What carries over from GPAA

| GPAA | New plugin |
|---|---|
| `frontend.ts`: Places API (New) suggestion fetching, session tokens, debounce/min-chars | `engine/places-client.ts`, `ui/dropdown.ts` |
| `frontend.ts`: `fillFields`, `parseAdrAddressHTML`, country/state matching | `engine/adr.ts`, `engine/parse-place.ts`, `engine/match-option.ts`, rewritten to return a neutral address object instead of writing to inputs |
| `frontend.ts`: dropdown rendering, keyboard nav, iOS/visualViewport fix, browser autofill suppression | `ui/dropdown.ts` |
| `frontend.ts`: legacy `google.maps.places.Autocomplete` path | dropped |
| `class-gp-address-autocomplete.php`: init script per field, hidden input per field, entry meta registration, settings fields | `Gravity_Forms/Addon.php`, rewritten on `GFAddOn` |
| Map/Travel Estimate fields, Routes API, Easy Passthrough compatibility, Gravity Perks bootstrap | dropped |

## Phases

Size: S = under a day, M = a few days, L = a week or more.

| # | Phase | Size | Done when |
|---|---|---|---|
| 0 | Scaffold: main file, autoloading, WPCS phpcs, TypeScript typecheck, PHPUnit + Vitest, GitHub Actions running lint + tests | S | Empty plugin activates; CI green. The webpack build is added in phase 1, with the first script that needs bundling |
| 1 | Engine: port and split `frontend.ts`; Vitest tests on Google place fixtures (US, CA, GB, IE, AU, NZ, NL, FR, DE, ES, IT, JP, SG) | M | Done. The fixtures are now real recordings from the Places API (New); they exposed four engine bugs, fixed in phase 4 (street missing for landmarks, a district taken as the state, Irish county, ZIP+4) |
| 2 | Settings page + Google loader + key check + webpack build | S | Done. Key from constant or option; Maps loads once, and the loader steps aside (and says so on the settings page) when another plugin loads it; a "Test key" button runs one real search from the browser and explains the usual setup mistakes. Checked in a real WordPress 7.1.3 + WooCommerce 11.2.1 site in Chromium, including a real Google response to an invalid key |
| 3 | Gravity Forms | M | Done. Per-field toggle in the form editor; fills International and US Address fields; works across multi-page forms, save-and-continue and conditional logic; status saved to entry meta and shown on the entry screen. Checked in a real WordPress 7.1.3 + Gravity Forms 3.1.3.4 site in Chromium (17 checks), with Google's Places library replaced by a stand-in returning fixture data |
| 4 | WooCommerce provider | M | Done. Provider appears in WooCommerce settings; fills classic checkout, block checkout and My Account with WooCommerce state codes. Checked with real Google in WordPress 7.1.3 + WooCommerce 11.2.1 (12 checks), and the Gravity Forms checks re-run with real Google (18) |
| 5 | Address status + soft warning (classic, blocks, Gravity Forms) + order display | M | Correct status on test orders under HPOS and legacy storage; warning appears for `manual`/`modified` and never stops a second submit |
| 6 | Admin order edit adapter | S–M | Billing and shipping fill on the order edit screen, including the state reload |
| 7 | End-to-end tests + release pipeline | M | Playwright passes on GF, classic checkout, block checkout, My Account and admin, with a stubbed `google.maps`. Pushing a `v*` tag makes GitHub Actions build the zip (no dev files) and attach it to a release. A test site updates from that release through the Plugins screen. |

Optional later:

- Google Address Validation API at submit time. This checks deliverability, not just that an address exists. It is billed separately.

## Risks

- **The WooCommerce provider API is new** (block support since 10.3) and may still change. Test against each WooCommerce release before updating client sites.
- **Google cost**: each autocomplete session plus details lookup is billed to the key's project. Keep session tokens; check whether WooCommerce's UI debounces requests before relying on it.
- **Places API (New) country restriction is limited** (`includedRegionCodes`, max 15 countries). Stores shipping to more countries can't restrict results and will only get biased results.
- **State mapping**: Google's region codes don't match WooCommerce's state codes for every country. The engine tries each administrative area as a code, as an ISO 3166-2 code (`BY` → `DE-BY`) and as a name (ignoring accents and words like "County"), with the second level first for ES and IT, where WooCommerce lists provinces. Unmatched states are left blank. The ES/IT ordering and the Irish county names are assumptions until real recordings confirm them.
- **Places language**: Google answers in the visitor's browser language. Names (not codes) won't match WooCommerce's English state names for, say, a Japanese-language browser; those fall back to blank.
- **Double-loading Google Maps** when another plugin (GPAA, store locators, map blocks) also loads it. The loader steps aside when another enqueued script loads the Maps JavaScript API, and the engine uses that copy. That plugin's key then has to have the Places API (New) enabled, which we can't check except with "Test key". Scripts printed without `wp_enqueue_script` aren't detected; the `adra_aa_load_google_maps` filter turns our loader off for those sites.
- **Public browser key**: it must be restricted by HTTP referrer and by API (Maps JavaScript API and Places API (New)), or anyone can use it on our bill.
- **WooPayments stores**: if its provider is preferred, our address status will be `unknown`.
- **Google attribution**: Google's policy requires its logo wherever Places results appear without a Google map. The WooCommerce provider's branding and our own dropdown show "Powered by" + the Google logo.
- **Google caching rules**: only the place ID is stored (Google allows keeping it indefinitely), never Google's place details. GPAA stored the whole place response, which those rules don't allow.
- **The selected address comes from the browser.** A determined person could forge a `verified` status by editing the hidden input. The status is for catching mistakes, not fraud; checking server-side would need a second, server-restricted Google key.
- **The update channel can push code to every client site.** Anyone who can publish a release can do that. Turn on 2FA on the GitHub account, protect `main`, and only publish releases from the tag workflow.

## Open questions

None at the moment.
