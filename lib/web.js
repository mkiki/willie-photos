/**
 * @file willie-photos - Web server
 */
// (C) Alexandre Morin 2016

/**
 * @ignore
 */

const extend = require('extend');
const CronJob = require('cron').CronJob;

const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const utils = require('wg-utils');
const Scanner = require('wg-scanner').Scanner;

const photoUtils = require('./photo-utils.js');
const ModuleConfig = require('./config.js');
const photodb = require('./database.js');

const log = Log.getLogger('willie-photos::web');


/**
 * @module core/web
 */

/** ================================================================================
  * Web App Lifecycle
  * ================================================================================ */

/**
 */
function WebApp(helper, module) {
  this.helper = helper;
  this.module = module;
  this._scheduledCleanupJob = undefined;
  this._cleanupLock = false;

  var that = this;
  helper.registerValidator('flavor', function(value, defaultValue, callback) {
    var valid = ModuleConfig.isValidFlavor(that.module.moduleConfig, value);
    if (!valid) return callback(new Exception({flavor:value}, "Invalid flavor"));
    return callback(undefined, value);
  });
}

/**
 * Start the web application
 * 
 * @param helper -
 * @param callback - 
 */
WebApp.prototype.start = function(express, app, callback) {
  var that = this;

  app.use('/photos/css',                   express.static(__dirname + "/../css"));
  app.use('/photos/js',                    express.static(__dirname + "/../js"));
  app.use('/photos/images',                express.static(__dirname + "/../images"));

  // Web pages
  app.get('/photos/photos.html',           function(req, res) { return that.photos(req, res); });
  app.get('/photos/albums.html',           function(req, res) { return that.albums(req, res); });
  app.get('/photos/navigator.html',        function(req, res) { return that.navigator(req, res); });
  // AJax calls
  app.get('/photos/thumb/:flavor/:uuid',   function(req, res) { return that.getThumb(req, res); });
  app.get('/photos/images',                function(req, res) { return that.getImages(req, res); });
  app.patch('/photos/images',              function(req, res) { return that.patchImages(req, res); });
  app.get('/photos/image/:uuid',           function(req, res) { return that.getImage(req, res); });
  app.get('/photos/albums/:order',         function(req, res) { return that.getAlbums(req, res); });
  app.post('/photos/album',                function(req, res) { return that.createAlbum(req, res); });
  app.delete('/photos/album/:uuid',        function(req, res) { return that.deleteAlbum(req, res); });
  app.patch('/photos/album/:uuid',         function(req, res) { return that.patchAlbum(req, res); });
  app.get('/photos/album/:uuid',           function(req, res) { return that.getAlbum(req, res); });
  app.get('/photos/defaultTags',           function(req, res) { return that.getDefaultTags(req, res); });

  return that.startBackgroundJobs(function(err) {
    if (err) return callback(new Exception({module:that.module.moduleConfig.name}, "Failed to start background jobs", err));
    return callback();
  });
}


/**
 * Get statistics (for the help page) for this module
 */
WebApp.prototype.getModuleStats = function(db, userContext, callback) {
  var that = this;
  var stats = {
    counts: 0,
    lastScanned: undefined,
    distBySize: undefined,
    distByDate: undefined
  };

  log.debug("Counting images");
  return photodb.getImageCount(db, userContext, function(err, counts) {
    if (err) return callback(err);
    stats.counts = counts;
    log.debug("Querying last scan date");
    return photodb.getLastScanned(db, userContext, function(err, lastScanned) {
      if (err) return callback(err);
      stats.lastScanned = lastScanned;
      log.debug("Computing image distribution by size");
      var resolution = 256;
      return photodb.getImageDistributionBySize(db, userContext, resolution, function(err, distBySize) {
        if (err) return callback(err);
        stats.distBySize = {
          resolution: resolution,
          data: distBySize
        };
        return photodb.getImageDistributionByDate(db, userContext, function(err, distByDate) {
          if (err) return callback(err);
          stats.distByDate = distByDate;

          var statsWithModuleName = {};
          statsWithModuleName[that.module.moduleConfig.name] = stats;
          return callback(undefined, statsWithModuleName);
        });
      });
    });
  });
}



/** ================================================================================
  * Background jobs
  * ================================================================================ */

/**
 * Start background jobs
 */
WebApp.prototype.startBackgroundJobs = function(callback) {
  var that = this;
  return callback();
}


/** ================================================================================
  * Views
  * ================================================================================ */

WebApp.prototype.photos = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.info("Displaying the 'photos' page");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleViewError(err, req, res, userContext);
    var options = { 
      title: 'Photos', 
      message: 'Photos'
    };
    return helper.render(res, userContext, 'photos', options);
  });
}

WebApp.prototype.albums = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.info("Displaying the 'albums' page");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleViewError(err, req, res, userContext);
    var options = { 
      title: 'Albums', 
      message: 'Albums', 
    };
    return helper.render(res, userContext, 'albums', options);
  });
}

WebApp.prototype.navigator = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.info("Displaying the 'navigator' page");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleViewError(err, req, res, userContext);
    var options = { 
      title: 'Photos',
      userContext: {
        showUser: false
      }
    };
    return helper.render(res, userContext, 'navigator', options);
  });
}

/** ================================================================================
  * Data
  * ================================================================================ */


/**
 * Get a thumbnail images
 *
 * URL: /thumb/<flavor>/<uuid>
 *    flavor is the thumbnail flavor (ex: "200", "800x600")
 *    uuid is the image UUID (ex: "2e61cd59-1d64-4a4c-a344-b88e9ed6bc41")
 *
 * Returns the binary for the flavored image
 */
WebApp.prototype.getThumb = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.debug("Retreiving thumb (getThumb)");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);
    return helper.getParameters(['flavor|flavor', 'uuid|uuid'], req, function(err, params) {
      if (err) return helper.handleAPIError(err, req, res, userContext);
      log.info({ uuid:params.uuid, flavor:params.flavor }, "Retreiving thumb (getThumb)");
      return photodb.loadFingerprint(db, userContext, params.uuid, function(err, fingerprint) {
        if (err) return helper.handleAPIError(err, req, res, userContext);
        if (!fingerprint) {
          log.error({ fingerprint:params.uuid }, "Fingerprint not found");
          return helper.handleAPIError("Fingerprint not found", req, res, userContext);
        }
        var file = photoUtils.getThumbsFile(that.module.moduleConfig.thumbsDir, params.flavor, params.uuid);
        log.debug({ file:file }, "Returning binary file");
        if (false) {
          setTimeout(function() {
            return helper.sendFile(file, fingerprint.mtime, fingerprint.md5, req, res);
          }, 1000);
        }
        else
          return helper.sendFile(file, fingerprint.mtime, fingerprint.md5, req, res);
      });
    });
  });
}


/**
 * Get a stream of images
 *
 * URL: /images
 * Query parameters
 *    offset: offset for pagination, defaults to 0
 *    limit:  limit for pagination, defaults to 100
 *    tag:    optional tag to filter on
 *
 * Returns a JSON array with fingerprintsAndImages
 */
WebApp.prototype.getImages = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.debug("Starting API call (getImages)");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);
    log.debug({ db:db, userContext:userContext }, "Executing withing user context");
    return helper.getParameters(['offset|query|string', 'limit|query|number|100', 'tag|query', 'byYear|query|string', 'hidden|query|boolean'], req, function(err, params) {
      if (err) return helper.handleAPIError(err, req, res, userContext);
      log.info({ hidden:params.hidden, byYear:params.byYear, offset:params.offset, limit:params.limit, tag:params.tag },
        "Retreiving images (getImages)");

      var _getImages = function() {
        log.debug({filters:filters}, "Applying filters");
        return photodb.getImages(db, userContext, params.offset, params.limit, filters, function(err, fingerprintsAndImages) {
          if (err) return helper.handleAPIError(err, req, res, userContext);
          log.debug({images:fingerprintsAndImages}, "Returning images");
          return helper.sendJSON(fingerprintsAndImages, req, res);
        });
      }
      
      var filters = [
        "f.vanishedAt is NULL",
        "i.scanError = FALSE",
        "i.width >= " + that.module.moduleConfig.minImageWidth + " AND i.height >= " + that.module.moduleConfig.minImageHeight
      ];

      if (!params.hidden) filters.push("f.hidden = FALSE");
      var byYear = params.byYear;
      if (byYear && byYear.length > 0) {
        var range = byYear.split(',');
        if (range && range.length>=2) {
          var from = range[0];
          if (from.length>0) {
            from = parseInt(from, 10);
            filters.push("extract('year' from i.dateTime) >= " + from);
          }
          var to = range[1];
          if (to.length>0) {
            to = parseInt(to, 10);
            filters.push("extract('year' from i.dateTime) <= " + to);
          }
        }
      }

      // Join with album (tag)
      if (params.tag && params.tag.length>0) {
        log.debug({tag:params.tag}, "Tag parameter specified, loading album");
        // Load album
        // No need to check authentication, as this will only be used as a join condition to find images
        return photodb.loadAlbum(db, userContext, params.tag, function(err, album) {
          if (err) return helper.handleAPIError(err, req, res, userContext);
          if (album) {
            var filter = "ft.tagId='" + utils.escapeForWhere(params.tag) + "'";
            if (album.filter && album.filter.length > 0) filter = "(" + album.filter + ") OR (" + filter + ")";
            filters.push(filter);
          }
          return _getImages();
        });
      }
      log.debug("No tag parameter, returning images");
      return _getImages();
    });
  });
}


/**
 * Get an image
 *
 * URL: /image/<uuid>
 *
 * Returns the binary for the image
 */
WebApp.prototype.getImage = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.debug("Retreiving image (getImage)");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);
    return helper.getParameters(['uuid|uuid'], req, function(err, params) {
      if (err) return helper.handleAPIError(err, req, res, userContext);
      log.info({ uuid:params.uuid }, "Retreiving image (getImage)");
      return photodb.loadFingerprint(db, userContext, params.uuid, function(err, fingerprint) {
        if (err) return helper.handleAPIError(err, req, res, userContext);
        if (!fingerprint) {
          log.error({ fingerprint:params.uuid }, "Fingerprint not found");
          return helper.handleAPIError("Fingerprint not found", req, res, userContext);
        }
        return helper.sendFile(fingerprint.longFilename, fingerprint.mtime, fingerprint.md5, req, res);
      });
    });
  });
}

// Reloads an image after an update operation. Returns a single fingerprint/image (same format as getImages)
// Assumes uuid has been sanitized
// @param uuid      is the fingerprint id
// @param callback  is the return function
//                    err is the error code/message
//                    fingerprintAndImage is the image (or null/undefined if not found). Unlike getImages, this is not an array
WebApp.prototype._reloadImage = function(db, userContext, uuid, callback) {
  var that = this;
  log.debug({uuid:uuid}, "Reloading image");
  var filters = [ "f.id='" + uuid + "'" ];
  return photodb.getImages(db, userContext, undefined, 1, filters, function(err, fingerprintsAndImages) {
    if (err) return callback(err);
    if (!fingerprintsAndImages || fingerprintsAndImages.length===0) return callback();
    var image = fingerprintsAndImages[0];
    return callback(null, image);
  });
};

/**
 * Patch a set of images
 *
 * URL: /images
 *
 * Payload
 *    A JSON patch object in the jsonpatch format (http://jsonpatch.com)
 *
 * Returns
 *    A JSON array with the patched images
 */
WebApp.prototype.patchImages = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.debug("Patching image (patchImages)");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);
    return helper.getParameters([], req, function(err, params) {
      if (err) return helper.handleAPIError(err, req, res, userContext);
      var body = req.body;
      log.info({ body:body }, "Patching image (patchImages)");
        if (!body || !body.patch) {
          log.error({ body:body }, "Body is not a valid patch");
          var err = "Body is not a valid patch";
          return helper.handleAPIError(err, req, res, userContext);
        }
        var patch = body.patch;
        return that._patchImages(db, userContext, patch, function(err, fingerprintsAndImages) {
          if (err) return helper.handleAPIError(err, req, res, userContext);
          return helper.sendJSON(fingerprintsAndImages, req, res);
        });
    });
  });
}

// Patch a set of images
// @param patch     is the patch
// @param callback  is the return function
WebApp.prototype._patchImages = function(db, userContext, patch, callback) {
  var that = this;
  var fingerprintsAndImages = [];
  patch = patch.slice(0); // duplicate patch
  return that._patchImageApplyNextOp(db, userContext, patch, fingerprintsAndImages, function(err) {
    return callback(err, fingerprintsAndImages);
  });
}

// Apply the next patch operation (a patch is an array of operations)
// @param patch     array of remaining patch operations
// @param callback  is the return function
WebApp.prototype._patchImageApplyNextOp = function(db, userContext, patch, fingerprintsAndImages, callback) {
  var that = this;
  if (patch.length === 0) return callback(); // no more operations
  var op = patch.shift();
  var uuid = op.uuid;
  var path = op.path;
  var value = op.value;
  log.debug({op:op, uuid:uuid, path:path, value:value}, "Applying patch op on image");
  // Compute patch function
  var patchFn = undefined;
  switch (op.op) {
    case 'add':     patchFn = that._patchImageAdd;      break;
    case 'remove':  patchFn = that._patchImageRemove;   break;
    case 'rescan':  patchFn = that._patchImageRescan;   break;
    case 'replace': patchFn = that._patchImageReplace;  break;
  }
  if (!patchFn) {
    log.error({ op:op }, "Invalid patch op");
    return callback("Invalid patch op");
  }
  // Apply patch
  return patchFn.apply(that, [db, userContext, uuid, path, value, function(err) {
    if (err) return callback(err);
    log.debug({uuid:uuid}, "Reloading image");
    return that._reloadImage(db, userContext, uuid, function(err, fingerprintsAndImage) {
      if (err) return callback(err);
      fingerprintsAndImages.push(fingerprintsAndImage);
      return that._patchImageApplyNextOp(db, userContext, patch, fingerprintsAndImages, function(err) {
        return callback(err);
      });    
    });
  }]);
}

// Apply the a patch 'add' operation
// @param uuid      is the sanitized image uuid (fingerprint exists)
// @param path      path in object where to add element
// @param value     value to add
// @param callback  is the return function
WebApp.prototype._patchImageAdd = function(db, userContext, uuid, path, value, callback) {
  var that = this;
  if (utils.startsWith(path, '/tags/')) {
    var tagId = path.substr(6);
    return photodb.tagImage(db, userContext, uuid, tagId, function(err) {
      return callback(err);
    });
  }
  return callback();
};

// Apply the a patch 'remove' operation
// @param uuid      is the sanitized image uuid (fingerprint exists)
// @param path      path in object where to remove element from
// @param value     value to add
// @param callback  is the return function
WebApp.prototype._patchImageRemove = function(db, userContext, uuid, path, value, callback) {
  var that = this;
  if (utils.startsWith(path, '/tags/')) {
    var tagId = path.substr(6);
    return photodb.untagImage(db, userContext, uuid, tagId, function(err) {
      return callback(err);
    });
  }
  return callback();
};

// Apply the a patch 'replace' operation
// @param uuid      is the sanitized image uuid (fingerprint exists)
// @param path      path in object to replace
// @param value     new value
// @param callback  is the return function
WebApp.prototype._patchImageReplace = function(db, userContext, uuid, path, value, callback) {
  var that = this;
  if (path === 'hidden') {
    return photodb.updateFingerprint(db, userContext, { uuid:uuid, hidden:!!value }, function(err) {
      return callback(err);
    });
  }
  return callback();
};

// Apply the a patch 'rescan' operation
// @param uuid      is the sanitized image uuid (fingerprint exists)
// @param callback  is the return function
WebApp.prototype._patchImageRescan = function(db, userContext, uuid, path, value, callback) {
  var that = this;
  return photodb.loadFingerprint(db, userContext, uuid, function(err, fingerprint) {
    if (err) return callback(err);
    var scope = Scanner.newFilesScope([fingerprint.longFilename]);
    return Scanner.scan(db, userContext, scope, {
      force:            true,
      minImageWidth:    that.module.moduleConfig.minImageWidth,
      minImageHeight:   that.module.moduleConfig.minImageHeight,
      thumbs:           ModuleConfig.getThumbFlavors(that.module.moduleConfig).slice(0),
      thumbsDir:        that.module.moduleConfig.thumbsDir,
      owners:           that.module.moduleConfig.owners.slice(0)
    }, function(err) {
      if (err) return callback(err);
      return callback();
    });
  });
};


/**
 * Get an album
 *
 * URL: /album/:uuid
 */
WebApp.prototype.getAlbum = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.debug("Retreiving album (getAlbum)");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);
    return helper.getParameters(['uuid|uuid'], req, function(err, params) {
      if (err) return helper.handleAPIError(err, req, res, userContext);
      log.info({ uuid:params.uuid}, "Retreiving album (getAlbum)");
      return photodb.loadAlbum(db, userContext, params.uuid, function(err, album) {
        if (err) return helper.handleAPIError(err, req, res, userContext);
        return helper.sendJSON(album, req, res);
      });
    });
  });
};

/**
 * Get the list of albums
 *
 * URL: /albums
 */
WebApp.prototype.getAlbums = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.debug("Retreiving albums (getAlbums)");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);
    return helper.getParameters(['order|query'], req, function(err, params) {
      if (err) return helper.handleAPIError(err, req, res, userContext);
      log.info({ order:params.order }, "Retreiving albums (getAlbums)");
      var order = undefined;
      if (params.order === 'byDateDesc') order = 'MIN(i2.dateTime) DESC';
      else if (params.order === 'byName') order = 't.name';
      return photodb.getAlbums(db, userContext, order, function(err, albums) {
        if (err) return helper.handleAPIError(err, req, res, userContext);
        return helper.sendJSON(albums, req, res);
      });
    });
  });
};

/**
 */
WebApp.prototype.deleteAlbum = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.debug("Deleting album (deleteAlbum)");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);
    return helper.getParameters(['uuid|uuid'], req, function(err, params) {
      if (err) return helper.handleAPIError(err, req, res, userContext);
      log.info({ uuid:params.uuid }, "Deleting album (deleteAlbum)");
      var body = req.body;
      return photodb.deleteAlbum(db, userContext, params.uuid, function(err) {
        if (err) return helper.handleAPIError(err, req, res, userContext);
        return helper.sendJSON({}, req, res);
      });
    });
  });
}


/**
 */
WebApp.prototype.createAlbum = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.debug("Creating album (createAlbum)");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);
    return helper.getParameters([], req, function(err, params) {
      if (err) return helper.handleAPIError(err, req, res, userContext);
      log.info({}, "Creating album (createAlbum)");
      var body = req.body;
      return photodb.createAlbum(db, userContext, body.name, function(err, album) {
        if (err) return helper.handleAPIError(err, req, res, userContext);
        return helper.sendJSON(album, req, res);
      });
    });
  });
}

/**
 */
WebApp.prototype.getDefaultTags = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.debug("Retreiving default tags (getDefaultTags)");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);
    return helper.getParameters([], req, function(err, params) {
      if (err) return helper.handleAPIError(err, req, res, userContext);
      log.info({}, "Retreiving default tags (getDefaultTags)");
      var body = req.body;
      return photodb.getDefaultTags(db, userContext, function(err, album) {
        if (err) return helper.handleAPIError(err, req, res, userContext);
        return helper.sendJSON(album, req, res);
      });
    });
  });
}

/**
 * Patchs an album
 *
 * URL: /album/<uuid>
 *    uuid is the album UUID (ex: "2e61cd59-1d64-4a4c-a344-b88e9ed6bc41")
 *
 * Payload
 *    A JSON patch object in the jsonpatch format (http://jsonpatch.com)
 *
 * Returns
 *    A JSON object with the patched album
 */
WebApp.prototype.patchAlbum = function(req, res) {
  var that = this;
  var helper = that.helper;
  log.debug("Patching album (patchAlbum)");
  return helper.withUserContext(req, res, function(err, db, userContext) {
    if (err) return helper.handleAPIError(err, req, res, userContext);
    return helper.getParameters(['uuid|uuid'], req, function(err, params) {
      if (err) return helper.handleAPIError(err, req, res, userContext);
      log.info({ uuid:params.uuid, body:req.body }, "Patching album (patchAlbum)");

      // Make sure album exists - also acts as parameter validation for uuid
      return photodb.loadAlbum(db, userContext, params.uuid, function(err, album) {
        if (err) return helper.handleAPIError(err, req, res, userContext);
        if (!album) {
          log.error({ album:params.uuid }, "Album not found");
          return helper.handleAPIError("Album not found", req, res, userContext);
        }
        return that._patchAlbum(db, userContext, params.uuid, req.body, function(err) {
          if (err) return helper.handleAPIError(err, req, res, userContext);
          return that._reloadAlbum(db, userContext, params.uuid, function(err, album) {
            if (err) return helper.handleAPIError(err, req, res, userContext);
            return helper.sendJSON(album, req, res);
          });
        });
      });
    });
  });
}

// Reloads an album after an update operation. Returns a single tag/album (same format as getAlbums)
// Assumes uuid has been sanitized
// @param uuid      is the tag id
// @param callback  is the return function
//                    err is the error code/message
//                    album is the album (or null/undefined if not found). Unlike getAlbums, this is not an array
WebApp.prototype._reloadAlbum = function(db, userContext, uuid, callback) {
  var that = this;
  log.debug({uuid:uuid}, "Reloading album");
  var filters = [ function() { return "t.id='" + uuid + "'"; } ];
  return photodb.getAlbums(db, userContext, null, function(err, albums) {
    if (err) return callback(err);
    if (!albums || albums.length===0) return callback();
    var album = albums[0];
    return callback(null, album);
  });
};

// Patch an album
// @param uuid      is the sanitized album uuid (tag exists)
// @param body      is the patch body
// @param callback  is the return function
WebApp.prototype._patchAlbum = function(db, userContext, uuid, body, callback) {
  var that = this;
  if (!body || !body.patch) {
    log.error({ album:uuid, body:body }, "Body is not a valid patch");
    return callback("Body is not a valid patch");
  }
  var patch = body.patch;
  return that._patchAlbumApplyNextOp(db, userContext, uuid, body.patch, function(err) {
    return callback(err);
  });
}

// Apply the next patch operation (a patch is an array of operations)
// @param uuid      is the sanitized album uuid (fingerprint exists)
// @param patch     array of remaining patch operations
// @param callback  is the return function
WebApp.prototype._patchAlbumApplyNextOp = function(db, userContext, uuid, patch, callback) {
  var that = this;
  if (patch.length === 0) return callback(); // no more operations
  var op = patch.shift();
  var path = op.path;
  var value = op.value;
  if (op.op === 'replace') {
    return that._patchAlbumReplace(db, userContext, uuid, path, value, function(err) {
      if (err) return callback(err);
      return that._patchAlbumApplyNextOp(db, userContext, uuid, patch, function(err) {
        return callback(err);
      });
    });
  };
  log.error({ album:uuid, op:op }, "Invalid patch op");
  return callback("Invalid patch op");

}

// Apply the a patch 'replace' operation
// @param uuid      is the sanitized album uuid (tag exists)
// @param path      path in object to replace
// @param value     new value
// @param callback  is the return function
WebApp.prototype._patchAlbumReplace = function(db, userContext, uuid, path, value, callback) {
  var that = this;
  if (path === 'coverId') {
    return photodb.setAlbumCover(db, userContext, uuid, value, function(err) {
      return callback(err);
    });
  }
  if (path === 'name') {
    return photodb.setAlbumName(db, userContext, uuid, value, function(err) {
      return callback(err);
    });
  }
  return callback();
};



/**
 * Public interface
 * @ignore
 */
module.exports = WebApp;

