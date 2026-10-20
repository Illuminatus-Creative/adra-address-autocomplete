<?php
/**
 * Settings → Address Autocomplete.
 *
 * @package Adra\AddressAutocomplete
 */

namespace Adra\AddressAutocomplete\Settings;

use Adra\AddressAutocomplete\Assets\Bundle;
use Adra\AddressAutocomplete\Assets\Google_Loader;

/**
 * The plugin's settings page: the Google API key and a button to test it.
 *
 * It lives under Settings rather than inside Gravity Forms or WooCommerce so it works with either.
 */
final class Settings_Page {

	public const SLUG  = 'adra-address-autocomplete';
	public const GROUP = 'adra_aa';

	/**
	 * Hook suffix of the page, set when the menu item is added.
	 *
	 * @var string
	 */
	private string $hook_suffix = '';

	/**
	 * Creates the page.
	 *
	 * @param Options       $options Plugin settings.
	 * @param Google_Loader $loader  Google Maps loader.
	 */
	public function __construct(
		private Options $options,
		private Google_Loader $loader,
	) {}

	/**
	 * Registers hooks.
	 */
	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_page' ) );
		add_action( 'admin_init', array( $this, 'register_setting' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( ADRA_AA_FILE ), array( $this, 'action_links' ) );
	}

	/**
	 * Adds the page under Settings.
	 */
	public function add_page(): void {
		$this->hook_suffix = (string) add_options_page(
			__( 'Address Autocomplete', 'adra-address-autocomplete' ),
			__( 'Address Autocomplete', 'adra-address-autocomplete' ),
			'manage_options',
			self::SLUG,
			array( $this, 'render' )
		);
	}

	/**
	 * Registers the option and its field.
	 */
	public function register_setting(): void {
		register_setting(
			self::GROUP,
			Options::OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( $this, 'sanitize' ),
				'default'           => array(),
			)
		);

		add_settings_section( 'google', __( 'Google', 'adra-address-autocomplete' ), '__return_false', self::SLUG );

		add_settings_section( 'addresses', __( 'Addresses', 'adra-address-autocomplete' ), '__return_false', self::SLUG );

		add_settings_field(
			'soft_warning',
			__( 'Soft warning', 'adra-address-autocomplete' ),
			array( $this, 'render_soft_warning_field' ),
			self::SLUG,
			'addresses',
			array( 'label_for' => 'adra-aa-soft-warning' )
		);

		add_settings_field(
			'google_api_key',
			__( 'Google API key', 'adra-address-autocomplete' ),
			array( $this, 'render_key_field' ),
			self::SLUG,
			'google',
			array( 'label_for' => 'adra-aa-google-api-key' )
		);
	}

	/**
	 * Cleans submitted settings. Keeps the previous key when the new one is invalid.
	 *
	 * @param mixed $input Submitted value.
	 * @return array<string, string>
	 */
	public function sanitize( $input ): array {
		$input    = is_array( $input ) ? $input : array();
		$previous = get_option( Options::OPTION, array() );
		$previous = is_array( $previous ) && is_string( $previous['google_api_key'] ?? null ) ? $previous['google_api_key'] : '';
		$key      = Options::clean_key( is_string( $input['google_api_key'] ?? null ) ? $input['google_api_key'] : '' );

		if ( null === $key ) {
			add_settings_error(
				Options::OPTION,
				'invalid_google_api_key',
				__( 'That doesn’t look like a Google API key, so the previous key was kept. Google keys contain only letters, numbers, hyphens and underscores.', 'adra-address-autocomplete' )
			);

			$key = $previous;
		}

		return array(
			'google_api_key' => $key,
			'soft_warning'   => ! empty( $input['soft_warning'] ),
		);
	}

	/**
	 * Enqueues the key test on this page only.
	 *
	 * @param string $hook_suffix Current admin page.
	 */
	public function enqueue( string $hook_suffix ): void {
		if ( '' === $this->hook_suffix || $hook_suffix !== $this->hook_suffix ) {
			return;
		}

		$handle = Bundle::register( 'admin-settings' );

		if ( null !== $handle ) {
			wp_enqueue_script( $handle );
			$this->loader->enqueue();
		}
	}

	/**
	 * Adds a Settings link on the Plugins screen.
	 *
	 * @param array<string, string> $links Existing links.
	 * @return array<string, string>
	 */
	public function action_links( array $links ): array {
		$url = admin_url( 'options-general.php?page=' . self::SLUG );

		return array( 'settings' => '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'adra-address-autocomplete' ) . '</a>' ) + $links;
	}

	/**
	 * Prints the soft warning checkbox.
	 */
	public function render_soft_warning_field(): void {
		printf(
			'<input type="hidden" name="%1$s[soft_warning]" value="0"><label><input type="checkbox" id="adra-aa-soft-warning" name="%1$s[soft_warning]" value="1" %2$s> %3$s</label>',
			esc_attr( Options::OPTION ),
			checked( $this->options->soft_warning_enabled(), true, false ),
			esc_html__( 'Ask people to check an address that didn’t come from a suggestion, once, before the order or form goes through', 'adra-address-autocomplete' )
		);
		printf( '<p class="description">%s</p>', esc_html( \Adra\AddressAutocomplete\Address\Warning::message() ) );
	}

	/**
	 * Prints the key field.
	 */
	public function render_key_field(): void {
		if ( $this->options->key_is_from_constant() ) {
			printf(
				'<p id="adra-aa-google-api-key">%s</p>',
				sprintf(
					/* translators: %s: constant name. */
					esc_html__( 'Set in wp-config.php with %s.', 'adra-address-autocomplete' ),
					'<code>' . esc_html( Options::KEY_CONSTANT ) . '</code>'
				)
			);

			return;
		}

		printf(
			'<input type="password" id="adra-aa-google-api-key" name="%s[google_api_key]" value="%s" class="regular-text code" autocomplete="off" spellcheck="false">',
			esc_attr( Options::OPTION ),
			esc_attr( $this->options->google_api_key() )
		);

		echo '<p class="description">';
		printf(
			/* translators: %s: constant name. */
			esc_html__( 'Or define %s in wp-config.php.', 'adra-address-autocomplete' ),
			'<code>' . esc_html( Options::KEY_CONSTANT ) . '</code>'
		);
		echo '</p>';
	}

	/**
	 * Prints the page.
	 */
	public function render(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}

		$has_key   = '' !== $this->options->google_api_key();
		$has_build = null !== Bundle::register( 'admin-settings' );
		$site      = home_url( '/*' );
		?>
		<div class="wrap">
			<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>

			<form action="options.php" method="post">
				<?php
				settings_fields( self::GROUP );
				do_settings_sections( self::SLUG );
				submit_button();
				?>
			</form>

			<h2><?php esc_html_e( 'Test the key', 'adra-address-autocomplete' ); ?></h2>
			<p><?php esc_html_e( 'Runs one address search from this browser with the saved key, the same way your forms and checkout will. Google bills it like any other search.', 'adra-address-autocomplete' ); ?></p>
			<?php if ( ! $has_build ) : ?>
				<div class="notice notice-error inline"><p><?php esc_html_e( 'The plugin’s scripts are missing. Install it from a release zip, or run npm run build.', 'adra-address-autocomplete' ); ?></p></div>
			<?php elseif ( ! $has_key ) : ?>
				<p><em><?php esc_html_e( 'Save a key first.', 'adra-address-autocomplete' ); ?></em></p>
			<?php else : ?>
				<?php if ( null !== $this->loader->stepped_aside_for() ) : ?>
					<div class="notice notice-warning inline"><p>
						<?php
						printf(
							/* translators: %s: script handle of the other plugin's Google Maps script. */
							esc_html__( 'Another plugin already loads Google Maps on this site (script %s), so this plugin uses that copy instead of loading a second one. The test below checks that plugin’s key, not the one saved here, and it must have the Places API (New) enabled.', 'adra-address-autocomplete' ),
							'<code>' . esc_html( (string) $this->loader->stepped_aside_for() ) . '</code>'
						);
						?>
					</p></div>
				<?php endif; ?>
				<p>
					<button type="button" class="button" id="adra-aa-test-key"><?php esc_html_e( 'Test key', 'adra-address-autocomplete' ); ?></button>
				</p>
				<div id="adra-aa-test-key-result" role="status" aria-live="polite"></div>
			<?php endif; ?>

			<h2><?php esc_html_e( 'Setting up a key', 'adra-address-autocomplete' ); ?></h2>
			<p><?php esc_html_e( 'Use a Google Cloud project that belongs to this client, so Google bills them for their own usage.', 'adra-address-autocomplete' ); ?></p>
			<ol>
				<li><?php esc_html_e( 'In Google Cloud, turn on billing for the project.', 'adra-address-autocomplete' ); ?></li>
				<li><?php esc_html_e( 'Enable the Maps JavaScript API and the Places API (New).', 'adra-address-autocomplete' ); ?></li>
				<li><?php esc_html_e( 'Create an API key.', 'adra-address-autocomplete' ); ?></li>
				<li>
					<?php
					printf(
						/* translators: %s: this site's address pattern, e.g. https://example.com/* */
						esc_html__( 'Under Application restrictions, choose Websites and add %s.', 'adra-address-autocomplete' ),
						'<code>' . esc_html( $site ) . '</code>'
					);
					?>
				</li>
				<li><?php esc_html_e( 'Under API restrictions, allow only the Maps JavaScript API and the Places API (New).', 'adra-address-autocomplete' ); ?></li>
			</ol>
			<p><?php esc_html_e( 'The key is sent to visitors’ browsers, as every Google Maps key is. The restrictions above are what stop other sites from using it on this client’s bill.', 'adra-address-autocomplete' ); ?></p>
		</div>
		<?php
	}
}
