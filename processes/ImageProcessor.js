// The Maxstagram image processing engine.
var util = require('../util')
  , image = require('../image')
  , db = require('../db')
  , os = require('os')
  , fs = require('fs')
  , path = require('path')
  , async = require('async')
  , config = JSON.parse(process.env.config)
  ;

var TIMEOUT = 1000 * 60; // 60 seconds

function main() {
  db.Queue.ProcessQueueItem('base', ProcessImage, TIMEOUT);
}

function ProcessImage(base_obj, cb) {
  var metadata = util.extract(base_obj,
      ['hash', 'name', 'size', 'path', 'remote_ip', 'email', 'received', 'num_to_derive']);
  util.log.info('ImageProcessor: pulled queue item', metadata);

  // Figure out filenames for processing
  var in_file = null;
  for (var i = 0; i < base_obj.output_files.length; i++)
    if (base_obj.output_files[i].match(/-largest.jpg/)) {
      in_file = base_obj.output_files[i];
      break;
    }
  if (!in_file) return cb('Item did not have a -largest.jpg output file');
  var tmp_file_base = util.format('%s-%d',
                                  path.join(os.tmpdir(), base_obj.hash),
                                  process.pid);
  var fx_file = tmp_file_base + '-fx.jpg';
  var out_file_base = util.format('%s-%s',
                                  path.join(config.dir_derived, base_obj.hash),
                                  Math.floor(Math.random()*10e9).toString(16));
  var out_file = out_file_base + '.jpg';
  var derived = {};
  var started = new Date();

  // Assemble execution sequence: generate effects layer
  var exec_seq = [];
  exec_seq.push(function(next) {
    var num_ops = util.randint(config.img_max_fx_ops-config.img_min_fx_ops) +
                  config.img_min_fx_ops;
    derived.fx_params = image.GenerateEffectsLayer(num_ops);
    image.Process(in_file, fx_file, derived.fx_params, next);
  });

  // Assemble execution sequence: blend effects layer
  exec_seq.push(function(next) {
    derived.blend_params = image.GenerateBlendLayer(fx_file);
    image.Process(in_file, out_file, derived.blend_params, next);
  });

  // Execution sequence: generate resized versions
  exec_seq.push(function(next) {
    image.MultiResize(out_file, out_file_base, config.img_dims, '85', next);
  });

  // Execution sequence: generate entry in 'derived' table
  exec_seq.push(function(next) {
  	derived.base_hash = base_obj.hash;
  	derived.output = out_file;
  	derived.generated = new Date().getTime();
    derived.walltime_sec = (new Date() - started) / 1000;
  	db.Insert('derived', derived, next);
  });

  // Execution sequence: update num_to_derive count
  exec_seq.push(function(next) {
    var query = {_id: base_obj._id};
    if (base_obj.num_to_derive <= 0) {
      // No more derivations for this round.
      delete metadata._id;
      util.log.info('ImageProcessor: marking as processed', metadata);
      return db.Queue.MarkAsProcessed('base', query, function (err) {
        if (err) return next(err);
        // Queue notification to sender
        var notification = {
          email: base_obj.email,
          base_hash: base_obj.hash,
          type: 'new_images_available',
        };
        delete metadata._id;
        util.log.info('ImageProcessor: queueing notification', metadata);
        db.Queue.QueueForProcessing('notifications', notification, next);
      });
    }

    delete metadata._id;
    util.log.info('ImageProcessor: decreasing num_to_derive', metadata);
    db.Update('base', query, {'$inc': {num_to_derive: -1}, '$set': {_reprocess_after: new Date().getTime()}}, next);
  });

  // Execution sequence: print a logline
  exec_seq.push(function(next) {
    delete derived._id;
  	util.log.info('ImageProcessor: finished image', derived);
  	next();
  })

  async.series(exec_seq, cb);
}

if (require.main === module) util.init(config, main);
