// Maxstagram
// ==========
//
// A flexible, continuous image processing web service, with some features:
// 
//    1. Full-stack: webserver and asynchronous execution layer
//       initialized by running a single Node.js file (this one).
//    2. Email-based: all notifications are sent via email.
//
var argv = require('minimist')(process.argv.slice(2))
  , util = require('./util')
  , log = util.log
  , launch = util.launch
  ;

function main() {
  // Logging and configuration
  var config = util.mergeInto(require('./config'), argv);
  util.resolvePaths(config);
  log.info('SUPERVISOR: INIT');
  
  // Load process modules
  launch.supervise('processes/WebServer', config);
  launch.cron('UploadIngester', {
    frequencySeconds: 5, 
    runForMaxSeconds: 240
  });
}


if (require.main === module) main();