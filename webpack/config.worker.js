var path = require('path');
var NormalModuleReplacementPlugin = require('webpack')
  .NormalModuleReplacementPlugin;
var version = require('../package').version;
const { merge } = require('webpack-merge');
var webpack = require('webpack');
var configShared = require('./config.shared');

var filename = configShared.optimization.minimize
  ? 'webpubsub.worker.min.js'
  : 'webpubsub.worker.js';

var entry = './src/core/webpubsub.js';
if (process.env.INCLUDE_TWEETNACL === 'true') {
  entry = './src/core/webpubsub-with-encryption.js';
  filename = filename.replace('webpubsub', 'webpubsub-with-encryption');
}

var config = merge(configShared, {
  entry: {
    webpubsub: entry
  },
  output: {
    library: 'Webpubsub',
    path: path.join(__dirname, '../dist/worker'),
    filename: filename,
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  resolve: {
    // in order to import the appropriate runtime.ts
    modules: ['src/runtimes/worker']
  },
  plugins: [
    new webpack.DefinePlugin({
      global: 'self',
      RUNTIME: JSON.stringify('worker')
    })
  ]
});

module.exports = config;
