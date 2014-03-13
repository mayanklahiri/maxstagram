// Maxstagram
// ==========
//
// A flexible, continuous image processing web service.
//
var argv = require('minimist')(process.argv.slice(2))
  , util = require('./util')
  ;

function main() {
  // Load configuration and initialize application
  var config = util.mergeInto(require('./config'), argv);

  // In a test configuration, override parameters with their _test versions.
  for (var key in config)
    if (key.match(/_test$/)) {
      if (config.test)
        config[key.substr(0, key.length-5)] = config[key];
      delete config[key];
    }

  // Initialize this process
  util.init(config, function (err) {
    if (err) throw err;

    // Load process modules
    util.launch('processes/WebServer', config, {
      exponential_backoff: true,
      log_events: true,
    });
    util.launch('processes/UploadIngester', config);
    util.launch('processes/ImageProcessor', config);
    util.launch('processes/NotificationSender', config);
  });
}

if (require.main === module) main();
