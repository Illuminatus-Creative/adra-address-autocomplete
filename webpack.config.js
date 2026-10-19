const path = require('path');
const defaultConfig = require('@wordpress/scripts/config/webpack.config');

module.exports = {
	...defaultConfig,
	entry: {
		'admin-settings': './assets/src/admin/settings.ts',
	},
	output: {
		...defaultConfig.output,
		path: path.resolve(__dirname, 'assets/build'),
	},
};
