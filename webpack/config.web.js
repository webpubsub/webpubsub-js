var path = require('path');
var webpack = require('webpack');
var NormalModuleReplacementPlugin = webpack.NormalModuleReplacementPlugin;
const { merge } = require('webpack-merge');
var configShared = require('./config.shared');

var filename = configShared.optimization.minimize
  ? 'webpubsub.min.js'
  : 'webpubsub.js';

var entry = './src/core/webpubsub.js';
if (process.env.INCLUDE_TWEETNACL === 'true') {
  entry = './src/core/webpubsub-with-encryption.js';
  filename = filename.replace('webpubsub', 'webpubsub-with-encryption');
}

module.exports = merge({}, configShared, {
  entry: {
    webpubsub: entry
  },
  output: {
    library: 'Webpubsub',
    path: path.join(__dirname, '../dist/web'),
    filename: filename,
    libraryTarget: 'umd'
  },
  resolve: {
    modules: ['src/runtimes/web']
  },
  plugins: [
    new webpack.DefinePlugin({
      global: 'window',
      RUNTIME: JSON.stringify('web')
    })
  ]
});
