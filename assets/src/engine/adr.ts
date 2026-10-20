/**
 * Parser for Google's `adrFormatAddress`, an address marked up with the hCard "adr" microformat.
 *
 * Ported from GP Address Autocomplete. adrFormatAddress follows each country's local address
 * layout, which is more reliable than reassembling addressComponents, whose meaning varies by
 * region.
 */

export interface AdrParts {
	'post-office-box'?: string;
	'extended-address'?: string;
	'street-address'?: string;
	locality?: string;
	region?: string;
	'postal-code'?: string;
	'country-name'?: string;
}

const ADR_PATTERN =
	/<(?:span|div) class="(post-office-box|extended-address|street-address|locality|region|postal-code|country-name)">(.*?)<\/(?:span|div)>/g;

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
};

/**
 * Decodes the HTML entities Google uses in adrFormatAddress, without needing a DOM.
 *
 * @param text Text containing HTML entities.
 */
export function decodeEntities(text: string): string {
	return text.replace(
		/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
		(entity: string, body: string) => {
			if (body[0] === '#') {
				const codePoint =
					body[1] === 'x' || body[1] === 'X'
						? parseInt(body.slice(2), 16)
						: parseInt(body.slice(1), 10);

				return Number.isNaN(codePoint) || codePoint > 0x10ffff
					? entity
					: String.fromCodePoint(codePoint);
			}

			return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
		}
	);
}

/**
 * Extracts the address parts from an adrFormatAddress string.
 *
 * @param html adrFormatAddress as returned by Google.
 */
export function parseAdrFormatAddress(html: string): AdrParts {
	const parts: AdrParts = {};

	for (const match of html.matchAll(ADR_PATTERN)) {
		const [, name, value] = match;

		parts[name as keyof AdrParts] = decodeEntities(value ?? '');
	}

	return parts;
}
