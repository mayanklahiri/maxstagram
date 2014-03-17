module.exports = {
  // Run in TEST mode (overridden by command line flags)
  test: true,

  // Asynchronous task processor settings
  max_task_failures: 10,

  // Directories used by the webserver, relative to package root.
  //
  // webroot: Contains static files that are served
  // uploads: Staging area for user-uploaded files.
  //          Should not be accessible from webroot for security.
  // base:    Base directory for images ingested into the processing pipeline.
  // derived: Output directory for filtered images.
  // max_upload_size: Maximum file upload size in bytes.
  // data_api: Expose a JSON data API at /data
  dir_uploads: 'uploads',
  dir_templates: 'templates',
  dir_webroot: 'webroot',
  dir_base: 'webroot/base',
  dir_derived: 'webroot/derived',
  max_upload_size: 1024 * 1024 * 14,   // 14 MB
  data_api: true,

  // Special purpose URLs to serve
  logs_url: '/logz',      // Log tailer

  // Mailgun e-mail delivery settings, using an account at http://mailgun.com.
  //
  // mailgun_key_file: Paste your Mailgun API key into this
  //                   file in the package root.
  // domain: Emails will be sent from noreply@ this domain.
  // send_emails: Should email notifications be sent?
  mailgun_key_file: 'MAILGUN_KEY',
  domain: 'maxstagram.com',
  domain_test: 'localhost:8080',
  email_from: '"Maxstagram Notification" <noreply@maxstagram.com>',
  send_email: true,
  send_email_test: false,

  // MongoDB server URI to be used for indexing, logs, and queue processing.
  //mongodb_server: 'mongodb://localhost/maxstagram',
  //mongodb_server_test: 'mongodb://localhost/maxstagram_test',
  mongodb: {
    db: 'maxstagram',
    host: 'localhost',
  },
  mongodb_test: {
    db: 'maxstagram_test',
    host: 'localhost',
  },


  // Image processing settings.

  // If specified, path to ImageMagick 'convert' and 'identify' programs
  // If not specified, looks in system path.
  convert_path: 'bin/convert',
  identify_path: 'bin/identify',

  // Image dimensions. All ingested images are resized to maximum dimension
  // 'largest' before being processed.
  img_dims: {
    largest: 2400,
    large: 1280,
    medium: 720,
    square: 240,
  },

  // Number of images to derive for each image processing round.
  img_derivations_per_round: 40,
  img_derivations_per_round_test: 3,

  // Minimum and maximum number of effects operations that
  // will be blended together to generate the final image.
  img_min_fx_ops: 2,
  img_max_fx_ops: 12,
};
