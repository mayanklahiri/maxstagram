// Maxstagram: A flexible, continuous image processing web service.
//
var argv = require('minimist')(process.argv.slice(2))
  , init = require('./init')
  , util = require('./util')
  ;

function main() {
  // Load configuration and initialize application
  var config = util.mergeInto(require('./config'), argv);

  // In a test configuration, override parameters with their _test versions.
  // Otherwise, delete the _test versions.
  for (var key in config)
    if (key.match(/_test$/)) {
      if (config.test !== 'false')
        config[key.substr(0, key.length-5)] = config[key];
      delete config[key];
    }

  // Initialize logging and database access via util.init()
  init.Init(config, function (err) {
    if (err) throw err;

    // Webserver process
    init.Launch('processes/WebServer', config, {
      exponential_backoff: true,
      log_events: true,
    });

    // Queue processors
    init.Launch('processes/UploadIngester', config);
    init.Launch('processes/ImageProcessor', config);
    init.Launch('processes/NotificationSender', config);
  });
}

if (require.main === module) main();
