/**
 * @file willie-photos - Scanner handler to compute image's EXIF information
 */
// (C) Alexandre Morin 2016

const moment = require('moment');
const extend = require('extend');

const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const Exif = require('wg-exif');

const log = Log.getLogger('willie-photos::scanners::exif');



/**
 * Creates the handler. Keep a reference to the (reverse) scanner that will use this handler
 * @param {ReverseScanner} reverseScanner - the scanner
 */
EXIFHandler = function(reverseScanner, scanOptions) {
  this.reverseScanner = reverseScanner;
}

/**
 * Handlers are given a name for logging purposes
 * @return {string} the handler name
 */
EXIFHandler.prototype.getName = function() { return "photos:EXIFHandler"; };



/**
 * Process next fingerprint. Handlers will be called for each fingerprint.
 * The EXIFHandler will extract EXIF information from an image and store it
 *
 * @param {Fingerprint} fingerprint - is the fingerprint to process
 * @param stats - is the corresponding information of the file on the file system.
 *                It can be null or undefined if the file was removed from the file system
 * @param {boolean} isInScope - is a boolean indicating if the file is within the scope
 *                              or the current scan or not
 * @param scanOptions - is the scan options (as passed to the scan function)
 * @return {boolean} indicating the the handler processed the file or not. Used to compute scan statistics
 */
EXIFHandler.prototype.processNext = function(fingerprint, stats, isInScope, scanOptions, callback) {
  var that = this;
  if (!isInScope) return callback();
  if (stats === null || stats === undefined) return callback();
  var force = scanOptions.force;
  var found = fingerprint.image;
  var reasons = [];
  if (found === null || found === undefined) reasons.push("Image record not found");
  if (found && found.version < 2) reasons.push("Image record version too old (" + found.version + ")");
  if (found && (moment(found.mtime) === null || moment(found.mtime) === undefined)) reasons.push("No mtime in image record");
  if (found && found.mtime && stats.mtime && found.mtime<stats.mtime) reasons.push("File changed");
  if (force) reasons.push("Force mode");
  var shouldStore = reasons.length > 0;
  log.debug({ fingerprint:fingerprint.longFilename, image:found, stats:stats, shouldStore:shouldStore, reasons:reasons }, "EXIF handler processing next file");
  if (!shouldStore) return callback();
  return that._extractEXIF(fingerprint, reasons, function(err) {
    if (err) return callback(err);
    return callback(null, true);
  });
}

EXIFHandler.prototype._extractEXIF = function(fingerprint, reasons, callback) {
  var that = this;
  log.info({ fingerprint:fingerprint.longFilename, reasons:reasons }, "Extracting exif information");
  return Exif.extractEXIF(fingerprint.longFilename, { }, function(err, exif) {
    log.debug("EXIF", err, exif);
    if (err) return callback(err);
    var image = {
      uuid:         fingerprint.uuid,
      version:      2,
      dateTime:     exif.dateTime,
      mtime:        fingerprint.mtime,
      width:        exif.width,
      height:       exif.height,
      resolution:   exif.resolution,
      orientation:  exif.orientation,
      make:         exif.make,
      model:        exif.model,
      focalLength:  exif.focalLength,
      exposureTime: exif.exposureTime,
      fnumber:      exif.fnumber,
      hdr:          exif.hdr,
      latitude:     exif.latitude,
      longitude:    exif.longitude,
      altitude:     exif.altitude,
      scanError:    false,
    };
    return that.reverseScanner.getStorageDelegate().storeImage(image, function(err) {
      if (err) return callback(err);
      fingerprint.image = extend(fingerprint.image, image);
      return callback(err);
    });
  });
}


/**
 * Public interface
 * @ignore
 */
module.exports = EXIFHandler;

