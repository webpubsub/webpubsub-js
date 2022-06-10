const { merge } = require('webpack-merge');
const path = require('path');
const baseConfig = require('../../../webpack/config.node');

module.exports = merge({}, baseConfig, {
  entry: {
    webpubsub: path.join(
      __dirname,
      "..",
      "..",
      "javascripts",
      "integration",
      "index.node"
    )
  },
  output: {
    filename: "integration_tests_spec.js",
    path: path.join(__dirname, "..", "..", "..", "tmp", "node_integration"),
    libraryTarget: "var"
  },
  resolve: {
    modules: ['spec/javascripts/helpers'],
    alias: {
      webpubsub_integration: 'core/webpubsub.js',
      integration: 'node/integration',
      'dom/dependencies': 'node/mock-dom-dependencies',
      'dom/dependency_loader': 'node/mock-dom-dependencies'
    },
  },
  externals: {
    testenv: "'node'"
  }
});
