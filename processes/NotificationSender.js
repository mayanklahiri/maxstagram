var fs = require('fs')
  , async = require('async')
  , init = require('../init')
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
  var log = init.log;
  log.info('SendNotification: pulled notification to ' + notification_obj.email,
           util.logsafe(notification_obj));
  var query = {base_hash: notification_obj.base_hash};
  var domain = config.domain;
  if (domain[domain.length-1] == '/')
    domain = domain.substr(0, domain.length-1);

  // Assuming type == 'new_images_available'
  async.waterfall([
    _QueryLatestDerivedImages,
    _GenerateNotificationBody,
    _SendEmail,
    _MarkAsProcessed,
  ], cb);

  function _QueryLatestDerivedImages(next) {
    db.Query(
        'derived',                          // table
        query,                              // base_hash
        [['generated', -1]],                // most recently generated first
        config.img_derivations_per_round,   // limit
        next);
  }

  function _GenerateNotificationBody(docs, next) {
    if (!docs) docs = [];
    if (!docs.length)
      return next('Unable to retrieve any derived images.', notification_obj);
    for (var i = 0; i < docs.length; i++) {
      var base_hash = docs[i].base_hash;
      var gen_id = docs[i].gen_id;
      docs[i].thumbnail = domain +
                          '/derived/' +
                          base_hash + '-' + gen_id +
                          '-square.jpg';
      docs[i].link = domain +
                     '/see.html?img=' + base_hash + '-' + gen_id +
                     '-largest.jpg';
    }
    var html = util.template('notification.jade', {
      docs: docs,
      notification: notification_obj,
    });
    next(null, html, docs);
  }

  function _SendEmail(html, docs, next) {
    if (config.send_email !== true) {
      log.info('SendNotification send_email is FALSE, not sending email.', {
        docs: docs.map(function(obj) {return util.extract(obj, ['thumbnail', 'link'])}, docs),
      });
      return next();
    }
    if (!config.email_from) return next();
    log.info('SendNotification: sending to ' + notification_obj.email);
    var mailgun_key = fs.readFileSync(config.mailgun_key_file, 'utf8').replace(/\s*$/, '');
    var mg = new Mailgun(mailgun_key);
    var body = ['To: ' + notification_obj.email,
                'Subject: New images available for "' + notification_obj.name + '"',
                'Content-Type: text/html;',
                '',
                html,
               ].join('\n');
    mg.sendRaw(config.email_from,
               [notification_obj.email],
               body,
               function (err, detail) {
      if (err) log.error(__where+'Mailgun error', {err: err, detail: detail});
      util.checkErrorAndReturn(err, __where, 'Mailgun.sendRaw failed', next);
    });
  }

  function _MarkAsProcessed(next) {
    log.info('SendNotification: marking as done', util.logsafe(query));
    db.Queue.MarkAsProcessed('notifications', query, function (err, new_doc) {
      log.info('MarkAsProcessed on notifications returned', new_doc);
      next(err, new_doc);
    });
  }
}

if (require.main === module) init.Init(null, main);
