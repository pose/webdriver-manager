var WebdriverManager = require('./lib/index');

var wm = new WebdriverManager('my-selenium-path');

// { standalone: 'not present', chrome: 'not present', ie: 'not present' }
console.log(wm.status());

// Install Selenium Standalone and Google Chrome
wm.install(['standalone', 'chrome'], function (err, filenames) {

  console.log(filenames);

  // { standalone: 'ready', chrome: 'ready', ie: 'not present' }
  console.log(wm.status());

  // Start selenium
  wm.start();
});



