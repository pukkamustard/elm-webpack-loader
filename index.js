'use strict';

var _ = require('lodash');
var loaderUtils = require('loader-utils');
var elmCompiler = require('node-elm-compiler');
var glob = require('glob');

var defaultOptions = {
  cache: false,
  yes: true,
  deps: ''
};

var getInput = function() {
  return this.resourcePath;
};

var getOptions = function() {
  var globalOptions = this.options.elm || {};
  var loaderOptions = loaderUtils.parseQuery(this.query);
  return _.extend({
    emitWarning: this.emitWarning
  }, defaultOptions, globalOptions, loaderOptions);
};

module.exports = function() {
  this.cacheable && this.cacheable();

  var callback = this.async();

  if (!callback) {
    throw 'elm-webpack-loader currently only supports async mode.';
  }

  var input = getInput.call(this);
  var options = getOptions.call(this);

  var loader = this;
  var dependencies = new Promise(function(resolve, reject){
      glob(options.deps, function(err, files){
          if (err){
              return reject();
          }
          files.forEach(loader.addDependency);
          return resolve();
      })
  });

  var compilation = elmCompiler.compileToString(input, options);

  Promise.all([dependencies, compilation])
    .then(function(results) {
      var output = results[1]; // compilation output

      callback(null, output);
    })
    .catch(function(err) {
      err.message = 'Compiler process exited with error ' + err.message;
      callback(err);
    });
}
