/**
 * @file willie-photos - Scanner handler to compute an image's dominant color
 */
// (C) Alexandre Morin 2016

const moment = require('moment');
const extend = require('extend');

const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const Utils = require('wg-utils');
const Thumbs = require('wg-thumbs');

const log = Log.getLogger('willie-photos::scanners::dominantColor');



/**
 * Creates the handler. Keep a reference to the (reverse) scanner that will use this handler
 * @param {ReverseScanner} reverseScanner - the scanner
 */
DominantColorHandler = function(reverseScanner, scanOptions) {
  this.reverseScanner = reverseScanner;
}

/**
 * Handlers are given a name for logging purposes
 * @return {string} the handler name
 */
DominantColorHandler.prototype.getName = function() { return "photos:DominantColorHandler"; };



/**
 * Process next fingerprint. Handlers will be called for each fingerprint.
 * The DominantColorHandler will compute the fingerprint's dominant color
 *
 * @param {Fingerprint} fingerprint - is the fingerprint to process
 * @param stats - is the corresponding information of the file on the file system.
 *                It can be null or undefined if the file was removed from the file system
 * @param {boolean} isInScope - is a boolean indicating if the file is within the scope
 *                              or the current scan or not
 * @param scanOptions - is the scan options (as passed to the scan function)
 * @return {boolean} indicating the the handler processed the file or not. Used to compute scan statistics
 */
DominantColorHandler.prototype.processNext = function(fingerprint, stats, isInScope, scanOptions, callback) {
  var that = this;
  if (!isInScope) return callback();
  if (stats === null || stats === undefined) return callback();
  var force = scanOptions.force;
  var found = fingerprint.image;
  var reasons = [];
  if (found === null || found === undefined) reasons.push("Image record not found");
  if (found && found.version < 3) reasons.push("Image record version too old (" + found.version + ")");
  if (found && (moment(found.mtime) === null || moment(found.mtime) === undefined)) reasons.push("No mtime in image record");
  if (found && found.mtime && stats.mtime && found.mtime<stats.mtime) reasons.push("File changed");
  if (force) reasons.push("Force mode");
  var shouldStore = reasons.length > 0;
  log.debug({ fingerprint:fingerprint.longFilename, image:found, stats:stats, shouldStore:shouldStore, reasons:reasons }, "Dominant Color Handler processing next file");
  if (!shouldStore) return callback();
  return that._extractDominantColor(fingerprint, reasons, function(err) {
    if (err) return callback(err);
    return callback(null, true);
  });
}

DominantColorHandler.prototype._extractDominantColor = function(fingerprint, reasons, callback) {
  var that = this;
  log.info({ fingerprint:fingerprint.longFilename, reasons:reasons }, "Extracting dominant color");
  return Thumbs.dominantColor(fingerprint.longFilename, function(err, color) {
    if (err) return callback(err);
    if (color) {
      color = "#" + Utils.hex8(color[0])
                  + Utils.hex8(color[1])
                  + Utils.hex8(color[2]);
    }
    else
      color = "";
    log.debug("Color", err, color);
    var image = {
      uuid:           fingerprint.uuid,
      version:        3,
      dominantColor:  color
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
module.exports = DominantColorHandler;

