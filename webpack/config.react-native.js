var path = require('path');
var NormalModuleReplacementPlugin = require('webpack')
  .NormalModuleReplacementPlugin;
var version = require('../package').version;
const { merge } = require('webpack-merge');
var configShared = require('./config.shared');
var webpack = require('webpack');
var buffer = require('buffer');

module.exports = merge({}, configShared, {
  entry: {
    webpubsub: './src/core/webpubsub-with-encryption.js'
  },
  output: {
    library: 'Webpubsub',
    libraryTarget: 'commonjs2',
    path: path.join(__dirname, '../dist/react-native'),
    filename: 'webpubsub.js'
  },
  externals: {
    // our Reachability implementation needs to reference @react-native-community/netinfo.
    '@react-native-community/netinfo': '@react-native-community/netinfo'
  },
  resolve: {
    modules: ['src/runtimes/react-native']
  },
  plugins: [
    new webpack.DefinePlugin({
      RUNTIME: JSON.stringify('react-native')
    }),
    new webpack.ProvidePlugin({
      buffer: 'buffer'
    })
  ]
});
