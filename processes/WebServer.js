var path = require('path')
  , os = require('os')
  , db = require('../db')
  , express = require('express')
  , formidable = require('formidable')
  , util = require('../util')
  , config = JSON.parse(process.env.config)
  , log = util.log
  ;

function main() {
  var app = express();

  // Compress responses
  app.use(express.compress())

  // Add file upload ability
  config.dir_uploads = config.dir_uploads || os.tmpdir();
  log.info('WebServer: uploads directory is %s', config.dir_uploads);
  app.use(function(req, res, next) {
    if (req.url != '/upload' || req.method.toLowerCase() != 'post')
      return next();
    var form = new formidable.IncomingForm();
    form.maxFields = 30;
    form.hash = 'sha1';
    form.uploadDir = config.dir_uploads;
    form.parse(req, function(err, fields, files) {
      if (err) {
        log.error('WebServer: formidable error', err);
        return End(res, 500, err);
      }

      if (!fields.email)
        return End(res, 400, 'Email address not specified.');
      if (!files || !files.image || !files.image.size)
        return End(res, 400, 'No files found in your upload.');

      var remote_ip = req.connection.remoteAddress;
      ProcessFileUpload(fields.email, remote_ip, files.image);
      End(res, 200, 'Received upload, thank you.');
    });
  });


  // Add static file serving from webroot
  if (config.dir_webroot) {
    log.info('WebServer: webroot directory is %s', config.dir_webroot);
    app.use(express.static(config.dir_webroot, {maxAge: 86400}));
  }


  // Init database
  db.init(config, function(err) {
    if (err) {
      log.error('WebServer: DB init failure:', err);
      process.exit(-1);
    }

    // Start listening on webserver port
    config.port = config.port || 8080;
    app.listen(config.port);
    log.info(util.format('WebServer: listening on port %d', config.port));
  });
}

function End(res, http_code, message) {
  res.writeHead(http_code, {'content-type': 'text/plain'});
  res.end(message);
}

function ProcessFileUpload(email, remote_ip, upload_metadata) {
  var metadata = util.extract(upload_metadata,
                              ['size', 'path', 'hash', 'name', 'type']);
  metadata.email = email;
  metadata.remote_ip = remote_ip;
  metadata.received = new Date();

  db.QueueForProcessing('uploads', metadata, function(err, metadata) {
    if (err) {
      log.error('WebServer: QueueForProcessing failed:', err);
      return;
    }
    log.info('WebServer: queued uploaded file:', metadata.path);
  });
}

if (require.main === module) main();