#!/usr/bin/env node
/* eslint-disable no-console -- A command-line script; the console is its output. */
/**
 * Records a real place from the Places API (New) as a test fixture, replacing hand-written data.
 *
 * Usage:
 *   GOOGLE_MAPS_API_KEY=... node bin/record-place-fixture.mjs <placeId> <fixture-name> [languageCode]
 *
 * Find place IDs with https://developers.google.com/maps/documentation/places/web-service/place-id
 * If the key is restricted by HTTP referrer, also set REFERER to an allowed URL.
 * Behind an HTTP proxy, run with NODE_USE_ENV_PROXY=1.
 *
 * An existing fixture keeps its "expected" values; check them against the new data. A new
 * fixture gets "expected": null, which fails the tests until it is filled in.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [placeId, name, languageCode = 'en'] = process.argv.slice(2);
const key = process.env.GOOGLE_MAPS_API_KEY;

if (!placeId || !name || !key) {
	console.error(
		'Usage: GOOGLE_MAPS_API_KEY=... node bin/record-place-fixture.mjs <placeId> <fixture-name> [languageCode]'
	);
	process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(name)) {
	console.error('Fixture name may only contain a-z, 0-9 and hyphens.');
	process.exit(1);
}

const url = new URL(
	`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`
);
url.searchParams.set('languageCode', languageCode);

const headers = {
	'X-Goog-Api-Key': key,
	'X-Goog-FieldMask':
		'id,formattedAddress,adrFormatAddress,addressComponents,location',
};

if (process.env.REFERER) {
	headers.Referer = process.env.REFERER;
}

const response = await fetch(url, { headers });
const body = await response.json();

if (!response.ok) {
	console.error(
		`Google returned ${response.status}:`,
		JSON.stringify(body, null, 2)
	);
	process.exit(1);
}

const place = {
	id: body.id,
	formattedAddress: body.formattedAddress ?? '',
	adrFormatAddress: body.adrFormatAddress ?? '',
	addressComponents: (body.addressComponents ?? []).map((component) => ({
		longText: component.longText ?? '',
		shortText: component.shortText ?? '',
		types: component.types ?? [],
	})),
	location: body.location
		? { lat: body.location.latitude, lng: body.location.longitude }
		: null,
};

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'tests', 'fixtures', 'places', `${name}.json`);
const existing = existsSync(file)
	? JSON.parse(readFileSync(file, 'utf8'))
	: null;

const fixture = {
	_source: `Recorded from the Places API (New) on ${new Date().toISOString().slice(0, 10)} with languageCode=${languageCode}.`,
	place,
	expected: existing?.expected ?? null,
};

writeFileSync(file, JSON.stringify(fixture, null, '\t') + '\n');
console.log(`Wrote ${file}`);

if (!existing) {
	console.log('Fill in "expected" before running the tests.');
}
