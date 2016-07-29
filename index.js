'use strict';

var _ = require('lodash');
var loaderUtils = require('loader-utils');
var elmCompiler = require('node-elm-compiler');
var glob = require('glob');
var temp = require('temp');

// Load elm-package.json and build deps from 'source-directories' field
// TODO: specify location of elm-package.json as option
var fs = require('fs');
var elmPackage = JSON.parse(fs.readFileSync('./elm-package.json', 'utf8'));
if (elmPackage['source-directories'].length > 1) {
  var depsGlob = '{' + elmPackage['source-directories'].join(',') + '}/**/*.elm'
} else {
  var depsGlob = elmPackage['source-directories'][0] + '/**/*.elm'
}

var defaultOptions = {
  cache: false,
  yes: true
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
  var dependencies = new Promise(function(resolve, reject) {
    glob(depsGlob, function(err, files) {
      if (err) {
        return reject();
      }
      files.forEach(loader.addDependency);
      return resolve();
    })
  });

  var compilation = new Promise(function(resolve, reject) {
    options.output = temp.path({suffix: '.js'});

    // compileToString in node-elm-compiler also does this:
    options.processOpts = {
      stdio: 'pipe'
    }

    var compiler = elmCompiler.compile(input, options);
    var output = '';
    compiler.stdout.on('data', function(chunk) {
      output += chunk;
    });
    compiler.stderr.on('data', function(chunk) {
      output += chunk;
    });

    compiler.on('close', function(exitCode) {
      if (exitCode !== 0) {
        temp.cleanupSync();
        return reject(new Error('Compilation failed\n' + output));
      }

      fs.readFile(options.output, function(err, data) {
        if (err) {
          reject(err);
        } else {
          fs.unlinkSync(options.output);
          resolve(data);
        }
      });
    });

  });

  Promise.all([dependencies, compilation]).then(function(results) {
    var output = results[1]; // compilation output

    callback(null, output);
  }).catch(function(err) {
    err.message = 'Compiler process exited with error ' + err.message;
    callback(err);
  });
}
