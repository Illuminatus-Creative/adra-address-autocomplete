# Glossary

One word per idea, in code, comments, UI text and docs. If a change needs a new term, add it here first.

## Address data

| Term | Meaning | Don't use |
|---|---|---|
| `address_1`, `address_2`, `city`, `state`, `postcode`, `country` | The canonical address fields: WooCommerce's names. Used wherever address data crosses a boundary (JS ↔ PHP, order and entry meta, status comparison). Gravity Forms inputs are mapped to these. | `address1`, `street`, `zip`, `stateProvince`, `province`, `countryCode` |
| **state** | The value a form stores in its state/province/county field: a code from a list (WooCommerce `CA`, `DE-BY`), an option value (Gravity Forms `California`), or free text. | region (for this meaning), province, county |
| **region** | Google's name for an administrative area, before it's matched to a state. Engine-internal only (`ParsedPlace.region`, `regionCandidates`). | state (for this meaning) |
| **country** | ISO 3166-1 alpha-2 code (`US`). The display name is `countryName`. | country code, country name (for the code) |

## Autocomplete

| Term | Meaning | Don't use |
|---|---|---|
| **suggestion** | One entry in the list shown while typing. Google's API object behind it is a *prediction*; say "prediction" only when talking about that object. | result, option, prediction (otherwise) |
| **select** (a suggestion) | The person chooses a suggestion, by click, tap or keyboard. | pick, choose, click |
| **place** | Google's record for a selected suggestion, fetched as *place details*. Identified by a **place ID**. | location (that's the lat/lng) |
| **selected address** | The address filled in from the selected suggestion. | picked address, suggested address |
| **selection** | The selected address plus its place ID, as the browser sends it with a submission (`{placeId, address}`). | choice, pick |
| **submitted address** | The address in the order or entry when it's submitted. | final address, entered address |
| **session** | Google's billing session: searches from the first keystroke until place details are fetched, sharing one session token. | — |

## Address status and the soft warning

| Term | Meaning | Don't use |
|---|---|---|
| **address status** | How the submitted address relates to a selected suggestion. One of the four values below. | validation, verification status |
| `verified` | The submitted address matches the selected address. **It does not mean deliverable**; only that it came from a suggestion unchanged. | valid, confirmed |
| `modified` | A suggestion was selected, then the address was edited. | changed, edited |
| `manual` | No suggestion was selected. | typed, unverified |
| `unknown` | Another provider handled the selection (e.g. WooPayments), so there's nothing to compare. | — |
| **soft warning** | The message asking the person to check an address whose status would be `manual` or `modified`. | address check, validation error, prompt |
| **one-time confirm** | How the soft warning behaves: the first submit stops with the warning, the next submit of the same address goes through. | — |

## Plugin structure

| Term | Meaning | Don't use |
|---|---|---|
| **integration** | Support for one host plugin: the Gravity Forms integration, the WooCommerce integration. | mode, module |
| **surface** | A place an integration runs: classic checkout, block checkout, My Account addresses, admin order screen, Gravity Forms form. | page, context |
| **classic checkout** | WooCommerce's shortcode-based checkout. | shortcode checkout, legacy checkout |
| **block checkout** | WooCommerce's Checkout block. | new checkout, Gutenberg checkout |
| **engine** | Form-independent JS: calls Google, parses places, matches states (`assets/src/engine/`). | core, library |
| **adapter** | JS that connects the engine to one surface's fields (`assets/src/adapters/`). | connector, bridge |
| **provider** | A WooCommerce address autocomplete provider (`WC_Address_Provider`). WooCommerce's term; ours is one, WooPayments' is another. | service |

## Google

| Term | Meaning | Don't use |
|---|---|---|
| **Places API (New)** | The Google API used for suggestions and place details. Always written this way. | Places API, new Places API, legacy Places API (that's a different product we don't use) |
| **Maps JavaScript API** | The Google script that provides the Places library in the browser. | Google Maps script, Maps SDK |
| **Google API key** (or **key**) | One per client, in their own Google Cloud project. | Maps key, token |
