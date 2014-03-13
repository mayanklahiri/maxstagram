var path = require('path')
  , util = require('../util')
  , db = require('../db')
  , image = require('../image')
  , async = require('async')
  , config = JSON.parse(process.env.config)
  ;

var TIMEOUT = 1000 * 60; // 60 seconds

function main() {
  db.Queue.ProcessQueueItem('uploads', IngestUpload, TIMEOUT);
}

function IngestUpload(upload_obj, cb) {
  var metadata = util.extract(upload_obj, ['hash', 'name', 'size', 'path', 'remote_ip', 'email', 'received']);
  metadata.secret = Math.floor((Math.random()*10e9)).toString(16);
  var id = util.extract(upload_obj, ['_id']);
  var in_file = metadata.path;
  var out_file_base = path.join(config.dir_base, metadata.hash);
  util.log.info(util.format('IngestUpload: pulled queue item of size %dkb',
                            Math.floor(metadata.size/1024)),
                metadata);

  // Assemble execution sequence: resize image into configured sizes
  var exec_seq = [];
  exec_seq.push(function(next) {
    // High-resolution crops for base
    image.MultiResize(in_file, out_file_base, config.img_dims, '95', function (err, output_files) {
      metadata.output_files = output_files;
      next();
    });
  });

  // Execution sequence: create metadata object in the 'base' collection
  exec_seq.push(function(next) {
    metadata.num_to_derive = config.img_derivations_per_round;
    db.Queue.QueueForProcessing('base', metadata, next);
  });

  // Execution sequence: mark upload as ingested
  exec_seq.push(function(next) {
    delete metadata._id;
    util.log.info(util.format('IngestUpload: ingested upload of size %dkb',
                              Math.floor(metadata.size/1024)),
                  metadata);
    db.Queue.MarkAsProcessed('uploads', id, next);
  });

  async.series(exec_seq, cb);
}

if (require.main === module) util.init(config, main);
