// Webserver process
var init = require('../init')
  , util = require('../util')
  , os = require('os')
  , fs = require('fs')
  , db = require('../db')
  , express = require('express')
  , formidable = require('formidable')
  ;

function main(err) {
  if (err) throw err;
  var log = init.log;
  var config = init.config;

  // Create express app
  var app = express();

  // Compress HTTP responses
  app.use(express.compress())

  // Add data API
  if (config.data_api)
    app.use(DataAPI);

  // Add file upload handling
  config.dir_uploads = config.dir_uploads || os.tmpdir();
  app.use(HandleFileUpload);

  // Add log-tailing URL
  if (config.logs_url)
    app.use(ServeLogTail);

  // Add click recording for images
  app.use(RecordImageClicks);

  // Add static file serving from webroot
  if (config.dir_webroot)
    app.use(express.static(config.dir_webroot, {maxAge: 86400 * 1000}));

  // Add custom 404 at end of chain
  app.use(function (req, res, next) {
    End(res, 404, 'message.jade', {message: '404: Could not get URL'});
  });

  // Start listening on webserver port
  config.port = config.port || 8080;
  app.listen(config.port);
  log.info('WebServer: listening on port %d', config.port);

  // Helper functions below

  function End(res, http_code, template, locals) {
    var content = util.template(template, locals);
    res.writeHead(http_code, {'Content-Type': 'text/html'});
    res.end(content);
  }

  function JSONEnd(res, http_code, obj) {
    res.writeHead(http_code, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(obj, null, 2));
  }

  function DeleteUpload(files) {
    if (!files) return;
    for (var key in files)
      try {
        var upload_path = files[key].path;
        fs.unlinkSync(upload_path);
        log.info('WebServer: deleted upload', {
          path: upload_path,
          type: files[key].type,
          size: files[key].size,
        });
      } catch(e) {}
  }

  function HandleFileUpload(req, res, next) {
    if (req.url != '/upload' || req.method.toLowerCase() != 'post')
      return next();
    var form = new formidable.IncomingForm();
    form.maxFields = 30;
    form.hash = 'sha1';
    form.uploadDir = config.dir_uploads;
    form.parse(req, function(err, fields, files) {
      // Validate file upload
      if (err) {
        DeleteUpload(files);
        log.warning('WebServer: form parsing error', err);
        return End(res, 500, 'message.jade', {message: 'Upload processing error.'});
      }
      if (!files || !files.image || !files.image.size)  {
        DeleteUpload(files);
        return End(res, 400, 'message.jade', {message: 'No files found in your upload.'});
      }
      if (!fields.email) {
        DeleteUpload(files);
        return End(res, 400, 'message.jade', {message: 'Email address not specified.'});
      }
      if (!fields.email.match(/^\s*\S+\@\S+\s*$/)) {
        DeleteUpload(files);
        return End(res, 400, 'message.jade', {message: 'You did not specify a valid email address.'});
      }
      if (files.image.type != 'image/jpeg') {
        DeleteUpload(files);
        return End(res, 400, 'message.jade', {message: 'We only support JPEG images, sorry.'});
      }
      if (files.image.size <= 0) {
        DeleteUpload(files);
        return End(res, 400, 'message.jade', {message: 'The file you uploaded appears to be empty.'});
      }
      if (files.image.size > (config.max_upload_size || 1024*1024*14)) {
        DeleteUpload(files);
        return End(res, 400, 'message.jade', {
          message: util.format(
              'File too large. The maximum allowable image size is %d megabytes.',
              Math.floor((config.max_upload_size || 1024*1024*14)/(1024*1024))),
        });
      }

      // Create the queue item to push onto the UploadIngester processing queue
      var file_metadata_obj = util.extract(files.image, ['size', 'path', 'hash', 'name', 'type']);
      var queue_item_obj = util.mergeInto(file_metadata_obj, {
        name:      (fields.name || file_metadata_obj.name || '').replace(/[^a-zA-Z0-9 \',\.]/gi, ''),
        email:     (fields.email || '').replace(/\s+/gi, ''),
        remote_ip: req.connection.remoteAddress,
        received:  new Date().getTime(),
        hash:      util.randHex(16),  // treat each upload uniquely
      });

      db.Queue.QueueForProcessing('uploads', queue_item_obj, function(err, new_doc) {
        if (err) {
          log.error('WebServer: could not queue file upload', {doc: queue_item_obj, err: err});
          End(res, 500, 'message.jade', {message: 'Error processing upload.'});
        } else {
          log.info(util.format('WebServer: queued %s upload of size %dkb',
                               queue_item_obj.type,
                               Math.floor(queue_item_obj.size/1024)),
                   util.logsafe(new_doc));
          End(res, 200, 'message.jade', {message: 'Your image has been queued for processing.'});
        }
      });  // end db.Queue.QueueForProcessing
    });  // end form.parse
  }  // end HandleFileUpload

  function ServeLogTail(req, res, next)  {
    if (req.url != config.logs_url || req.method.toLowerCase() != 'get') return next();
    db.log_tail(function (err, log_tail) {
      if (err) return End(res, 500, 'Internal Error');
      End(res, 200, 'logs.jade', {logs: log_tail.reverse()});
    });
  }

  function DataAPI(req, res, next) {
    if (req.url.substr(0, 6) != '/data/' || req.method.toLowerCase() != 'get') return next();
    var parts = req.url.split('/');

    // GET /data/stream
    if (parts[2] === 'stream') {
      db.Query('derived',           // table
               {},                  // query
               [['_created', -1]],  // sort
               50,                  // limit
               function (err, docs) {
        if (docs && docs.length) {
          docs = docs.map(function(doc) { return util.extract(doc, ['name', 'base_hash', 'gen_id']) });
          var response = {
            docs: docs,
          }
          return JSONEnd(res, 200, response);
        }
      });
    }

    // GET /data/image/BASE_HASH/GEN_ID
    if (parts[2] === 'image' && parts.length == 5) {
      var base_hash = parts[3];
      var gen_id = parts[4];
      db.Query('derived',
               {base_hash: base_hash, gen_id: gen_id},
               [],
               1,
               function (err, doc) {
        if (doc && doc.length) {
          var response = util.extract(doc[0], ['name', 'fx_params', 'blend_params', 'walltime_sec']);
          response.generated = new Date(doc[0].generated);
          return JSONEnd(res, 200, response);
        }
        next();
      });
      return;
    }
    return next();
  }

  function RecordImageClicks(req, res, next) {
    if (req.url.match(/\/derived\/[0-9a-z]+\-[0-9a-z]+\-medium.jpg/)) {
      var url = req.url.replace(/\/derived\//, '').replace(/\-medium.jpg/, '');
      var parts = url.split('-');
      db.Insert('clicks', {
        base_hash: parts[0],
        gen_id: parts[1],
        timestamp: new Date(),
        ip: req.connection.remoteAddress,
      }, function() {});
    }
    next();
  }
}

if (require.main === module) init.Init(null, main);
