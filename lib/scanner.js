/**
 * willi-photos - Photo Scanners
 *
 * Scanners will
 * - synchronize the file system and the database (fingerprints, image exif information...)
 * - generate and cache thumbnails and rescaled images
 *
 * There are 2 kind of scanners
 * - forward scanners starts by the file system and updates the database accordingly
 * - reverse scanners starts from the database and perform action on each fingerprint
 *
 * (C) Alexandre Morin 2015 - 2016
 */

const fs = require('fs');
const fse = require('fs-extra');
const moment = require('moment');
const extend = require('extend');

const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const Thumbs = require('wg-thumns');
const Exif = require('wg-exif');
const utils = require('wg-utils');
const Database = require('wg-database').Database;

const photoUtils = require('./photo-utils.js');
const database = require('./database.js');

const coreDatabase = require('willie-core').Database;

const log = Log.getLogger('willie-photos::scanner');




/** ================================================================================
  * Update the version record
  * ================================================================================ */

DbVerionsHandler = function(reverseScanner) {
  this._reverseScanner = reverseScanner;
}

DbVerionsHandler.prototype.getName = function() { return "DbVerionsHandler"; };

// Process next fingerprint
DbVerionsHandler.prototype.processNext = function(settings, fingerprint, stats, isInScope, callback) {
  var that = this;
  if (!isInScope) return callback();
  if (stats === null || stats === undefined) return callback();
  var force = settings.force;
  var found = fingerprint.image;
  if (!found) return callback(null, false);

  var image = {
    uuid:  fingerprint.uuid,
  }

  var reasons = [];
  if (found.version < 6) reasons.push("Image record version too old (" + found.version + ")");
  if (force) reasons.push("Force mode");

  // Upage to version 5 = update te error state
  if (found.version < 5) { 
    image.version = 5;
    var wasError = !!found.scanError;
    var isError = that._reverseScanner._currentFileIsError;
    if (wasError !== isError) {
      image.scanError = isError;
      reasons.push("Error state changed from " + wasError + " to " + isError);
    }
  }
  if (found.scanError === null) {
    image.scanError = false;
    reasons.push("Error state was not set");
  }
  // Update to version 6: nothing needed as this is used only for updating the animations timestamp
  if (found.version < 6) { 
    image.version = 6;
  }
  // Update to version 7: nothing needed as this is used only for updating the animations frames
  if (found.version < 7) { 
    image.version = 7;
  }

  var shouldStore = reasons.length > 0;
  log.debug({ fingerprint:fingerprint.longFilename, image:found, stats:stats, shouldStore:shouldStore, reasons:reasons }, "ErrorState Handler processing next file");
  if (!shouldStore) return callback();
  log.info({ fingerprint:fingerprint.longFilename, reasons:reasons, image:image }, "Updating image record");
  return database.storeImage(that._reverseScanner._db, that._reverseScanner._userContext, image, function(err) {
    if (err) return callback(err);
    fingerprint.image = extend(fingerprint.image, image);
    return callback(null, true);
  });
}



/** ================================================================================
  * Generate GIF animation
  * ================================================================================ */

/**
 * Find and generate animated GIFs 
 * @param db
 * @param settings    Generator parameters
 *                        debug
 *                        minFrames
 *                        flavors
 *                        thumbsDir
 *                        delay
 * @param callback
 */
function generateGIFs(db, userContext, settings, callback) {

  var settings0 = settings;
  settings = extend({
  }, settings);
  log.debug({settings:settings0}, "generateGIFs");

  var gen = new GifGenerator(db, userContext, settings);
  return gen._processNext(function(err) {
    return callback(err);
  });
}

// Compute the difference between two names (full names)
// Returns 1 if file name are consecutive (b is just after a)
function _nameDiff(a, b) {
  var a2 = "";
  var b2 = "";
  var max = Math.max(a.length, b.length);
  for (var i=0; i<max; i++) {
    if (i >= a.length) b2 = b2 + b[i];
    if (i >= b.length) a2 = a2 + a[i];
    if (a[i] !== b[i]) {
      a2 = a2 + a[i];
      b2 = b2 + b[i];
    }
  }
  var delta = parseInt(b2, 10) - parseInt(a2, 10);
  return delta;
}

// Construct a generator
function GifGenerator(db, userContext, settings) {
  this._db = db;
  this._userContext = userContext;
  this._settings = settings;
  this._offset = 0;
  this._limit = 1000;
  this._filters = ["f.hidden=false"];
  this._order = "i.dateTime, f.longFilename";
  this._fingerprints = [];
  this._anim = [];
  this._finishedLoading = false;  // Set when finished loading fingerprints
  this._previousFingerprint = undefined;
}

// Get (and process) next fingerprint to process from the database
GifGenerator.prototype._getNextFingerPrint = function(callback) {
  var that = this;
  if (that._finishedLoading) return callback();
  if (that._fingerprints.length > 0) {
    var fingerprint = that._fingerprints.shift();
    return callback(null, fingerprint);
  }
  return that._getMoreFingerprints(function(err) {
    if (err) return callback(err);
    return that._getNextFingerPrint(callback);
  });
}

// Loads more fingerprints from the database
// Mark the GifGenerator as finished loading when no more fingerprints are available
GifGenerator.prototype._getMoreFingerprints = function(callback) {
  var that = this;
  return database.getFingerPrints(that._db, that._userContext, that._offset, that._limit, that._filters, that._order, function(err, fingerprints) {
    if (err) return callback(err);
    if (fingerprints) {
      for (var i=0; i<fingerprints.length; i++) {
        that._fingerprints.push(fingerprints[i]);
      }
      that._offset = that._offset + fingerprints.length;
    }
    that._finishedLoading = !fingerprints || fingerprints.length === 0;
    return callback();
  });
}

// Process next fingerprint
GifGenerator.prototype._processNext = function(callback) {
  var that = this;
  return that._getNextFingerPrint(function (err, fingerprint) {
    if (err) return callback(err);
    if (!fingerprint) {
      // Finised loading
      return callback();
    }

    // Compare with previous image
    var previousFingerprint = that._previousFingerprint;
    that._previousFingerprint = fingerprint;
    if (previousFingerprint) {
      var nameDiff = _nameDiff(previousFingerprint.longFilename, fingerprint.longFilename);
      var delta = moment(fingerprint.image.dateTime).diff(moment(previousFingerprint.image.dateTime), 'seconds');

      if (fingerprint.image.width === previousFingerprint.image.width &&
          fingerprint.image.height === previousFingerprint.image.height &&
          fingerprint.image.make === previousFingerprint.image.make &&
          fingerprint.image.model === previousFingerprint.image.model &&
          nameDiff === 1 &&
          fingerprint.image.dateTime && previousFingerprint.image.dateTime && delta <= 1 &&
          fingerprint.md5 !== previousFingerprint.md5) {

        // HDR management: when there are HDR photos we find 2 very close shots (previous is non hdr, following is hdr)
        // In this case, ignore the HDR one
        if (previousFingerprint.image.hdr === false && fingerprint.image.hdr === true) {
          that._previousFingerprint = previousFingerprint;
          return that._processNext(callback);
        }

        if (that._anim.length === 0) that._anim.push(previousFingerprint);
        that._anim.push(fingerprint);
        return that._processNext(callback);
      }
    }

    if (that._anim.length > 0) {
      return that._processAnim(function(err) {
        that._anim = [];
        if (err) {
          log.warn({anim:that._anim}, "Failed to create animation");
          err = undefined;
        }
        return that._processNext(callback);
      })
    }

    return that._processNext(callback);
  
  }); 
}

// Process (generate) an animation
GifGenerator.prototype._processAnim = function(callback) {
  var that = this;
  var anim = that._anim;

  // Do not generate unless there's enough frames
  if (that._anim.length < that._settings.minFrames) return callback();

  var flavors = that._settings.flavors.slice(0);
  return that._processAnimNextFlavor(flavors, callback);
}

GifGenerator.prototype._processAnimNextFlavor = function(flavors, callback) {
  var that = this;
  if (flavors.length === 0) return callback();
  var flavor = flavors.shift();
  var sourceFiles = [];
  var delay = that._settings.delay;
  var thumbsDir = that._settings.thumbsDir;
  var maxMtime = undefined;
  var dateTime = that._anim[0].image.dateTime;
  for (var i=0; i<that._anim.length; i++) {
    var fingerprint = that._anim[i];
    if (fingerprint.mtime > maxMtime) maxMtime = fingerprint.mtime;
    var n = photoUtils.getThumbsFile(thumbsDir, flavor, fingerprint.uuid);
    sourceFiles.push(n);
  }
  var dstFloder = thumbsDir + '/gifs/' + flavor;
  return fse.mkdirs(dstFloder, function(err) {
    if (err) return callback(err);
    var shortFilename = that._anim[0].uuid + ".gif";
    var destination = dstFloder + '/' + shortFilename;

    // Look for potential previous file and previous fingerprint
    return database.getFingerPrints(that._db, that._userContext, 0, 1, ["f.longFilename='" + utils.escapeForWhere(destination) + "'"], null, function(err, fingerprints) {
      if (err) return callback(err);
      var oldFingerprint;
      if (fingerprints && fingerprints.length>0) oldFingerprint = fingerprints[0];
      return fs.lstat(destination, function(err, oldStats) {
        if (err && err.code === 'ENOENT') err = undefined;
        if (err) return callback(err);

        // Shall we regenerate the animation?
        var shouldRegenerate = false;
        if (!oldStats || !oldFingerprint) shouldRegenerate = true; // first time
        else if (oldStats.mtime > oldFingerprint.mtime) shouldRegenerate = true; // anim was modified on disk
        else if (maxMtime > fingerprint.mtime) shouldRegenerate = true; // one of the files changed
        
        if (!shouldRegenerate) {
          if (oldFingerprint && oldFingerprint.image && oldFingerprint.image.version < 7) {
            return that._storeAnimImage(oldFingerprint.uuid, oldFingerprint.image, dateTime, function(err) {
              if (err) return callback(err);
              return that._processAnimNextFlavor(flavors, callback);
            });
          }
          return that._processAnimNextFlavor(flavors, callback);
        }
      
        // Generate animation gif
        log.info({ firstFile:that._anim[0].longFilename, to:destination, length:that._anim.length }, "Generating animation");
        return Thumbs.makeGIF(sourceFiles, destination, delay, dateTime, function(err) {
          if (err) return callback(err);
          return that._storeAnimFingerprint(oldFingerprint, shortFilename, destination, dateTime, function(err) {
            if (err) return callback(err);
            return that._processAnimNextFlavor(flavors, callback);
          });
        });
      });
    });
  });
}

GifGenerator.prototype._storeAnimFingerprint = function(fingerprint, shortFilename, destination, dateTime, callback) {
  var that = this;
  var uuid;
  var image;
  if (fingerprint) {
    uuid = fingerprint.uuid;
    image = fingerprint.image;
  }

  return fs.lstat(destination, function(err, stats) {
    if (err) return callback(err);
    return utils.md5(destination, function(err, md5) {
      if (err) return callback(err);

        var fingerprint = {
          uuid:           uuid,
          mtime:          stats.mtime,
          size:           stats.size,
          md5:            md5,
          vanishedAt:     null,
        };

        if (!uuid) {
          fingerprint.shortFilename =  shortFilename;
          fingerprint.longFilename =   destination;
          fingerprint.hidden =         false;
          fingerprint.ownerId =        that._anim[0].ownerId;
          log.info({ fingerprint:fingerprint.longFilename}, "Creating fingerprint");
          return database.insertFingerprint(that._db, that._userContext, fingerprint, function(err) {
            if (err) return callback(err);
            return that._storeAnimImage(fingerprint.uuid, image, dateTime, callback);
          });
        }
        else {
          log.info({ fingerprint:fingerprint.longFilename}, "Updating fingerprint");
          return database.updateFingerprint(that._db, that._userContext, fingerprint, function(err) {
            if (err) return callback(err);
            return that._storeAnimImage(uuid, image, dateTime, callback);
          });
        }

    });
  });
}

GifGenerator.prototype._storeAnimImage = function(uuid, image, dateTime, callback) {
  var that = this;
  var version = 0;
  var frames = [];
  if (image) {
    version = image.version;
    frames = image.frames;
  }
  image = { uuid: uuid };
  fingerprint = { uuid: uuid };

  // Version 6: update the animation timestamp which was incorrectly set to the time at which the animation is generated
  // We want it to be the timestamp of the first frame of the animation
  if (version < 6) {
    image.dateTime = dateTime;
    image.mtime = dateTime;
  }
  // Version 7: update/create the animation frames and set the owner id
  if (frames.length === 0 || version < 7) {
    image.frames = [];
    for (var i=0; i<that._anim.length; i++) {
      var frame = that._anim[i];
      image.frames.push({ imageId:uuid, frameId: frame.uuid });
    }
    fingerprint.ownerId = that._anim[0].ownerId;
  }
  
  image.version = 7;
  return database.updateFingerprint(that._db, that._userContext, fingerprint, function(err) {
    if (err) return callback(err);
    return database.storeImage(that._db, that._userContext, image, function(err) {
      if (err) return callback(err);
      return callback();
    });
  });
}

/** ================================================================================
  * Public interface
  * ================================================================================ */
module.exports = {
  generateGIFs:       generateGIFs
}
