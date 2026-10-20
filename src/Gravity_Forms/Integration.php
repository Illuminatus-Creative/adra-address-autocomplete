<?php
/**
 * Gravity Forms integration.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\Gravity_Forms;

use Adra\AddressAutocomplete\Address\Selection;
use Adra\AddressAutocomplete\Address\Status;
use Adra\AddressAutocomplete\Address\Warning;
use Adra\AddressAutocomplete\Assets\Bundle;
use Adra\AddressAutocomplete\Assets\Google_Loader;
use Adra\AddressAutocomplete\Settings\Options;
use GF_Field;
use GFFormDisplay;
use GFFormsModel;

/**
 * Adds address autocomplete to Gravity Forms Address fields, and records the address status on
 * each entry.
 *
 * Partly ported from GP Address Autocomplete (init scripts, the hidden input per field and
 * save-and-continue support).
 */
final class Integration {

	/** Field property set by the form editor checkbox. */
	public const FIELD_PROPERTY = 'adraAaEnabled';

	/** Prefix of the hidden input holding the selected address. */
	public const SELECTED_INPUT = 'adra_aa_selected_';

	/** Prefix of the hidden input recording an address the person confirmed after the soft warning. */
	public const CONFIRMED_INPUT = 'adra_aa_confirmed_';

	/** Prefix of the entry meta keys. */
	public const STATUS_META  = 'adra_aa_status_';
	public const CHANGED_META = 'adra_aa_changed_';
	public const PLACE_META   = 'adra_aa_place_id_';

	/** Sub-input numbers of a Gravity Forms Address field, by canonical field name. */
	private const INPUTS = array(
		'address_1' => 1,
		'address_2' => 2,
		'city'      => 3,
		'state'     => 4,
		'postcode'  => 5,
		'country'   => 6,
	);

	/**
	 * Keys of addresses warned about in this request, by field ID, to render for the next submit.
	 *
	 * @var array<int, string>
	 */
	private array $warned = array();

	/**
	 * Creates the integration.
	 *
	 * @param Google_Loader $loader  Google Maps loader.
	 * @param Options       $options Plugin settings.
	 */
	public function __construct(
		private Google_Loader $loader,
		private Options $options,
	) {}

	/**
	 * Registers hooks.
	 */
	public function register(): void {
		add_action( 'gform_field_standard_settings', array( $this, 'render_field_setting' ), 10, 2 );
		add_action( 'gform_editor_js', array( $this, 'print_editor_js' ) );
		add_filter( 'gform_tooltips', array( $this, 'tooltips' ) );

		add_action( 'gform_enqueue_scripts', array( $this, 'enqueue' ) );
		add_action( 'gform_register_init_scripts', array( $this, 'register_init_scripts' ) );
		add_filter( 'gform_field_content', array( $this, 'add_selected_input' ), 10, 2 );
		add_filter( 'gform_submission_values_pre_save', array( $this, 'keep_selected_in_draft' ), 10, 2 );

		if ( $this->options->soft_warning_enabled() ) {
			add_filter( 'gform_validation', array( $this, 'soft_warning' ) );
		}

		// Before feed add-ons (priority 10), so they can use the status.
		add_filter( 'gform_entry_post_save', array( $this, 'save_status' ), 5, 2 );
		add_filter( 'gform_entry_meta', array( $this, 'register_entry_meta' ), 10, 2 );
		add_filter( 'gform_entry_detail_meta_boxes', array( $this, 'add_meta_box' ), 10, 3 );
	}

	/**
	 * Address fields on a form with autocomplete turned on.
	 *
	 * @param array<string, mixed>|false|null $form Form.
	 * @return list<GF_Field>
	 */
	public static function enabled_fields( $form ): array {
		$fields = array();

		foreach ( is_array( $form ) ? (array) rgar( $form, 'fields', array() ) : array() as $field ) {
			if ( $field instanceof GF_Field && 'address' === $field->get_input_type() && ! empty( $field->{self::FIELD_PROPERTY} ) ) {
				$fields[] = $field;
			}
		}

		return $fields;
	}

	/**
	 * Prints the "Address autocomplete" checkbox in the form editor, after the Address settings.
	 *
	 * @param int $position Settings position.
	 */
	public function render_field_setting( $position ): void {
		if ( 1100 !== (int) $position ) {
			return;
		}
		?>
		<li class="adra_aa_setting field_setting">
			<input type="checkbox" id="adra_aa_enabled" onclick="SetFieldProperty( '<?php echo esc_js( self::FIELD_PROPERTY ); ?>', this.checked );">
			<label for="adra_aa_enabled" class="inline">
				<?php esc_html_e( 'Address autocomplete', 'adra-address-autocomplete' ); ?>
				<?php gform_tooltip( 'adra_aa_enabled' ); ?>
			</label>
		</li>
		<?php
	}

	/**
	 * Shows the checkbox for Address fields and loads its saved state.
	 */
	public function print_editor_js(): void {
		?>
		<script>
			fieldSettings.address += ', .adra_aa_setting';
			jQuery( document ).on( 'gform_load_field_settings', function ( event, field ) {
				jQuery( '#adra_aa_enabled' ).prop( 'checked', !! field[ <?php echo wp_json_encode( self::FIELD_PROPERTY ); ?> ] );
			} );
		</script>
		<?php
	}

	/**
	 * Adds the tooltip for the checkbox.
	 *
	 * @param array<string, string> $tooltips Tooltips.
	 * @return array<string, string>
	 */
	public function tooltips( $tooltips ): array {
		$tooltips['adra_aa_enabled'] = sprintf(
			'<strong>%s</strong>%s',
			esc_html__( 'Address autocomplete', 'adra-address-autocomplete' ),
			esc_html__( 'Suggests real addresses from Google as people type in the street address, and records on each entry whether the address came from a suggestion.', 'adra-address-autocomplete' )
		);

		return (array) $tooltips;
	}

	/**
	 * Enqueues the adapter and Google Maps on forms that need them.
	 *
	 * @param array<string, mixed> $form Form being displayed.
	 */
	public function enqueue( $form ): void {
		if ( ! self::enabled_fields( $form ) ) {
			return;
		}

		$handle = Bundle::register( 'gravity-forms' );

		if ( null === $handle ) {
			return;
		}

		wp_enqueue_script( $handle );
		wp_localize_script(
			$handle,
			'adraAaGravityFormsSettings',
			array(
				/* translators: Followed by the Google logo, under address suggestions. */
				'poweredBy'     => __( 'Powered by', 'adra-address-autocomplete' ),
				'googleLogoUrl' => plugins_url( 'assets/images/google.svg', ADRA_AA_FILE ),
			)
		);

		if ( wp_style_is( $handle, 'registered' ) ) {
			wp_enqueue_style( $handle );
		}

		$this->loader->enqueue();
	}

	/**
	 * Initializes autocomplete on each enabled field whenever Gravity Forms renders the form,
	 * including after AJAX page changes.
	 *
	 * @param array<string, mixed> $form Form being displayed.
	 */
	public function register_init_scripts( $form ): void {
		foreach ( self::enabled_fields( $form ) as $field ) {
			GFFormDisplay::add_init_script(
				(int) $form['id'],
				'adra_aa_' . $field->id,
				GFFormDisplay::ON_PAGE_RENDER,
				sprintf(
					'(window.adraAaGravityForms=window.adraAaGravityForms||[]).push(%s);',
					wp_json_encode( $this->field_config( $form, $field ) )
				)
			);
		}
	}

	/**
	 * Settings the adapter needs for one field.
	 *
	 * @param array<string, mixed> $form  Form.
	 * @param GF_Field             $field Address field.
	 * @return array<string, mixed>
	 */
	private function field_config( array $form, GF_Field $field ): array {
		$region_codes = array(
			'us'       => array( 'US' ),
			'canadian' => array( 'CA' ),
		);

		$config = array(
			'formId'      => (int) $form['id'],
			'fieldId'     => (int) $field->id,
			'regionCodes' => $region_codes[ (string) rgobj( $field, 'addressType' ) ] ?? array(),
		);

		/**
		 * Filters the autocomplete settings for a Gravity Forms Address field.
		 *
		 * Set `regionCodes` (ISO 3166-1 alpha-2, up to 15) to limit suggestions to those countries.
		 *
		 * @param array<string, mixed> $config Settings: formId, fieldId, regionCodes.
		 * @param GF_Field             $field  Address field.
		 * @param array<string, mixed> $form   Form.
		 */
		return (array) apply_filters( 'adra_aa_gravity_forms_field_config', $config, $field, $form );
	}

	/**
	 * Adds the hidden input that carries the selected address with the submission.
	 *
	 * @param string   $content Field markup.
	 * @param GF_Field $field   Field.
	 */
	public function add_selected_input( $content, $field ): string {
		if (
			! $field instanceof GF_Field
			|| 'address' !== $field->get_input_type()
			|| empty( $field->{self::FIELD_PROPERTY} )
			|| $field->is_form_editor()
			|| $field->is_entry_detail()
		) {
			return (string) $content;
		}

		$id        = (int) $field->id;
		$name      = self::SELECTED_INPUT . $id;
		$confirmed = $this->warned[ $id ] ?? $this->posted( self::CONFIRMED_INPUT . $id );

		return $content . sprintf(
			'<input type="hidden" name="%s" class="gform_hidden adra-aa-selected" value="%s"><input type="hidden" name="%s" class="gform_hidden" value="%s">',
			esc_attr( $name ),
			esc_attr( $this->submitted_or_draft_value( $name ) ),
			esc_attr( self::CONFIRMED_INPUT . $id ),
			esc_attr( $confirmed )
		);
	}

	/**
	 * The selected-address JSON from this request, or from a save-and-continue draft being resumed.
	 *
	 * @param string $name Hidden input name.
	 */
	private function submitted_or_draft_value( string $name ): string {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Gravity Forms verifies the submission; this only re-renders the value.
		$posted = isset( $_POST[ $name ] ) ? sanitize_text_field( wp_unslash( $_POST[ $name ] ) ) : '';

		if ( '' !== $posted ) {
			return $posted;
		}

		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only lookup of the user's own draft.
		$token = isset( $_GET['gf_token'] ) ? sanitize_key( wp_unslash( $_GET['gf_token'] ) ) : '';

		if ( '' === $token || ! class_exists( GFFormsModel::class ) ) {
			return '';
		}

		$draft = GFFormsModel::get_draft_submission_values( $token );

		if ( ! is_array( $draft ) ) {
			return '';
		}

		$submission = json_decode( (string) rgar( $draft, 'submission' ), true );
		$value      = $submission['submitted_values'][ $name ] ?? '';

		return is_string( $value ) ? $value : '';
	}

	/**
	 * A posted text value, or an empty string.
	 *
	 * @param string $name Input name.
	 */
	private function posted( string $name ): string {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Gravity Forms verifies the submission.
		return isset( $_POST[ $name ] ) ? sanitize_text_field( wp_unslash( $_POST[ $name ] ) ) : '';
	}

	/**
	 * The one-time confirm: the first submit of an address that doesn't match a selected suggestion
	 * fails validation with the soft warning; submitting the same address again goes through.
	 *
	 * @param array{is_valid: bool, form: array<string, mixed>} $validation_result Validation result.
	 * @return array{is_valid: bool, form: array<string, mixed>}
	 */
	public function soft_warning( $validation_result ): array {
		$form = $validation_result['form'];
		$page = class_exists( GFFormDisplay::class ) ? (int) GFFormDisplay::get_source_page( (int) $form['id'] ) : 0;

		foreach ( self::enabled_fields( $form ) as $field ) {
			// Other errors on the field come first; fields on other pages are checked there.
			if (
				$field->failed_validation
				|| ( $page && (int) rgobj( $field, 'pageNumber' ) !== $page )
				|| GFFormsModel::is_field_hidden( $form, $field, array() )
			) {
				continue;
			}

			$id      = (int) $field->id;
			$address = array();

			foreach ( self::INPUTS as $name => $number ) {
				$address[ $name ] = $this->posted( 'input_' . $id . '_' . $number );
			}

			if ( '' === $address['address_1'] ) {
				continue;
			}

			$selected = Selection::decode( $this->posted( self::SELECTED_INPUT . $id ) );
			$status   = Status::compare( $selected['address'] ?? null, $address )['status'];
			$key      = Warning::key( $address );

			if ( Status::VERIFIED === $status || hash_equals( $key, $this->posted( self::CONFIRMED_INPUT . $id ) ) ) {
				continue;
			}

			$field->failed_validation  = true;
			$field->validation_message = Warning::message();
			$this->warned[ $id ]       = $key;

			$validation_result['is_valid'] = false;
		}

		$validation_result['form'] = $form;

		return $validation_result;
	}

	/**
	 * Keeps the selected address in save-and-continue drafts.
	 *
	 * @param array<string, mixed> $submitted_values Values saved with the draft.
	 * @param array<string, mixed> $form             Form.
	 * @return array<string, mixed>
	 */
	public function keep_selected_in_draft( $submitted_values, $form ): array {
		foreach ( self::enabled_fields( $form ) as $field ) {
			$name = self::SELECTED_INPUT . (int) $field->id;
			// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Gravity Forms verifies the submission.
			$value = isset( $_POST[ $name ] ) ? sanitize_text_field( wp_unslash( $_POST[ $name ] ) ) : '';

			if ( '' !== $value ) {
				$submitted_values[ $name ] = $value;
			}
		}

		return (array) $submitted_values;
	}

	/**
	 * Records the address status of each enabled field on the new entry.
	 *
	 * @param array<string, mixed> $entry Saved entry.
	 * @param array<string, mixed> $form  Form.
	 * @return array<string, mixed>
	 */
	public function save_status( $entry, $form ): array {
		foreach ( self::enabled_fields( $form ) as $field ) {
			// A field hidden by conditional logic has no address to judge.
			if ( GFFormsModel::is_field_hidden( $form, $field, array(), $entry ) ) {
				continue;
			}

			$id   = (int) $field->id;
			$name = self::SELECTED_INPUT . $id;
			// phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Gravity Forms verifies the submission; Selection::decode() reduces the value to known, sanitized fields.
			$raw      = isset( $_POST[ $name ] ) ? wp_unslash( $_POST[ $name ] ) : '';
			$selected = Selection::decode( $raw );

			$submitted = array();

			foreach ( self::INPUTS as $name => $number ) {
				$submitted[ $name ] = (string) rgar( $entry, $id . '.' . $number );
			}

			$result = Status::compare( $selected['address'] ?? null, $submitted );

			$meta = array(
				self::STATUS_META . $id  => $result['status'],
				self::CHANGED_META . $id => implode( ',', $result['changed'] ),
				self::PLACE_META . $id   => $selected['placeId'] ?? '',
			);

			foreach ( $meta as $key => $value ) {
				gform_update_meta( $entry['id'], $key, $value );
				$entry[ $key ] = $value;
			}
		}

		return (array) $entry;
	}

	/**
	 * Registers the status as entry meta, so it can be shown in the entry list, filtered on, and
	 * used in conditional logic.
	 *
	 * @param array<string, mixed> $entry_meta Entry meta.
	 * @param int                  $form_id    Form ID.
	 * @return array<string, mixed>
	 */
	public function register_entry_meta( $entry_meta, $form_id ): array {
		$choices = array();

		foreach ( array_intersect_key( Status::labels(), array_flip( array( Status::VERIFIED, Status::MODIFIED, Status::MANUAL ) ) ) as $value => $label ) {
			$choices[] = array(
				'value' => $value,
				'text'  => $label,
			);
		}

		foreach ( self::enabled_fields( \GFAPI::get_form( $form_id ) ) as $field ) {
			$entry_meta[ self::STATUS_META . $field->id ] = array(
				/* translators: %s: Address field label. */
				'label'                      => sprintf( __( '%s (address status)', 'adra-address-autocomplete' ), \GFCommon::get_label( $field ) ),
				'is_numeric'                 => false,
				'is_default_column'          => false,
				'update_entry_meta_callback' => null,
				'filter'                     => array(
					'operators' => array( 'is', 'isnot' ),
					'choices'   => $choices,
				),
			);
		}

		return (array) $entry_meta;
	}

	/**
	 * Adds an "Address status" box to the entry detail screen.
	 *
	 * @param array<string, mixed> $meta_boxes Meta boxes.
	 * @param array<string, mixed> $entry      Entry.
	 * @param array<string, mixed> $form       Form.
	 * @return array<string, mixed>
	 */
	public function add_meta_box( $meta_boxes, $entry, $form ): array {
		if ( self::enabled_fields( $form ) ) {
			$meta_boxes['adra_aa_status'] = array(
				'title'    => __( 'Address status', 'adra-address-autocomplete' ),
				'callback' => array( $this, 'render_meta_box' ),
				'context'  => 'side',
			);
		}

		return (array) $meta_boxes;
	}

	/**
	 * Prints the "Address status" box.
	 *
	 * @param array{entry: array<string, mixed>, form: array<string, mixed>} $args Entry and form.
	 */
	public function render_meta_box( $args ): void {
		$labels = Status::labels();

		echo '<ul>';

		foreach ( self::enabled_fields( $args['form'] ) as $field ) {
			$status  = (string) gform_get_meta( $args['entry']['id'], self::STATUS_META . $field->id );
			$changed = array_filter( explode( ',', (string) gform_get_meta( $args['entry']['id'], self::CHANGED_META . $field->id ) ) );

			printf(
				'<li><strong>%s</strong><br>%s',
				esc_html( \GFCommon::get_label( $field ) ),
				esc_html( $labels[ $status ] ?? __( 'Not recorded', 'adra-address-autocomplete' ) )
			);

			if ( $changed ) {
				printf(
					/* translators: %s: comma-separated list of address parts, e.g. "city, postcode". */
					'<br>' . esc_html__( 'Changed: %s', 'adra-address-autocomplete' ),
					esc_html( implode( ', ', $changed ) )
				);
			}

			echo '</li>';
		}

		echo '</ul>';
	}
}
