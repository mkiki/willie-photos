/**
 * @file willie-photos - Scanner handler to generate image thumbnails
 */
// (C) Alexandre Morin 2016

const fs = require('fs');
const fse = require('fs-extra');

const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const Thumbs = require('wg-thumbs');

const photoUtils = require('../photo-utils.js');

const log = Log.getLogger('willie-photos::scanners::thumbnails');


/**
 * Creates the handler. Keep a reference to the (reverse) scanner that will use this handler
 * @param {ReverseScanner} reverseScanner - the scanner
 */
ThumbnailsHandler = function(reverseScanner, scanOptions) {
  this.reverseScanner = reverseScanner;
}

/**
 * Handlers are given a name for logging purposes
 * @return {string} the handler name
 */
ThumbnailsHandler.prototype.getName = function() { return "photos:ThumbnailsHandler"; };



// Returns the workind directory where thumnails will be generated
// Structure of this directory is as follows
//    base/flavor/sub1/sub2/
// 
// - 'base' directory is set by configuration file (parameter 'thumbsDir')
// - 'flavor' is the thumbs flavor, such as "200", or "800x600"
// - 'sub1' and 'sub2' are subdirectories levels are created based on the image UUID
//      Example: for UUID 2e61cd59-1d64-4a4c-a344-b88e9ed6bc41, we'll use 1d64/4a4c for subdirectories
ThumbnailsHandler.prototype._getThumbsDir = function(scanOptions, flavor, uuid) {
  var subdir1 = uuid.substr(9, 4);
  var subdir2 = uuid.substr(14, 4);
  var base = scanOptions.thumbsDir;
  var dir = base + "/" + flavor + "/" + subdir1 + "/" + subdir2;
  return dir;
}


/**
 * Process next fingerprint. Handlers will be called for each fingerprint.
 * The ThumbnailsHandler will generate thumbnail images for the scanned fingerprint
 *
 * @param {Fingerprint} fingerprint - is the fingerprint to process
 * @param stats - is the corresponding information of the file on the file system.
 *                It can be null or undefined if the file was removed from the file system
 * @param {boolean} isInScope - is a boolean indicating if the file is within the scope
 *                              or the current scan or not
 * @param scanOptions - is the scan options (as passed to the scan function)
 * @return {boolean} indicating the the handler processed the file or not. Used to compute scan statistics
 */
ThumbnailsHandler.prototype.processNext = function(fingerprint, stats, isInScope, scanOptions, callback) {
  var that = this;
  if (!isInScope) return callback();
  if (stats === null || stats === undefined) return callback();
  // check image size : do not bother geenrate thumbs for small images
  if (fingerprint.image.width && fingerprint.image.height) {
    if (fingerprint.image.width < scanOptions.minImageWidth || fingerprint.image.height < scanOptions.minImageHeight) return callback();
  }
  var thumbs = scanOptions.thumbs.slice(0); 
  return that._generateNextThumbs(fingerprint, stats, scanOptions, thumbs, false, function(err, processed) {
    if (err) return callback(err);
    return callback(null, processed);
  });

}

ThumbnailsHandler.prototype._generateNextThumbs = function(fingerprint, stats, scanOptions, thumbs, processed, callback) {
  var that = this;
  if (thumbs.length === 0) return callback();
  var thumb = thumbs.shift();
  return that._generateThumb(fingerprint, stats, scanOptions, thumb, function(err, processed) {
    if (err) return callback(err);
    return that._generateNextThumbs(fingerprint, stats, scanOptions, thumbs, processed, function(err, wasProcessed) {
      processed = processed |= wasProcessed;
      return callback(err, processed);
    });
  });
};

// @param fingerprint is the fingerprint (in database) being reverse-scanned
// @param stats is the fs.Stats object for the original file corresponding to the fingerprint
// @param thumb is the thumbnail definition to generate
// @param callback is the return function
ThumbnailsHandler.prototype._generateThumb = function(fingerprint, stats, scanOptions, thumb, callback) {
  var that = this;
  var size = thumb.size;
  var uuid = fingerprint.uuid;
  var flavor = (thumb.size === undefined) ? (""+thumb.width+"x"+thumb.height) : (""+thumb.size);
  var dir = that._getThumbsDir(scanOptions, flavor, uuid);
  var source = fingerprint.longFilename;
  var destination = photoUtils.getThumbsFile(scanOptions.thumbsDir, flavor, uuid);

  return fs.lstat(destination, function(err, statsThumb) {
    if (err || statsThumb === null || statsThumb === undefined) { // Could not stat thumb => regenerates (probably did not exist)
      return fse.mkdirs(dir, function(err) {
        if (err) return callback(err);
        var reasons = [];
        if (statsThumb === null || statsThumb === undefined) reasons.push("No stats for thumb");
        return that._regenerateThumb(fingerprint, source, destination, thumb, reasons, function(err, processed) {
          return callback(err, processed);
        });
      });
    }
    // If image changed since thumb was generated, then regenerate
    if (scanOptions.force || statsThumb.mtime < stats.mtime) {
      var reasons = [];
      if (scanOptions.force) reasons.push("Force mode");
      if (statsThumb.mtime < stats.mtime) reasons.push("Thumbnail older than file " + statsThumb.mtime + " < " + stats.mtime);
      return that._regenerateThumb(fingerprint, source, destination, thumb, reasons, function(err, processed) {
        return callback(err, processed);
      });
    }
    return callback();
  });
};

ThumbnailsHandler.prototype._regenerateThumb = function(fingerprint, source, destination, thumb, reasons, callback) {
  var that = this;
  if (thumb.size !== undefined) {
    log.info({ source:source, thumb:thumb, reasons:reasons, destination:destination }, "Generating thumbnail");
    return Thumbs.generateThumbnail(source, destination, thumb, function(err) {
      if (err) return callback(err);
      return callback(null, true);
    });
  }
  else if (thumb.exact === true) {
    log.info({ source:source, thumb:thumb, reasons:reasons, destination:destination }, "Generating exact scaled image");
    return Thumbs.generateThumbnail(source, destination, thumb, function(err) {
      if (err) return callback(err);
      return callback(null, true);
    });
  }
  else {
    log.info({ source:source, thumb:thumb, reasons:reasons, destination:destination }, "Generating scaled image");
    return Thumbs.generateScaled(source, destination, thumb, function(err) {
      if (err) return callback(err);
      return callback(null, true);
    });
  }
};

/**
 * Public interface
 * @ignore
 */
module.exports = ThumbnailsHandler;

