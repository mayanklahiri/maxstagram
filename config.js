module.exports = {
  // Run in TEST mode (overridden by command line flags)
  test: false,

  // Directories used by the webserver, relative to package root.
  //
  // webroot: Contains static files that are served
  // uploads: Staging area for user-uploaded files.
  //          Should not be accessible from webroot for security.
  // base:    Base directory for images ingested into the processing pipeline.
  // derived: Output directory for filtered images.
  // max_upload_size: Maximum file upload size in bytes.
  dir_uploads: 'uploads',
  dir_templates: 'templates',
  dir_webroot: 'webroot',
  dir_base: 'webroot/base',
  dir_derived: 'webroot/derived',
  max_upload_size: 1024 * 1024 * 14,   // 14 MB

  // Serve the log stream at a particular URL, or null to disable serving
  // the logs over HTTP.
  logs_url: '/logz',

  // Mailgun e-mail delivery settings, using an account at http://mailgun.com.
  //
  // mailgun_key_file: Paste your Mailgun API key into this
  //                   file in the package root.
  // domain: Emails will be sent from noreply@ this domain.
  mailgun_key_file: 'MAILGUN_KEY',
  domain: 'maxstagram.com',

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
  //
  // Image dimensions. All ingested images are resized to maximum dimension
  // 'largest' before being processed.
  img_dims: {
    largest: 1920,
    large: 1280,
    medium: 720,
    square: 240,
  },

  // Number of images to derive for each image processing round.
  img_derivations_per_round: 50,

  // Minimum and maximum number of effects operations that
  // will be blended together to generate the final image.
  img_min_fx_ops: 2,
  img_max_fx_ops: 8,
};
