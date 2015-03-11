var fs = require('fs');
var os = require('os');
var url = require('url');
var request = require('request');
var http = require('http');
var path = require('path');
var AdmZip = require('adm-zip');
var childProcess = require('child_process');
var async = require('async');
var EventEmitter = require('events').EventEmitter;

var versions =  { "selenium": "2.45.0", "chromedriver": "2.14", "iedriver": "2.45.0" };

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
var spawnCommand = function(command, args) {
  var win32 = process.platform === 'win32';
  var winCommand = win32 ? 'cmd' : command;
  var finalArgs = win32 ? ['/c'].concat(command, args) : args;

  var child = childProcess.spawn(winCommand, finalArgs,
                            { stdio: 'pipe' });

  var eventEmitter = new EventEmitter();
  var started = false;

  child.stderr.on('data', function (data) {
    process.stdout.write(data);
    if (/Started SocketListener/g.test(data.toString()) && !started) {
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
  if (os.type() == 'Windows_NT') {
    return file + '.exe';
  } else {
    return file;
  }
};

function binaries() {
  return {
    standalone: {
      name: 'selenium standalone',
      isDefault: true,
      prefix: 'selenium-server-standalone',
      filename: 'selenium-server-standalone-' + versions.selenium + '.jar',
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
      filename: 'chromedriver_' + versions.chromedriver + '.zip',
      url: function() {
        var urlPrefix = 'http://chromedriver.storage.googleapis.com/' +
        versions.chromedriver + '/chromedriver_';
        if (os.type() == 'Darwin') {
          return urlPrefix + 'mac32.zip';
        } else if (os.type() == 'Linux') {
          if (os.arch() == 'x64') {
            return urlPrefix + 'linux64.zip';
          } else {
            return urlPrefix + 'linux32.zip';
          }
        } else if (os.type() == 'Windows_NT') {
          return urlPrefix + 'win32.zip';
        }
      }
    },
    ie: {
      name: 'IEDriver',
      isDefault: false,
      prefix: 'IEDriverServer',
      filename: 'IEDriverServer_' + versions.iedriver + '.zip',
      url: function() {
        var urlPrefix = 'http://selenium-release.storage.googleapis.com/' +
        shortVersion(versions.iedriver) + '/IEDriverServer';
        if (os.type() == 'Windows_NT') {
          if (os.arch() == 'x64') {
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

function WebdriverManager(out_dir, proxy) {
  this.out_dir = out_dir || SELENIUM_DIR;
  this.proxy = proxy;

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
    var exists = fs.existsSync(path.join(this.out_dir, bin.filename));
    var outOfDateExists = false;
    this.existingFiles.forEach(function(file) {
      if (file.indexOf(bin.prefix) != -1 && file != bin.filename) {
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
    return process.env.HTTP_PROXY || process.env.http_proxy;
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
    console.log('Updating ' + bin.name);
    var url = bin.url();
    if (!url) {
      console.error(bin.name + ' is not available for your system.');
      return;
    }
    this._httpGetFile(url, bin.filename, function(downloaded) {
      if (opt_callback) {
        opt_callback(downloaded);
      }
    });
  } else {
    console.log(bin.name + ' is up to date.');
    if (opt_callback) {
      opt_callback(path.join(that.out_dir, bin.filename));
    }
  }
};


WebdriverManager.prototype._httpGetFile = function(fileUrl, fileName, callback) {
  console.log('downloading ' + fileUrl + '...');
  var filePath = path.join(this.out_dir, fileName);
  var file = fs.createWriteStream(filePath);

  var options = {
    url: fileUrl,
    proxy: this._resolveProxy(fileUrl)
  };
  request(options).on('error', function(error) {
      fs.unlink(filePath);
      console.error('Error: Got error ' + error + ' from ' + fileUrl);
  }).on('response', function(response) {
    if (response.statusCode !== 200) {
      fs.unlink(filePath);
      console.error('Error: Got code ' + response.statusCode + ' from ' + fileUrl);
      return;
    }
  }).pipe(file).on('close', function() {
    console.log(fileName + ' downloaded to ' + filePath);
    if (callback) {
      callback(filePath);
    }
  });
};

WebdriverManager.prototype.start = function (seleniumPort) {
  if (!this.binaries.standalone.exists) {
    console.error('Selenium Standalone is not present. Install with ' +
                  'webdriver-manager update --standalone');
    process.exit(1);
  }
  var args = ['-jar', path.join(this.out_dir, this.binaries.standalone.filename)];
  if (seleniumPort) {
    args.push('-port', seleniumPort);
  }
  if (this.binaries.chrome.exists) {
    args.push('-Dwebdriver.chrome.driver=' +
              path.join(this.out_dir, executableName('chromedriver')));
  }
  if (this.binaries.ie.exists) {
    args.push('-Dwebdriver.ie.driver=' +
              path.join(this.out_dir, executableName('IEDriverServer')));
  }
  var selenium = spawnCommand('java', args);
  console.log('selenium.pid: ' + selenium.pid);
  selenium.on('exit', function(code) {
    console.log('Selenium Standalone has exited with code ' + code);
    process.exit(code);
  });
  process.stdin.resume();
  process.stdin.on('data', function(chunk) {
    console.log('Attempting to shut down selenium nicely');
    http.get('http://localhost:4444/selenium-server/driver/?cmd=shutDownSeleniumServer');

  });
  process.on('SIGINT', function() {
    console.log('Staying alive until the Selenium Standalone process exits');
  });

  selenium.once('ready', function (child) {
    process.on('exit', function(worker, code, signal) {
      child.kill('SIGINT');
    });
  });

  return selenium;

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
  installables = installables || [];

  var standalone  = installables.indexOf('standalone')  !== -1;
  var chrome      = installables.indexOf('chrome')      !== -1;
  var ie          = installables.indexOf('ie')          !== -1;

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
    if (chrome) {
      that._downloadIfNew(that.binaries.chrome,
                          function(filename) {
                            var zip = new AdmZip(filename);
                            // Expected contents of the zip:
                            //   mac/linux: chromedriver
                            //   windows: chromedriver.exe
                            console.log(filename, that.out_dir);
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

    cb(err, result);
  });

};

module.exports = WebdriverManager;

