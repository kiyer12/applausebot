const path = require('path');

const webpack = require("webpack");
module.exports = {
  // Which start file(s) to build the dependency graph from
  entry: {
    main: './src/callstarter.js',
    soundboard: './src/soundboard.js'
  }, 
  // Where Webpack should create the bundle(s) and what to call them.
  output: { 
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist')
  }, 
  // Tell Webpack how to transform files other than JS files
  module: { 
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', "@babel/preset-react"]
          }
        }
      }
    ]
  }, 
  // Specify plugins to do all sorts of tasks
  plugins: [
  ]
};