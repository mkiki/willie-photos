/**
 * willie-photos - Scanners - database delegates for storage and progress
 */
 // (C) Alexandre Morin 2015 - 2016

const uuid = require('uuid');

const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const utils = require('wg-utils');

const photodb = require('./database.js');

const coredb = require('willie-core').Database;

const log = Log.getLogger('photos:scanner-db');

/** ================================================================================
  * Storage delegate
  * ================================================================================ */

/**
 * Create the delegate
 */
function DatabaseStorageDelegate(db, userContext, joins) {
  this.db = db,
  this.userContext = userContext;
  this.joins = joins;
}

/**
 * Get a fingerprint from long term storage, by long file name.
 *
 * @param {string} longFilename - is the fully-qualified name of the file from the filesystem
 * @return {Fingerprint} the corresponding fingerprint or null/undefined if not found
 */
DatabaseStorageDelegate.prototype.getFingerPrint = function(longFilename, callback) {
  var that = this;
  var filters = [ "f.longFilename='" + utils.escapeForWhere(longFilename) + "'" ];
  return photodb.getFingerPrints(that.db, that.userContext, 0, 1, that.joins, filters, null, function(err, fingerprints) {
    return callback(err, fingerprints);
  });
}

/**
 * Get a the list of fingerprints for a folder, using pagination
 * @param {string} folder - is the fully-qualified name of the file system folder
 * @param {integer} offset - is the pagination offset (ie from where we start)
 * @param {integer} limit - is the pagination limit (ie tha maximum number of items returned)
 * @return {Fingerprint[]} the list of fingerprints for this folder, within the pagination limits
 *
 * Note that the function is expected to return all the requested fingerprints. If it returns less than
 * the expected (limit) number, then the scanners will consider that there are no more fingerprints
 * for the folder.
 */
DatabaseStorageDelegate.prototype.getFingerPrints = function(folder, offset, limit, callback) {
  var that = this;
  var filters = [ "f.longFilename LIKE '" + utils.escapeForLike(folder) + "%'" ];
  return photodb.getFingerPrints(that.db, that.userContext, offset, limit, that.joins, filters, "f.mtime DESC", function(err, fingerprints) {
    return callback(err, fingerprints);
  });
}

/**
 * Count the number of fingerprints for a folder, used to indicate progress
 *
 * @param {string} folder - is the fully-qualified name of the file system folder
 * @return {integer} the number of fingerprints
 */
DatabaseStorageDelegate.prototype.countFingerPrints = function(folder, callback) {
  var that = this;
  var filters = [ "f.longFilename LIKE '" + utils.escapeForLike(folder) + "%'" ];
  return photodb.countFingerPrints(that.db, that.userContext, filters, function(err, count) {
    return callback(err, count);
  });
}

/**
 * Updates a fingerprint in the long-term storage
 *
 * @param {Fingerprint} newFingerPrint - is the new fingerprint or a partial fingerprint (containing only fields to update).
 *                                       The fingerprint's uuid is used as a reconciliation key
 */
DatabaseStorageDelegate.prototype.updateFingerprint = function(newFingerPrint, callback) {
  var that = this;
  return photodb.updateFingerprint(that.db, that.userContext, newFingerPrint, function(err) {
    return callback(err);
  });
}

/**
 * Store a new fingerprint
 *
 * @param {Fingerprint} newFingerPrint - is the new fingerprint. The uuid is not expected to be set by the called, but
 *                                       will be determined by the long term storage
 */
DatabaseStorageDelegate.prototype.insertFingerprint = function(newFingerPrint, callback) {
  var that = this;
  return photodb.insertFingerprint(that.db, that.userContext, newFingerPrint, function(err) {
    return callback(err);
  });
}

/**
 * Preloads (for caching) a set of fingerprints
 * This functions is used for optimisation to prefetch fingerprints that are probably going to be needed
 * and therefore avoids unitary calls to the long term storage.
 *
 * @param {string} longFilename - is the fully-qualified name of the file from the filesystem to start from
 * @param {integer} count - the number of fingerprints to prefetch
 * @return {Fingerprint[]} a list of fingerprints
 *
 * Unlike the getFingerPrints call, the preLoadFingerprints does not have to return the exact number of 
 * requested fingerprint. If it doesn't, the scanner may not run as fast as possible.
 */
DatabaseStorageDelegate.prototype.preLoadFingerprints = function(longFilename, count, callback) {
  var that = this;
  return photodb.preLoadFingerprints(that.db, that.userContext, longFilename, count, function(err, fingerprints) {
    return callback(err, fingerprints);
  });
}

/**
 * Get the current date+time representation for the vanished attribute.
 * This cannot be computed by the scanner, because it is dependent of the long-term storage referential.
 * For instance, we'll use the "current_timestamp" of a database
 */
DatabaseStorageDelegate.prototype.getVanishedAt = function() {
  return function() { return "current_timestamp"; };
}



/** ================================================================================
  * Progress delegate
  * ================================================================================ */

/**
 * Create the delegate object to handle progress information
 */
DatabaseProgressDelegate = function(db, userContext) {
  this.db = db,
  this.userContext = userContext;
  this.jobUUID = uuid.v4();
  this.status = "Pending";
  this.progress = {
    forwardScan: {
      started: undefined,
      ended: undefined,
      scanned: 0,
      processed: 0,
      inserted: 0,
      updated: 0
    },
    reverseScan: {
      started: undefined,
      ended: undefined,
      fingerprints: 0,
      scanned: 0,
      processed: 0,
      errors: 0
    }
  }
  this.lastUpdated = undefined;
}

/**
 * Update the scan progress in the database
 */
DatabaseProgressDelegate.prototype._updateProgress = function() {
  var that = this;
  that.lastUpdated = new Date().getTime();
  return coredb.updateJobProgress(that.db, that.userContext, that.jobUUID, that.status, that.progress, function(err) {
    if (err)
      log.warn(new Exception({jobUUID:that.jobUUID}, "Failed to update scan job in database", err));
  });  
}

/**
 * Called when the scan starts
 *
 * @param {Scope} scope - is the scan scope (file(s) or folder(s))
 * @param {ReverseScanHandler[]} - is the list of handlers for this scan
 * @param scanOptions - is the scan options
 */
DatabaseProgressDelegate.prototype.scanStarted = function(scope, handlers, scanOptions) {
  var that = this;
  log.debug("Scan started");
  that.status = "In progress";
  var job = {
    id: that.jobUUID,
    name: "Scanning [" + scope.getName() + "]",
    context: {},
    type: "scan",
    status: that.status
  }
  return coredb.insertJob(that.db, that.userContext, job, function(err) {
    if (err)
      log.warn(new Exception({scope:scope}, "Failed to create scan job in database", err));
  });
}

/**
 * Called when the scan ends
 */
DatabaseProgressDelegate.prototype.scanEnded = function() {
  var that = this;
  log.debug("Scan ended");
  that.status = "Ended";
  that._updateProgress();
}

/**
 * Called when the forward scan starts
 */
DatabaseProgressDelegate.prototype.forwardScanStarted = function() {
  var that = this;
  log.debug("Forward scan started");
  that.status = "In progress (forward scan)";
  that.progress.forwardScan.started = new Date();
  that._updateProgress();
}

/**
 * Called when the forward scan processed a new file
 *
 * @param {number} scanned - the number of files scanned so far
 * @param {number} processed - the number of files processed so far
 * @param {number} inserted - the number of fingerprints inserted so far
 * @param {number} updated - the number of fingerprints updated so far
 */
DatabaseProgressDelegate.prototype.forwardScanProgress = function(scanned, processed, inserted, updated) {
  var that = this;
  log.debug({ scanned:scanned, processed:processed, inserted:inserted, updated:updated }, "Forward scan progress");
  that.progress.forwardScan.scanned = scanned;
  that.progress.forwardScan.processed = processed;
  that.progress.forwardScan.inserted = inserted;
  that.progress.forwardScan.updated = updated;
  if ((scanned % 1000) === 0) that._updateProgress();
}

/**
 * Called when the forward scan ends
 */
DatabaseProgressDelegate.prototype.forwardScanEnded = function() {
  var that = this;
  log.debug("Forward scan ended");
  that.progress.forwardScan.ended = new Date();
  that._updateProgress();
}

/**
 * Called when the reverse scan starts
 */
DatabaseProgressDelegate.prototype.reverseScanStarted = function() {
  var that = this;
  log.debug("Reverse scan started");
  that.status = "In progress (reverse scan)";
  that.progress.reverseScan.started = new Date();
  that._updateProgress();
}

/**
 * Called when the reverse scan processed a new fingerprint
 *
 * @param {number} fingerprints - the total number of fingerprints to scan
 * @param {number} scanned - the number of files scanned so far
 * @param {number} processed - the number of files processed so far
 * @param {number} errors - the number of scan errors
 */
DatabaseProgressDelegate.prototype.reverseScanProgress = function(fingerprints, scanned, processed, errors) {
  var that = this;
  log.debug({ fingerprints:fingerprints, scanned:scanned, processed:processed, errors:errors }, "Reverse scan progress");
  that.progress.reverseScan.fingerprints = fingerprints;
  that.progress.reverseScan.scanned = scanned;
  that.progress.reverseScan.processed = processed;
  that.progress.reverseScan.errors = errors;
  if ((scanned % 1000) === 0) that._updateProgress();
  else {
    var now = new Date().getTime();
    if ((now - that.lastUpdated) >= 100) that._updateProgress();
  }
}

/**
 * Called when the reverse scan ends
 */
DatabaseProgressDelegate.prototype.reverseScanEnded = function() {
  var that = this;
  log.debug("Reverse scan ended");
  that.progress.reverseScan.ended = new Date();
  that._updateProgress();
}






/**
 * Public interface
 */
module.exports = {
  DatabaseProgressDelegate: DatabaseProgressDelegate,
  DatabaseStorageDelegate: DatabaseStorageDelegate
}
