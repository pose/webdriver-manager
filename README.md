# Webdriver Manager

Protactor's `webdriver-manager` as an standalone Node.js module.

**Warning:** The official protractor webdriver-manager can be found here: https://github.com/angular/protractor/blob/master/bin/webdriver-manager

## Changelog

### [4.0.0] - 2015-04-14

#### Added
 - Added `stop` method that attemps to shut down selenium nicely.
 - Added `options.closeOnStdinInput` parameter to the `start` method to prevent closing standalone on key press.

### Changed

 - `start` method now receives an `options` object.
 - `start` method `options.closeOnStdinInput` is set to `false` by default.
