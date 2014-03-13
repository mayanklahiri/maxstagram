var fs = require('fs')
  , path = require('path')
  , db = require('../db')
  , util = require('../util')
  , config = JSON.parse(process.env.config)
  , Mailgun = require('mailgun').Mailgun
  ;

var TIMEOUT = 1000 * 10; // 10 seconds

function main() {
  db.Queue.ProcessQueueItem('notifications', SendNotification, TIMEOUT);
}

function SendNotification(notification_obj, cb) {
  var log = util.log;
  var domain = config.domain;
  if (domain[domain.length-1] !== '/')
    domain += '/';

  log.info('SendNotification: sending to ' + notification_obj.email,
           util.extract(notification_obj, ['email', 'base_hash', 'type']));

  // Assuming type == 'new_images_available'
  var query = {base_hash: notification_obj.base_hash};
  db.Query('derived', query, [['generated', -1]], config.img_derivations_per_round, function (err, docs) {
    if (err || !docs || !docs.length) return cb(err, docs);
    // Change paths to relative
    for (var i = 0; i < docs.length; i++) {
      var img_path = docs[i].output;
      docs[i].path = domain +
                     'derived/' +
                     path.basename(img_path, '.jpg') +
                     '-square.jpg';
      docs[i].link = domain +
                     'derived/' +
                     path.basename(img_path, '.jpg') +
                     '-largest.jpg';
    }

    // Render message template
    var html = util.template('notification.jade', {
      docs: docs,
      notification: notification_obj,
    });

    // Send email
    var mailgun_key = fs.readFileSync(config.mailgun_key_file, 'utf8').replace(/\s*$/, '');
    var mg = new Mailgun(mailgun_key);
    var body = ['To: ' + notification_obj.email,
                'Subject: New images available',
                'Content-Type: text/html;',
                '',
                html,
               ].join('\n');
    mg.sendRaw('"Maxstagram Notification" <noreply@'+domain+'>',
               [notification_obj.email],
               body,
               function (err) {
                 if (!err) {
                   log.info(util.format('SendNotification: sent to %s', notification_obj.email));
                   db.Queue.MarkAsProcessed('notifications', notification_obj, cb);
                 } else {
                   log.error(util.format('SendNotification: error sending to %s', notification_obj.email),
                             {err: err});
                   cb(err);
                 }
               });
  });
}

if (require.main === module) util.init(config, main);
