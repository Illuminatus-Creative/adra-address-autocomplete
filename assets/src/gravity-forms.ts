/**
 * Gravity Forms bundle.
 *
 * The server queues each field's settings with
 * `(window.adraAaGravityForms = window.adraAaGravityForms || []).push(config)` in Gravity Forms'
 * init scripts, which may run before or after this file. Queued fields are set up here, and later
 * pushes go straight to the adapter.
 */

import './ui/dropdown.css';

import { createGravityFormsAdapter } from './adapters/gravity-forms';
import type { FieldConfig } from './adapters/gravity-forms';
import { loadPlacesApi } from './engine/google-ready';
import { PlacesClient } from './engine/places-client';

declare global {
	interface Window {
		adraAaGravityForms?:
			FieldConfig[] | { push: (config: FieldConfig) => void };
	}
}

const adapter = createGravityFormsAdapter(new PlacesClient(loadPlacesApi));
const queued = Array.isArray(window.adraAaGravityForms)
	? window.adraAaGravityForms
	: [];

window.adraAaGravityForms = {
	push: (config: FieldConfig) => adapter.init(config),
};
queued.forEach((config) => adapter.init(config));
