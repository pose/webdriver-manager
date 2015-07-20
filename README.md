# Webdriver Manager

Protactor's `webdriver-manager` as a standalone Node.js module.

**Warning:** This is a fork. The official protractor webdriver-manager can be found here: https://github.com/angular/protractor/blob/master/bin/webdriver-manager

## Changelog

### [7.0.1] - 2015-07-20

### Fixed

 - Repaired chromedriver-nw CLI installation and detection. (`Todd Wolfson`)

### [7.0.0] - 2015-07-19

#### Changed
 - Changed how `wm.install` callback (`function (err, filenames) { }`) is called: `filenames` argument now contains only non-undefined values.
 - Added support for nw.js chromedriver (named `chromedriver-nw`)

### [6.0.2] - 2015-07-08

### Fixed

 - `start` callback was not executed: Selenium start up message was updated in version `2.46` (from `Started SocketListener` to `Selenium Server is up and running`). Regex was fixed to handle that case. (Fixed https://github.com/pose/webdriver-manager/issues/12)

### [6.0.0] - 2015-06-09

#### Added

 - Configuration of versions externalized to a `config.json` file. (`Nicolas PENNEC`)
 - Updated `selenium` to `2.46`, `chromedriver` to `2.16` and `iedriver` to `2.46.0`. (`Nicolas PENNEC`)

### [5.2.0] - 2015-05-19

#### Added

 - Added `WebdriverManager` constructor third argument: `quiet` (default: `false`). Supresses writing to both `stdout` and `stderr`.

### [5.1.0] - 2015-05-18

#### Added

 - Added optional callback to `start(options, cb)` method. `cb` will be executed once selenium server has started.

### [5.0.0] - 2015-04-18

#### Changed
 - Updated `chromedriver` version to `2.15`. (`Nicolas PENNEC`)

### [4.0.0] - 2015-04-14

#### Added
 - Added `stop` method that attemps to shut down selenium nicely.
 - Added `options.closeOnStdinInput` parameter to the `start` method to prevent closing standalone on key press.

### Changed

 - `start` method now receives an `options` object.
 - `start` method `options.closeOnStdinInput` is set to `false` by default.
