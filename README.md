# Webdriver Manager

**News**: [`webdriver-manager`](https://github.com/angular/webdriver-manager) is now an official Angular project!

If your `webdriver-manager` version is `<=9`, this repository contains the source code you are looking for. For versions `>=10` please visit: https://github.com/angular/webdriver-manager.

This repository will is on maintenance mode only addressing bug fixes for `<=9` version bugs. All new feature development can be found at:  https://github.com/angular/webdriver-manager

---

[![Join the chat at https://gitter.im/pose/webdriver-manager](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/pose/webdriver-manager?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

Protactor's `webdriver-manager` as a standalone Node.js module.

**Warning:** This is a fork. The official protractor webdriver-manager can be found here: https://github.com/angular/protractor/blob/master/bin/webdriver-manager

## Changelog

### [9.0.0] - 2016-03-20

#### Changed

 - Multiple version updates: Selenium to 2.52.0, Chromedriver to 2.21, IEDriver
   to 2.52.2 and Chromedrive-nw to 0.13.0. (`Jérôme Macias`)

### [8.0.0] - 2015-12-20

#### Changed

 - Multiple Updates: Selenium to 2.48.2, Chromedriver to 2.20, IEDriver to
   2.48.0, Chromedriver-nw to 0.12.3. (`Todd Wolfson`)

### [7.0.1] - 2015-07-20

#### Fixed

 - Repaired chromedriver-nw CLI installation and detection. (`Todd Wolfson`)

### [7.0.0] - 2015-07-19

#### Changed
 - Changed how `wm.install` callback (`function (err, filenames) { }`) is called: `filenames` argument now contains only non-undefined values.
 - Added support for nw.js chromedriver (named `chromedriver-nw`)

### [6.0.2] - 2015-07-08

#### Fixed

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
