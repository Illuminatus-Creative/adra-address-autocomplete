const path = require('path');
const defaultConfig = require('@wordpress/scripts/config/webpack.config');

module.exports = {
	...defaultConfig,
	entry: {
		'admin-settings': './assets/src/admin/settings.ts',
		'gravity-forms': './assets/src/gravity-forms.ts',
		'woocommerce-admin-order': './assets/src/woocommerce-admin-order.ts',
		'woocommerce-provider': './assets/src/woocommerce-provider.ts',
	},
	output: {
		...defaultConfig.output,
		path: path.resolve(__dirname, 'assets/build'),
	},
};
