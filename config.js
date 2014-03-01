module.exports = {
  // The domain name that is used to link thumbnails when
  // sending email notifications. NOTE: Ensure that there is
  // a trailing slash.
  domain: 'http://maxstagram.com/',

  // Directories used by the webserver, relative to package root.
  //
  // webroot: Contains static files that are served
  // uploads: Staging area for user-uploaded files.
  //          Should NOT be accessible from webroot.
  // base:    Base directory for images ingested into the processing pipeline.
  // derived: Output directory for filtered images.
  dir_webroot: 'frontend',
  dir_uploads: 'uploads',
  dir_base: 'frontend/base',
  dir_derived: 'frontend/derived',

  // Mailgun settings
  // 
  // mailgun_key_file: Paste your Mailgun API key into this
  //                   file in the package root.
  // send_email_from:  Address to send notification emails from.
  mailgun_key_file: 'MAILGUN_KEY',
  send_email_from: 'noreply@twodeg.mailgun.org',

  // MongoDB server to be used for indexing and queue processing.
  mongodb_server: 'mongodb://localhost/maxstagram',

  // Image dimensions. All ingested images are resized to maximum dimension
  // 'largest' before being processed.
  img_dims: {
    largest: 3000,
    large: 1280,
    medium: 720,
    thumb: 240,
  },

  // Number of images to derive before sending an email notification.
  img_derivations_per_round: 50,

  // Image processing: minimum and maximum number of effects layers that
  // will be blended together to generate the final image.
  img_min_fx_layers: 2,
  img_max_fx_layers: 10,
};
