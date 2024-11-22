'use strict';
const fancyLog = require('fancy-log');
const PluginError = require('plugin-error');
const through = require('through2');
const applySourceMap = require('vinyl-sourcemaps-apply');
const postcssEditorStyles = require("postcss-editor-styles");
const postcss = require('postcss');

module.exports = options => {
	return through.obj((file, encoding, callback) => {
		if (file.isNull()) {
			callback(null, file);
			return;
		}

		if (file.isStream()) {
			callback(new PluginError('gulp-editor-styles', 'Streaming not supported'));
			return;
		}

		postcss(postcssEditorStyles(options)).process(file.contents.toString(), {
			map: file.sourceMap ? {annotation: false} : false,
			from: file.path,
			to: file.path
		}).then(result => {

			// replace .editor-styles-wrapper body with .editor-styles-wrapper in result.css
			result.css = result.css.replace(/\.editor-styles-wrapper body/g, '.editor-styles-wrapper');
			
			file.contents = Buffer.from(result.css);

			if (result.map && file.sourceMap) {
				const map = result.map.toJSON();
				map.file = file.relative;
				map.sources = map.sources.map(() => file.relative);
				applySourceMap(file, map);
			}

			const warnings = result.warnings();

			if (warnings.length > 0) {
				fancyLog('gulp-editor-styles:', '\n  ' + warnings.join('\n  '));
			}

			setImmediate(callback, null, file);
		}).catch(error => {
			const cssError = error.name === 'CssSyntaxError';

			if (cssError) {
				error.message += error.showSourceCode();
			}

			// Prevent stream unhandled exception from being suppressed by Promise
			setImmediate(callback, new PluginError('gulp-editor-styles', error, {
				fileName: file.path,
				showStack: !cssError
			}));
		});
	});
};
