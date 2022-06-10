var path = require('path');
const { merge } = require('webpack-merge');
var configShared = require('./config.shared');
var webpack = require('webpack');

module.exports = merge({}, configShared, {
  entry: {
    webpubsub: './src/core/webpubsub-with-encryption.js'
  },
  output: {
    library: 'Webpubsub',
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, '../dist/node'),
    filename: 'webpubsub.js'
  },
  target: 'node',
  resolve: {
    // in order to import the appropriate runtime.ts
    modules: ['src/runtimes/node']
  },
  plugins: [
    new webpack.DefinePlugin({
      RUNTIME: JSON.stringify('node')
    })
  ]
});
