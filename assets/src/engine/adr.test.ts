import { describe, expect, it } from 'vitest';

import { decodeEntities, parseAdrFormatAddress } from './adr';

describe('decodeEntities', () => {
	it('decodes named, decimal and hex entities', () => {
		expect(
			decodeEntities('L&#39;Eixample &amp; Gr&#xE0;cia &quot;x&quot;')
		).toBe('L\'Eixample & Gràcia "x"');
	});

	it('leaves unknown and invalid entities alone', () => {
		expect(decodeEntities('&bogus; &#xFFFFFFF;')).toBe(
			'&bogus; &#xFFFFFFF;'
		);
	});
});

describe('parseAdrFormatAddress', () => {
	it('extracts every adr part', () => {
		const html =
			'<span class="post-office-box">PO Box 1</span>, <span class="street-address">1 Main St</span>, ' +
			'<span class="extended-address">Unit 2</span>, <span class="locality">Springfield</span>, ' +
			'<span class="region">IL</span> <span class="postal-code">62701</span>, ' +
			'<span class="country-name">USA</span>';

		expect(parseAdrFormatAddress(html)).toEqual({
			'post-office-box': 'PO Box 1',
			'street-address': '1 Main St',
			'extended-address': 'Unit 2',
			locality: 'Springfield',
			region: 'IL',
			'postal-code': '62701',
			'country-name': 'USA',
		});
	});

	it('accepts div elements and returns nothing for plain text', () => {
		expect(
			parseAdrFormatAddress('<div class="locality">Paris</div>')
		).toEqual({ locality: 'Paris' });
		expect(parseAdrFormatAddress('1 Main St, Springfield')).toEqual({});
	});
});
