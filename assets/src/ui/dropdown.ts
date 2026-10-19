/**
 * Suggestion list for an address input, used where WooCommerce doesn't draw one itself
 * (Gravity Forms, the admin order screen). Ported from GP Address Autocomplete's Places API (New)
 * dropdown, with ARIA combobox semantics added.
 */

import type { Suggestion } from '../engine/types';

export interface DropdownOptions {
	search: (query: string) => Promise<Suggestion[]>;
	onSelect: (suggestion: Suggestion) => void;
	/** Characters to type before searching. Each search is billed. Default 3. */
	minChars?: number;
	/** Milliseconds to wait after typing stops before searching. Default 200. */
	debounceMs?: number;
	/** Placeholder to set when the input has none. */
	placeholder?: string;
	/**
	 * Value for the input's autocomplete attribute, so browser autofill doesn't cover the list.
	 * Browsers ignore "off" on address fields. Null leaves the attribute alone.
	 * Default "new-password".
	 */
	autocompleteAttribute?: string | null;
}

let instances = 0;

/*
 * WebKit (Safari and every iOS browser) measures getBoundingClientRect() against the visual
 * viewport but positions fixed elements against the layout viewport. They diverge when the iOS
 * keyboard opens, which put the list on top of the input instead of below it. Same check as
 * Floating UI.
 */
function visualViewportOffset(): { x: number; y: number } {
	const isWebKit =
		typeof CSS !== 'undefined' &&
		CSS.supports?.('-webkit-backdrop-filter', 'none');

	if (!isWebKit || !window.visualViewport) {
		return { x: 0, y: 0 };
	}

	return {
		x: window.visualViewport.offsetLeft,
		y: window.visualViewport.offsetTop,
	};
}

export class SuggestionDropdown {
	readonly list: HTMLUListElement;

	private suggestions: Suggestion[] = [];
	private activeIndex = -1;
	private requestId = 0;
	private debounceTimer: ReturnType<typeof setTimeout> | undefined;
	private blurTimer: ReturnType<typeof setTimeout> | undefined;
	private readonly cleanups: Array<() => void> = [];
	private readonly originalAttributes = new Map<string, string | null>();

	/**
	 * Attaches a dropdown to an input, unless the input is read-only.
	 *
	 * @param input   Input people type the address into.
	 * @param options Search and selection callbacks.
	 */
	static attach(
		input: HTMLInputElement,
		options: DropdownOptions
	): SuggestionDropdown | null {
		return input.readOnly ? null : new SuggestionDropdown(input, options);
	}

	private constructor(
		private readonly input: HTMLInputElement,
		private readonly options: DropdownOptions
	) {
		const id = `adra-aa-suggestions-${++instances}`;

		this.list = document.createElement('ul');
		this.list.id = id;
		this.list.className = 'adra-aa-suggestions';
		this.list.setAttribute('role', 'listbox');
		this.list.hidden = true;
		document.body.appendChild(this.list);

		this.setInputAttribute('role', 'combobox');
		this.setInputAttribute('aria-autocomplete', 'list');
		this.setInputAttribute('aria-expanded', 'false');
		this.setInputAttribute('aria-controls', id);

		if (options.autocompleteAttribute !== null) {
			this.setInputAttribute(
				'autocomplete',
				options.autocompleteAttribute ?? 'new-password'
			);
		}

		if (options.placeholder && !input.getAttribute('placeholder')) {
			this.setInputAttribute('placeholder', options.placeholder);
		}

		this.listen(input, 'input', () => this.queueSearch(input.value));
		this.listen(input, 'keydown', (event) =>
			this.onKeydown(event as KeyboardEvent)
		);
		// Delayed so a click on a suggestion (handled on mousedown) isn't lost.
		this.listen(input, 'blur', () => {
			this.blurTimer = setTimeout(() => this.hide(), 150);
		});
		this.listen(input, 'focus', () => clearTimeout(this.blurTimer));
		this.listen(document, 'mousedown', (event) => {
			const target = event.target as Node;

			if (target !== input && !this.list.contains(target)) {
				this.hide();
			}
		});

		const reposition = () => this.position();

		// Capture catches scrolling in any container, not just the page.
		this.listen(document, 'scroll', reposition, {
			capture: true,
			passive: true,
		});
		this.listen(window, 'resize', reposition);

		if (window.visualViewport) {
			this.listen(window.visualViewport, 'resize', reposition);
			this.listen(window.visualViewport, 'scroll', reposition);
		}
	}

	/**
	 * Removes the list and every listener, and restores the input's attributes.
	 */
	destroy(): void {
		clearTimeout(this.debounceTimer);
		clearTimeout(this.blurTimer);
		this.requestId++;
		this.cleanups.forEach((cleanup) => cleanup());
		this.cleanups.length = 0;
		this.list.remove();

		this.originalAttributes.forEach((value, name) => {
			if (value === null) {
				this.input.removeAttribute(name);
			} else {
				this.input.setAttribute(name, value);
			}
		});

		this.input.removeAttribute('aria-activedescendant');
	}

	isOpen(): boolean {
		return !this.list.hidden;
	}

	private setInputAttribute(name: string, value: string): void {
		if (!this.originalAttributes.has(name)) {
			this.originalAttributes.set(name, this.input.getAttribute(name));
		}

		this.input.setAttribute(name, value);
	}

	private listen(
		target: EventTarget,
		type: string,
		listener: (event: Event) => void,
		options?: AddEventListenerOptions
	): void {
		target.addEventListener(type, listener, options);
		this.cleanups.push(() =>
			target.removeEventListener(type, listener, options)
		);
	}

	private queueSearch(query: string): void {
		clearTimeout(this.debounceTimer);

		// Invalidate any in-flight request as soon as the input changes.
		const requestId = ++this.requestId;

		if (query.trim().length < (this.options.minChars ?? 3)) {
			this.suggestions = [];
			this.hide();
			return;
		}

		this.debounceTimer = setTimeout(
			() => this.search(query, requestId),
			this.options.debounceMs ?? 200
		);
	}

	private async search(query: string, requestId: number): Promise<void> {
		let results: Suggestion[];

		try {
			results = await this.options.search(query);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('ADRA Address Autocomplete: search failed.', error);
			results = [];
		}

		if (requestId !== this.requestId) {
			return;
		}

		this.suggestions = results;
		this.render();
	}

	private render(): void {
		this.list.replaceChildren();
		this.activeIndex = -1;
		this.input.removeAttribute('aria-activedescendant');

		if (!this.suggestions.length) {
			this.hide();
			return;
		}

		this.suggestions.forEach((suggestion, index) => {
			const item = document.createElement('li');
			const main = document.createElement('span');

			item.id = `${this.list.id}-${index}`;
			item.className = 'adra-aa-suggestion';
			item.setAttribute('role', 'option');
			item.setAttribute('aria-selected', 'false');

			main.className = 'adra-aa-suggestion__main';
			main.textContent = suggestion.mainText;
			item.appendChild(main);

			if (suggestion.secondaryText) {
				const secondary = document.createElement('span');

				secondary.className = 'adra-aa-suggestion__secondary';
				secondary.textContent = suggestion.secondaryText;
				item.appendChild(secondary);
			}

			// mousedown, not click, so selection happens before the input's blur hides the list.
			item.addEventListener('mousedown', (event) => {
				event.preventDefault();
				this.select(index);
			});
			item.addEventListener('mouseenter', () => this.setActive(index));

			this.list.appendChild(item);
		});

		this.list.hidden = false;
		this.input.setAttribute('aria-expanded', 'true');
		this.position();
	}

	private hide(): void {
		this.list.hidden = true;
		this.activeIndex = -1;
		this.input.setAttribute('aria-expanded', 'false');
		this.input.removeAttribute('aria-activedescendant');
	}

	private setActive(index: number): void {
		const items = this.list.children;

		Array.from(items).forEach((item, itemIndex) => {
			const active = itemIndex === index;

			item.classList.toggle('is-active', active);
			item.setAttribute('aria-selected', active ? 'true' : 'false');
		});

		this.activeIndex = index;

		const active = items[index];

		if (active) {
			this.input.setAttribute('aria-activedescendant', active.id);
		}
	}

	private select(index: number): void {
		const suggestion = this.suggestions[index];

		if (!suggestion) {
			return;
		}

		clearTimeout(this.debounceTimer);
		this.requestId++;
		this.hide();
		this.options.onSelect(suggestion);
	}

	private onKeydown(event: KeyboardEvent): void {
		if (!this.isOpen() || !this.suggestions.length) {
			return;
		}

		const count = this.suggestions.length;

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				this.setActive((this.activeIndex + 1) % count);
				break;

			case 'ArrowUp':
				event.preventDefault();
				this.setActive(
					this.activeIndex <= 0 ? count - 1 : this.activeIndex - 1
				);
				break;

			case 'Enter':
				// Don't submit the form while the list is open.
				event.preventDefault();

				if (this.activeIndex > -1) {
					this.select(this.activeIndex);
				}
				break;

			case 'Tab':
				if (this.activeIndex > -1) {
					this.select(this.activeIndex);
				}
				break;

			case 'Escape':
				event.preventDefault();
				this.hide();
				break;
		}
	}

	private position(): void {
		if (!this.isOpen()) {
			return;
		}

		const rect = this.input.getBoundingClientRect();
		const offset = visualViewportOffset();

		this.list.style.top = `${rect.bottom + offset.y}px`;
		this.list.style.left = `${rect.left + offset.x}px`;
		this.list.style.width = `${rect.width}px`;
	}
}
