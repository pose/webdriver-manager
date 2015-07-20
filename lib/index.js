var fs = require('fs');
var os = require('os');
var url = require('url');
var util = require('util');

var request = require('request');
var http = require('http');
var path = require('path');
var AdmZip = require('adm-zip');
var childProcess = require('child_process');
var async = require('async');
var EventEmitter = require('events').EventEmitter;
var targz = require('tar.gz');

var versions = require('../config.json').webdriverVersions;

/**
 * Get the major and minor version but ignore the patch (required for selenium
 * download URLs).
 */
var shortVersion = function(version) {
  return version.slice(0, version.lastIndexOf('.'));
};


/**
 * Normalize a command across OS
 */
var spawnCommand = function(command, args, log) {
  var win32 = process.platform === 'win32';
  var winCommand = win32 ? 'cmd' : command;
  var finalArgs = win32 ? ['/c'].concat(command, args) : args;

  var child = childProcess.spawn(winCommand, finalArgs,
                            { stdio: 'pipe' });

  var eventEmitter = new EventEmitter();
  var started = false;

  child.stderr.on('data', function (data) {
    log(data);

    if (/running/g.test(data.toString()) && !started) {
      eventEmitter.emit('ready', child);
      started = true;
    }
  });

  child.on('error', function (err) {
    eventEmitter.emit('error', err);
  });

  child.on('exit', function (code) {
    eventEmitter.emit('exit', code);
  });

  eventEmitter.pid = child.pid;

  return eventEmitter;
};

/**
 * Append '.exe' to a filename if the system is windows.
 */
var executableName = function(file) {
  if (os.type() === 'Windows_NT') {
    return file + '.exe';
  } else {
    return file;
  }
};

function binaries() {
  // TODO refactor urls to be build as the ones on 'chromedriver-nw'
  return {
    standalone: {
      name: 'selenium standalone',
      isDefault: true,
      prefix: 'selenium-server-standalone',
      filename: function () {
        return 'selenium-server-standalone-' + versions.selenium + '.jar';
      },
      url: function() {
        return 'http://selenium-release.storage.googleapis.com/' +
        shortVersion(versions.selenium) + '/' +
          'selenium-server-standalone-' + versions.selenium + '.jar';
      }
    },
    chrome: {
      name: 'chromedriver',
      isDefault: true,
      prefix: 'chromedriver_',
      filename: function () {
        return 'chromedriver_' + versions.chromedriver + '.zip';
      },
      url: function() {
        var urlPrefix = 'http://chromedriver.storage.googleapis.com/' +
        versions.chromedriver + '/chromedriver_';
        if (os.type() === 'Darwin') {
          return urlPrefix + 'mac32.zip';
        } else if (os.type() === 'Linux') {
          if (os.arch() === 'x64') {
            return urlPrefix + 'linux64.zip';
          } else {
            return urlPrefix + 'linux32.zip';
          }
        } else if (os.type() === 'Windows_NT') {
          return urlPrefix + 'win32.zip';
        }
      }
    },
    'chromedriver-nw': {
      name: 'chromedriver (for nwjs)',
      isDefault: false,
      prefix: 'chromedriver-nw',
      filename: function () {
        var filename = 'chromedriver-nw-v' + versions['chromedriver-nw'] + '-';

        var suffixes = [
          {type: 'Darwin',     arch: 'x64',  suffix: 'osx-x64.zip'},
          {type: 'Darwin',     arch: 'ia32', suffix: 'osx-ia32.zip'},
          {type: 'Linux',      arch: 'x64',  suffix: 'linux-x64.tar.gz'},
          {type: 'Linux',      arch: 'ia32', suffix: 'linux-ia32.tar.gz'},
          {type: 'Windows_NT', arch: 'x64',  suffix: 'win-x64.zip'},
          {type: 'Windows_NT', arch: 'ia32', suffix: 'win-ia32.zip'}
        ];

        var i;

        for (i = 0; i < suffixes.length; i++) {
          if (suffixes[i].type === os.type() && suffixes[i].arch === os.arch()) {
            return filename + suffixes[i].suffix;
          }
        }

        throw new Error('Invalid type/arch');
      },
      url: function () {
        var urlPrefix = 'http://dl.nwjs.io/v0.12.2/';
        return urlPrefix + this.filename();
      }
    },
    ie: {
      name: 'IEDriver',
      isDefault: false,
      prefix: 'IEDriverServer',
      filename: function () {
        return 'IEDriverServer_' + versions.iedriver + '.zip';
      },
      url: function() {
        var urlPrefix = 'http://selenium-release.storage.googleapis.com/' +
        shortVersion(versions.iedriver) + '/IEDriverServer';
        if (os.type() === 'Windows_NT') {
          if (os.arch() === 'x64') {
            return urlPrefix + '_x64_' + versions.iedriver + '.zip';
          } else {
            return urlPrefix + '_Win32_' + versions.iedriver + '.zip';
          }
        }
      }
    }
  };
}

var SELENIUM_DIR =  path.resolve(__dirname, '../selenium');

function WebdriverManager(out_dir, proxy, quiet) {
  this.out_dir = out_dir || SELENIUM_DIR;
  this.proxy = proxy;
  this.quiet = quiet;

  // this.log = this.quiet ? function () {} : process.stdout.write.bind(process.stdout);
  this.log = this.quiet ? function () {} : console.log.bind(console);
  this.errorLog = this.quiet ? function () {} : console.error.bind(console);

  // Create directory if it does not exist
  if (!fs.existsSync(this.out_dir) || !fs.statSync(this.out_dir).isDirectory()) {
    fs.mkdirSync(this.out_dir);
  }

  // Setup before any command.
  this.existingFiles = fs.readdirSync(this.out_dir);
  this._checkBinaries();
}

WebdriverManager.prototype._checkBinaries = function () {
  this.binaries = binaries();

  for (var name in this.binaries) {
    bin = this.binaries[name];
    var exists = fs.existsSync(path.join(this.out_dir, bin.filename()));
    var outOfDateExists = false;
    this.existingFiles.forEach(function(file) {
      if (file.indexOf(bin.prefix) != -1 && file != bin.filename()) {
        outOfDateExists = true;
      }
    });
    bin.exists = exists;
    bin.outOfDateExists = outOfDateExists;
  }
};

WebdriverManager.prototype._resolveProxy = function(fileUrl) {
  var protocol = url.parse(fileUrl).protocol;
  if (this.proxy) {
    return this.proxy;
  } else if (protocol === 'https:') {
    return process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
  } else if (protocol === 'http:') {
    return process.env.HTTP_PROXY || process.env.http_proxy;
  }
};

/**
 * If a new version of the file with the given url exists, download and
 * delete the old version.
 */
WebdriverManager.prototype._downloadIfNew = function(bin, opt_callback) {
  var that = this;

  if (!bin.exists) {
    // Remove anything else that matches the exclusive prefix.
    this.existingFiles.forEach(function(file) {
      if (file.indexOf(bin.prefix) != -1) {
        fs.unlinkSync(path.join(that.out_dir, file));
      }
    });
    this.log('Updating ' + bin.name);
    var url = bin.url();
    if (!url) {
      that.errorLog(bin.name + ' is not available for your system.');
      return;
    }
    this._httpGetFile(url, bin.filename(), function(downloaded) {
      if (opt_callback) {
        opt_callback(downloaded);
      }
    });
  } else {
    this.log(bin.name + ' is up to date.');
    if (opt_callback) {
      opt_callback(path.join(that.out_dir, bin.filename()));
    }
  }
};


WebdriverManager.prototype._httpGetFile = function(fileUrl, fileName, callback) {
  this.log('downloading ' + fileUrl + '...');
  var filePath = path.join(this.out_dir, fileName);
  var file = fs.createWriteStream(filePath);
  var self = this;
  var size = 0;
  var downloaded = 0;
  var timer;

  var options = {
    url: fileUrl,
    proxy: this._resolveProxy(fileUrl)
  };
  request(options).on('error', function(error) {
      fs.unlink(filePath);
      self.errorLog('Error: Got error ' + error + ' from ' + fileUrl);
  }).on('response', function(response) {
    if (response.statusCode !== 200) {
      fs.unlink(filePath);
      self.errorLog('Error: Got code ' + response.statusCode + ' from ' + fileUrl);
      return;
    }

    size = parseInt(response.headers['content-length'], 10);
    // Useful for debugging
    // console.log(response.headers['content-length']);
    //timer = setInterval(function () {
    //  var downloadedMB = (downloaded/1048576).toFixed(2);
    //  var totalMB = (size / 1048576).toFixed(2);
    //  console.log(fileName, downloadedMB + '/' + totalMB + 'mb');
    //}, 3000);
  }).on('data', function (chunk) {
    downloaded += chunk.length;
  }).pipe(file).on('close', function() {
    self.log(fileName + ' downloaded to ' + filePath);
    if (callback) {
      callback(filePath);
    }
    clearInterval(timer);
  });
};

/**
 * Starts Selenium Standalone.
 *
 * @param {Object}    [options]
 *  @param {Number}   [seleniumPort=4444]       localhost port where selenium will listen.
 *  @param {Boolean}  [closeOnStdinInput=false] Close selenium instance when a input from
 *                                              stdin is received.
 * @param {Function}  [cb]                      Callback called once selenium has started.
 *
 * @method
 */
WebdriverManager.prototype.start = function (options, cb) {
  options                   = options                   || {};
  options.seleniumPort      = options.seleniumPort      || 4444;
  options.closeOnStdinInput = options.closeOnStdinInput || false;

  cb = cb || function () { };
  var self = this;

  if (!this.binaries.standalone.exists) {
    self.errorLog('Selenium Standalone is not present. Install with ' +
                   'webdriver-manager update --standalone');
    process.exit(1);
  }
  var args = ['-jar', path.join(this.out_dir, this.binaries.standalone.filename())];
  if (options.seleniumPort) {
    args.push('-port', options.seleniumPort);
  }
  if (this.binaries.chrome.exists || this.binaries['chromedriver-nw'].exists) {
    args.push('-Dwebdriver.chrome.driver=' +
              path.join(this.out_dir, executableName('chromedriver')));
  }
  if (this.binaries.ie.exists) {
    args.push('-Dwebdriver.ie.driver=' +
              path.join(this.out_dir, executableName('IEDriverServer')));
  }
  var out = this.quiet ? function () {} : process.stdout.write.bind(process.stdout);
  var selenium = spawnCommand('java', args, out);
  self.log('selenium.pid: ' + selenium.pid);
  selenium.on('exit', function(code) {
    self.log('Selenium Standalone has exited with code ' + code);
    process.exit(code);
  });
  process.stdin.resume();

  if (options.closeOnStdinInput) {
    process.stdin.on('data', function(chunk) {
      self.stop();
    });
  }

  process.on('SIGINT', function() {
    self.log('Staying alive until the Selenium Standalone process exits');
  });

  selenium.once('ready', function (child) {
    process.on('exit', function(worker, code, signal) {
      child.kill('SIGINT');
    });

    // TODO Obtain URL from options
    request('http://localhost:' + options.seleniumPort + '/wd/hub/status', function (err, response, body) {
      if (err) {
        return cb(err);
      }
      if (response.statusCode === 200) {
        return cb(null);
      }
      return cb(response);
    });
  });


  return selenium;
};

/**
 * Sends Selenium Standalone a shutdown request.
 *
 * @param {Object}    [options]
 *  @param {Number}   [seleniumPort=4444]       localhost port where selenium listens.
 *
 * @method
 */
WebdriverManager.prototype.stop = function (options) {
  options = options || {};
  options.seleniumPort = options.seleniumPort || 4444;

  var self = this;

  self.log('Attempting to shut down selenium nicely');
  var url = util.format(
    'http://localhost:%d/selenium-server/driver/?cmd=shutDownSeleniumServer',
    options.seleniumPort
  );
  http.get(url);
};

WebdriverManager.prototype.status = function () {
  var that = this;
  this._checkBinaries();

  return Object.keys(this.binaries).reduce(function (dict, key) {
    var value = that.binaries[key];

    if (value.exists) {
      dict[key] = 'ready';
    } else if (value.outOfDateExists) {
      dict[key] = 'outdated';
    } else {
      dict[key] = 'not present';
    }

    return dict;
  }, {});
};

WebdriverManager.prototype.install = WebdriverManager.prototype.update = function(installables, cb) {
  var that = this;
  installables = installables || [];

  var standalone      = installables.indexOf('standalone')            !== -1;
  var chrome          = installables.indexOf('chrome')                !== -1;
  var chromedriverNW  = installables.indexOf('chromedriver-nw')       !== -1;
  var ie              = installables.indexOf('ie')                    !== -1;

  async.parallel([
    function (done) {
    if (standalone) {
      that._downloadIfNew(that.binaries.standalone, function (filename) {
        done(null, filename);
      });
    } else {
      done(null);
    }
  }, function (done) {
    if (chromedriverNW) {
      that._downloadIfNew(that.binaries['chromedriver-nw'], function (filename) {

        if (filename.indexOf('tar.gz') === filename.length - 'tar.gz'.length) {
          var compress = new targz().extract(filename, that.out_dir, function(err){
            if(err) { return done(err); }

            // get extracted 'chromedriver' path
            var filenameWithoutTargz = filename.slice(0, filename.length - '.tar.gz'.length);
            var chromeDriverPath = path.join(filenameWithoutTargz, 'chromedriver');

            var outPath = path.join(that.out_dir, 'chromedriver');
            fs.renameSync(chromeDriverPath, outPath);
            fs.rmdirSync(filenameWithoutTargz);

            done(null, outPath);

          });
          return;
        }

        // TODO Handle the case of a non-zip file (tar.gz on Linux)
        var zip = new AdmZip(filename);
        that.log(filename, that.out_dir);

        var zipEntries = zip.getEntries();

        if (zipEntries.length > 1) {
          return done(new Error('there should be only one entry in the chromedriverNW zip'));
        }

        filename = path.join(that.out_dir, 'chromedriver');
        // chromewebdriver-nw contains a folder with a single file.
        // Get that entry and unzip it directly (if not, it creates a containing
        // folder).
        fs.writeFile(filename, zipEntries[0].getData(), function(err) {
            if (err) { return done(err); }

            if (os.type() != 'Windows_NT') {
              fs.chmodSync(filename, 0755);
            }

            done(null, filename);
          });

      });
    } else {
      done(null);
    }
  }, function (done) {
    if (chrome) {
      that._downloadIfNew(that.binaries.chrome, function(filename) {
        var zip = new AdmZip(filename);
        // Expected contents of the zip:
        //   mac/linux: chromedriver
        //   windows: chromedriver.exe
        that.log(filename, that.out_dir);
        zip.extractAllTo(that.out_dir);
        filename = path.join(that.out_dir, 'chromedriver');
        if (os.type() != 'Windows_NT') {
          fs.chmodSync(filename, 0755);
        }
        done(null, filename);
      });
    } else {
      done(null);
    }
  },
  function (done) {
    if (ie) {
      that._downloadIfNew(that.binaries.ie,
                          function(filename) {
                            var zip = new AdmZip(filename);
                            // Expected contents of the zip:
                            //   IEDriverServer.exe
                            zip.extractAllTo(that.out_dir);
                            filename = path.join(that.out_dir, 'IEDriverServer.exe');
                            done(null, filename);
                          });
    } else {
      done(null);
    }
  }], function (err, result) {
    // After install check binaries
    that._checkBinaries();

    result = result.filter(function (r) { return r; });


    cb(err, result);
  });

};

module.exports = WebdriverManager;
