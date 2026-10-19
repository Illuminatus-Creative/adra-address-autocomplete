// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Suggestion } from '../engine/types';
import { SuggestionDropdown } from './dropdown';
import type { DropdownOptions } from './dropdown';

function suggestion(id: string, mainText = `${id} Main St`): Suggestion {
	return {
		id,
		text: mainText,
		mainText,
		secondaryText: 'Springfield',
		matches: [],
	};
}

let input: HTMLInputElement;
let dropdown: SuggestionDropdown | null;

function setup(overrides: Partial<DropdownOptions> = {}) {
	const options = {
		search: vi.fn(async () => [suggestion('a'), suggestion('b')]),
		onSelect: vi.fn(),
		...overrides,
	};

	dropdown = SuggestionDropdown.attach(input, options);

	return { options, dropdown: dropdown! };
}

async function type(value: string) {
	input.value = value;
	input.dispatchEvent(new Event('input'));
	await vi.advanceTimersByTimeAsync(200);
}

function key(name: string): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { key: name, cancelable: true });
	input.dispatchEvent(event);

	return event;
}

const items = () => Array.from(dropdown!.list.querySelectorAll('li'));

beforeEach(() => {
	vi.useFakeTimers();
	input = document.createElement('input');
	document.body.appendChild(input);
});

afterEach(() => {
	dropdown?.destroy();
	dropdown = null;
	document.body.replaceChildren();
	vi.useRealTimers();
});

describe('SuggestionDropdown', () => {
	it('does not attach to a read-only input', () => {
		input.readOnly = true;

		expect(
			SuggestionDropdown.attach(input, {
				search: vi.fn(),
				onSelect: vi.fn(),
			})
		).toBeNull();
	});

	it('sets up combobox semantics and the autocomplete attribute', () => {
		const { dropdown: instance } = setup({
			placeholder: 'Start typing an address',
		});

		expect(input.getAttribute('role')).toBe('combobox');
		expect(input.getAttribute('aria-expanded')).toBe('false');
		expect(input.getAttribute('aria-controls')).toBe(instance.list.id);
		expect(input.getAttribute('autocomplete')).toBe('new-password');
		expect(input.getAttribute('placeholder')).toBe(
			'Start typing an address'
		);
		expect(instance.list.getAttribute('role')).toBe('listbox');
	});

	it('keeps an existing placeholder and can leave autocomplete alone', () => {
		input.placeholder = 'Street address';
		input.setAttribute('autocomplete', 'street-address');
		setup({ placeholder: 'Start typing', autocompleteAttribute: null });

		expect(input.placeholder).toBe('Street address');
		expect(input.getAttribute('autocomplete')).toBe('street-address');
	});

	it('waits for the minimum length and for typing to pause', async () => {
		const { options } = setup();

		await type('ma');
		expect(options.search).not.toHaveBeenCalled();

		input.value = 'mai';
		input.dispatchEvent(new Event('input'));
		input.value = 'main';
		input.dispatchEvent(new Event('input'));
		await vi.advanceTimersByTimeAsync(199);
		expect(options.search).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		expect(options.search).toHaveBeenCalledExactlyOnceWith('main');
	});

	it('renders suggestions as text, never as HTML', async () => {
		setup({
			search: async () => [
				suggestion('x', '<img src=x onerror=alert(1)>'),
			],
		});

		await type('main');

		expect(dropdown!.isOpen()).toBe(true);
		expect(input.getAttribute('aria-expanded')).toBe('true');
		expect(items()[0]!.querySelector('img')).toBeNull();
		expect(items()[0]!.textContent).toContain(
			'<img src=x onerror=alert(1)>'
		);
	});

	it('ignores a response that arrives after the input changed', async () => {
		let resolveFirst: (value: Suggestion[]) => void = () => {};
		const search = vi
			.fn()
			.mockImplementationOnce(
				() => new Promise((resolve) => (resolveFirst = resolve))
			)
			.mockResolvedValueOnce([suggestion('new')]);

		setup({ search });

		await type('old');
		await type('newer');
		resolveFirst([suggestion('old')]);
		await vi.runAllTimersAsync();

		expect(
			items().map((item) => item.id.endsWith('-0') && item.textContent)
		).toEqual(['new Main StSpringfield']);
	});

	it('selects with the arrow keys and Enter, without submitting the form', async () => {
		const { options } = setup();

		await type('main');
		key('ArrowDown');
		key('ArrowDown');
		key('ArrowDown');

		expect(input.getAttribute('aria-activedescendant')).toBe(
			items()[0]!.id
		);
		expect(items()[0]!.getAttribute('aria-selected')).toBe('true');

		key('ArrowUp');
		const enter = key('Enter');

		expect(enter.defaultPrevented).toBe(true);
		expect(options.onSelect).toHaveBeenCalledExactlyOnceWith(
			suggestion('b')
		);
		expect(dropdown!.isOpen()).toBe(false);
	});

	it('blocks Enter while open even with nothing highlighted', async () => {
		const { options } = setup();

		await type('main');

		expect(key('Enter').defaultPrevented).toBe(true);
		expect(options.onSelect).not.toHaveBeenCalled();
	});

	it('leaves keys alone when closed', () => {
		setup();

		expect(key('Enter').defaultPrevented).toBe(false);
		expect(key('ArrowDown').defaultPrevented).toBe(false);
	});

	it('selects on mousedown and closes on Escape or an outside click', async () => {
		const { options } = setup();

		await type('main');
		key('Escape');
		expect(dropdown!.isOpen()).toBe(false);

		await type('main ');
		document.body.dispatchEvent(
			new MouseEvent('mousedown', { bubbles: true })
		);
		expect(dropdown!.isOpen()).toBe(false);

		await type('main s');
		items()[1]!.dispatchEvent(
			new MouseEvent('mousedown', { bubbles: true, cancelable: true })
		);
		expect(options.onSelect).toHaveBeenCalledExactlyOnceWith(
			suggestion('b')
		);
	});

	it('closes shortly after the input loses focus', async () => {
		setup();

		await type('main');
		input.dispatchEvent(new Event('blur'));
		expect(dropdown!.isOpen()).toBe(true);

		await vi.advanceTimersByTimeAsync(150);
		expect(dropdown!.isOpen()).toBe(false);
	});

	it('logs a failed search and shows nothing', async () => {
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});

		setup({ search: () => Promise.reject(new Error('offline')) });
		await type('main');

		expect(dropdown!.isOpen()).toBe(false);
		expect(log).toHaveBeenCalledOnce();
	});

	it('cleans up after itself', async () => {
		input.setAttribute('autocomplete', 'street-address');
		const { options, dropdown: instance } = setup();

		await type('main');
		instance.destroy();
		dropdown = null;

		expect(document.querySelector('.adra-aa-suggestions')).toBeNull();
		expect(input.getAttribute('autocomplete')).toBe('street-address');
		expect(input.hasAttribute('role')).toBe(false);
		expect(input.hasAttribute('aria-expanded')).toBe(false);

		await type('main street');
		expect(options.search).toHaveBeenCalledOnce();
	});
});
