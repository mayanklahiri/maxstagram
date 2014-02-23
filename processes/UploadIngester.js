var db = require('../db')
  , path = require('path')
  , util = require('../util')
  , async = require('async')
  , config = JSON.parse(process.env.config)
  , log = util.log
  , ResizeImage = require('../engine/ResizeImage')
  ;

var TIMEOUT = 20000;
var MAX_IMG_DIM = 2500;

function main() {
  db.init(config, function(err) {
    if (err) process.exit(-1);
    db.PullForProcessing('uploads', TIMEOUT, function (err, doc) {
      if (err || !doc)
        process.exit(-2);
      IngestUpload(doc, process.exit);
    });    
  });
  setTimeout(process.exit, TIMEOUT);
}  

function IngestUpload(upload_obj, cb) {
  var metadata = util.extract(upload_obj,
                              ['hash', 'name', 'size', 'path', '_reprocess_after']);
  var base_file = path.join(config.dir_base, metadata.hash);
  cb();
}

if (require.main === module) main();