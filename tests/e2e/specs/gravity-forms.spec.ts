/**
 * Gravity Forms Address fields. Skipped when the test site has no Gravity Forms (it's commercial;
 * see GRAVITY_FORMS_ZIP in bin/e2e-env.sh).
 */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { places, stubGoogle } from '../support/google';
import { site, wpJson } from '../support/wp';

const WARNING = 'We couldn’t match this address to a known address.';
const forms = site.gravityForms;

test.skip(
	!forms.international,
	'Gravity Forms is not installed on the test site'
);

function latestEntry(formId: number) {
	return wpJson<{
		id: string;
		status: string;
		changed: string;
		place: string;
		state: string;
		country: string;
	} | null>(`
		$entry = GFAPI::get_entries( ${formId}, array(), array( 'key' => 'id', 'direction' => 'DESC' ), array( 'page_size' => 1 ) )[0] ?? null;
		echo wp_json_encode( $entry ? array(
			'id'      => $entry['id'],
			'state'   => $entry['1.4'],
			'country' => $entry['1.6'],
			'status'  => gform_get_meta( $entry['id'], 'adra_aa_status_1' ),
			'changed' => gform_get_meta( $entry['id'], 'adra_aa_changed_1' ),
			'place'   => gform_get_meta( $entry['id'], 'adra_aa_place_id_1' ),
		) : null );
	`);
}

async function select(page: Page, formId: number) {
	await page
		.locator(`#input_${formId}_1_1`)
		.pressSequentially('1600 Amphitheatre', { delay: 30 });
	await page
		.locator('.adra-aa-suggestion')
		.filter({ hasText: 'Mountain View' })
		.first()
		.dispatchEvent('mousedown');
	await expect(page.locator(`#input_${formId}_1_3`)).toHaveValue(
		'Mountain View'
	);
}

/**
 * Submits; resolves to "confirmed" or "warned".
 * @param page
 * @param formId
 */
async function submit(page: Page, formId: number) {
	// Gravity Forms re-renders over AJAX; clear the old error so only a new one counts.
	await page.evaluate(() =>
		document
			.querySelectorAll('.gfield_error')
			.forEach((field) => field.classList.remove('gfield_error'))
	);
	await page.locator(`#gform_submit_button_${formId}`).click();

	return Promise.race([
		page
			.locator(`#gform_confirmation_message_${formId}`)
			.waitFor()
			.then(() => 'confirmed' as const),
		page
			.locator('.gfield_error')
			.filter({ hasText: WARNING })
			.waitFor()
			.then(() => 'warned' as const),
	]);
}

test.beforeEach(async ({ context }) => {
	await stubGoogle(context);
});

test('International field: fills from a suggestion and records it as verified', async ({
	page,
}) => {
	const formId = forms.international!;

	await page.goto('/form-international/');
	await select(page, formId);
	await expect(page.locator(`#input_${formId}_1_4`)).toHaveValue(
		'California'
	);
	await expect(page.locator(`#input_${formId}_1_6`)).toHaveValue('US');

	expect(await submit(page, formId)).toBe('confirmed');

	const entry = latestEntry(formId)!;
	expect(entry.status).toBe('verified');
	expect(entry.place).toBe(places['us-mountain-view']!.id);
});

test('International field: warns once about a typed address, then records it as manual', async ({
	page,
}) => {
	const formId = forms.international!;

	await page.goto('/form-international/');
	await page.fill(`#input_${formId}_1_1`, '1 Main St');
	await page.keyboard.press('Escape');
	await page.fill(`#input_${formId}_1_3`, 'Springfield');
	await page.selectOption(`#input_${formId}_1_6`, 'US');

	const before = latestEntry(formId)?.id;
	expect(await submit(page, formId)).toBe('warned');
	expect(latestEntry(formId)?.id).toBe(before);
	await expect(page.locator(`#input_${formId}_1_3`)).toHaveValue(
		'Springfield'
	);

	expect(await submit(page, formId)).toBe('confirmed');
	expect(latestEntry(formId)!.status).toBe('manual');
});

test('US field: selects the state and leaves the hidden country alone', async ({
	page,
}) => {
	const formId = forms.us!;

	await page.goto('/form-us/');
	await select(page, formId);
	await expect(page.locator(`#input_${formId}_1_4`)).toHaveValue(
		'California'
	);

	// Gravity Forms tamper-checks the hidden country; the submission must still go through.
	expect(await submit(page, formId)).toBe('confirmed');
	expect(latestEntry(formId)!.status).toBe('verified');
});
