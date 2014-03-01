var db = require('../db')
  , path = require('path')
  , util = require('../util')
  , im = require('imagemagick')
  , async = require('async')
  , config = JSON.parse(process.env.config)
  , log = util.log
  ;

var TIMEOUT = 20000;

function main() {
  db.init(config, function(err) {
    if (err) process.exit(-1);
    db.PullForProcessing('uploads', TIMEOUT, function (err, doc) {
      if (err || !doc) return process.exit(-2);
      IngestUpload(doc, function(err) {
        if (err) log.error('IngestUpload', err);
        process.exit(3);
      });
    });
  });
  setTimeout(process.exit, TIMEOUT);
}

function IngestUpload(upload_obj, cb) {
  var metadata = util.extract(upload_obj,
                              ['hash', 'name', 'size', 'path']);
  var in_file = metadata.path;
  var out_file_base = path.join(config.dir_base, metadata.hash);
  log.info(util.format('IngestUpload: pulled in=%s out_base=%s',
                       path.basename(in_file),
                       path.basename(out_file_base)));

  // Assemble execution sequence: resize image into configured sizes
  var exec_seq = [];
  for (var dim_label in config.img_dims)
    exec_seq.push((function(dim_label, max_dim) {
      return function(next) {
        im.convert([
          in_file,
          '-strip',
          '-quality',
          '85',
          '-resize',
          util.format('%dx%d>', max_dim, max_dim),
          out_file_base + util.format('-%s.jpg', dim_label),
        ], function (err, stdout) {
          if (err) log.info('IngestUpload: err=' + err, stdout);
          next(err);
        });

      };
    })(dim_label, config.img_dims[dim_label]));

  // Execution sequence: create metadata object in the 'base' collection
  exec_seq.push(function(next) {
    db.QueueForProcessing('base', {
      email: upload_obj.email,
      received: upload_obj.received,
      hash: metadata.hash,
      name: metadata.name,
      num_to_derive: config.img_derivations_per_round,
    }, next);
  });

  // Execution sequence: mark upload as ingested
  exec_seq.push(function(next) {
    log.info(util.format('IngestUpload: marking %s as ingested', metadata.hash));
    db.MarkAsProcessed('uploads', {hash: metadata.hash}, next);
  });

  async.series(exec_seq, cb);
}

if (require.main === module) main();