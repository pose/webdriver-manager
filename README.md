# Webdriver Manager

Protactor's `webdriver-manager` as a standalone Node.js module.

**Warning:** The official protractor webdriver-manager can be found here: https://github.com/angular/protractor/blob/master/bin/webdriver-manager

## Changelog

### [5.1.0] - 2015-05-18
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
