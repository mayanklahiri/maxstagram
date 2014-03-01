var fs = require('fs')
  , jade = require('jade')
  , path = require('path')
  , db = require('../db')
  , util = require('../util')
  , config = JSON.parse(process.env.config)
  , log = util.log
  , Mailgun = require('mailgun').Mailgun
  ;

var TIMEOUT = 5 * 1000;  // 20 seconds

function main() {
  db.init(config, function(err) {
    if (err) process.exit(-1);
    db.PullForProcessing('notifications', TIMEOUT, function (err, doc) {
      if (err || !doc) return process.exit(-2);
      SendNotification(doc, function(err) {
        if (err) log.error('SendNotification', err);
        process.exit(3);
      });
    });
  });
  setTimeout(process.exit, TIMEOUT);
}

function SendNotification(notification_obj, cb) {
  log.info(util.format('SendNotification: pulled hash=%s type=%s email=%s',
  					   notification_obj.base_hash,
  					   notification_obj.type,
  					   notification_obj.email));

  // Assuming type == 'new_images_available'  
  db.Model('derived')
  .find({base_hash: notification_obj.base_hash})
  .sort('-generated')
  .limit(config.img_derivations_per_round)
  .exec(function (err, docs) {
  	if (err) return cb(err, docs);

  	// Change paths to relative
  	for (var i = 0; i < docs.length; i++) {
      var img_path = docs[i].path;
  	  docs[i].path = config.domain + 
  	                 'derived/' + 
  	                 path.basename(img_path) + 
  	                 '-thumb.jpg';
      docs[i].link = config.domain + 
                     'derived/' + 
                     path.basename(img_path) +
                     '-largest.jpg';
  	}

  	// Read and render template
  	var template = fs.readFileSync('notification.jade', 'utf8');
  	var html = jade.render(template, {
  	  pretty: true,
      docs: docs,
  	  notification: notification_obj,
  	});

  	// Send email
  	var mailgun_key = fs.readFileSync('MAILGUN_KEY', 'utf8').replace(/\s*$/, '');
  	var mg = new Mailgun(mailgun_key);
  	var body = ['To: ' + notification_obj.email,
                'Subject: New images available',
                'Content-Type: text/html;',
                '',
                html,
               ].join('\n');
  	mg.sendRaw('"Maxstagram Notification" <noreply@twodeg.mailgun.org>',
  	           [notification_obj.email],
  	           body,
  	           function (err) {
  	             log.info(util.format('SendNotification: mailgun send_to %s: err=%s',
  	                                  notification_obj.email,
  	                                  err));
                 if (!err) {
                   db.MarkAsProcessed('notifications', notification_obj, cb);
                 } else {
                   cb(err);
                 }
  	           });
  });
}

if (require.main === module) main();
