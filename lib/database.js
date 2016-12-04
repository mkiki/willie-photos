/**
 * willie-photos - Database access
 */
// (C) Alexandre Morin 2016


const moment = require('moment');

const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const utils = require('wg-utils');
const Database = require('wg-database').Database;

const log = Log.getLogger('willie-photos::database');



/**
 * @module photos/database
 */

/** ================================================================================
  * Type definitions
  * ================================================================================ */


/** ================================================================================
  * Cleanup
  * ================================================================================ */

/**
 * Delete information about vanished files
 *
 * @param callback    is the return function
 *                        err is the error object/code
 *
 * Access rights
 * - Requires a user context with admin rights
 */
cleanupVanishedFiles = function(db, userContext, callback) {
  if (!userContext || !userContext.isAdmin)
    return callback(db.requiresRights("cleanupVanishedFiles requires admin rights"));

  return db.withConnection(function(client, callback) {
    var query = "DELETE FROM photos_images WHERE id IN (SELECT id FROM photos_fingerprints WHERE vanishedAt IS NOT NULL)";
    return db.query(client, "cleanup(1)", query, null, function(err, result) {
      if (err) return callback(err);
      var query = "DELETE FROM photos_fingerprints_tags WHERE fingerPrintId IN (SELECT id FROM photos_fingerprints WHERE vanishedAt IS NOT NULL)";
      return db.query(client, "cleanup(2)", query, null, function(err, result) {
        if (err) return callback(err);
        var query = "UPDATE photos_tags SET coverId=NULL WHERE coverId IN (SELECT id FROM photos_fingerprints WHERE vanishedAt IS NOT NULL)";
        return db.query(client, "cleanup(3)", query, null, function(err, result) {
          if (err) return callback(err);
          var query = "DELETE FROM photos_fingerprints WHERE vanishedAt IS NOT NULL";
          return db.query(client, "cleanup(4)", query, null, function(err, result) {
            if (err) return callback(err);
            var query = "DELETE FROM photos_sessions WHERE validUntil IS NULL OR validUntil < current_timestamp";
            return db.query(client, "cleanup(5)", query, null, function(err, result) {
              return callback(err);
            });
          });
        });
      });
    });
  }, callback);
}


/** ================================================================================
  * Fingerprints
  * ================================================================================ */

/**
 * Load a fingerprint
 *
 * @param uuid        is the fingerprint uuid
 * @param callback    is the return function
 *                        err is the error object/code
 *
 * Access rights
 * - Requires a user context
 * - admin can load all fingerprints
 * - non-admin can only load their own fingerprints
 */
loadFingerprint = function(db, userContext, uuid, callback) {
  log.debug({ uuid:uuid }, "loadFingerprint");
  if (!userContext)
    return callback(db.requiresRights("loadFingerprint requires a user context"));

  return db.withConnection(function(client, callback) {
    var query = "SELECT id, shortFilename, longFilename, mtime, size, md5, vanishedAt, hidden, ownerId " +
                "FROM photos_fingerprints " +
                "WHERE id=$1"; 
    var bindings = [uuid];

    // Apply rights
    if (!userContext.isAdmin)
      query = query + " AND ownerId = '" + userContext.user.uuid + "'";

    return db.query(client, "loadFingerprint", query, bindings, function(err, result) {
      if (err) return callback(err);
      if (result.length === 0) return callback();
      var row = result[0];
      var fingerprint = {
        uuid:           row["id"],
        shortFilename:  row["shortfilename"],
        longFilename:   row["longfilename"],
        mtime:          row["mtime"],
        size:           row["size"],
        md5:            row["md5"],
        vanishedAt:     row["vanishedat"],
        hidden:         row["hidden"],
        ownerId:        row["ownerid"]
      };
      return callback(null, fingerprint);
    });
  }, callback);
}


/**
 * Preload fingerprints from a filename
 *
 * @param longFilename    is the filename for which to load the fingerprint (and subsequent ones)
 * @param count           is the number of fingerprints to load
 * @param callback        is the return function
 *                            err is an error code/message
 *                            fingerprints is the list of loaded fingerprints (in order)
 */
preLoadFingerprints = function(db, userContext, longFilename, count, callback) {
  if (!userContext)
    return callback(db.requiresRights("preLoadFingerprints requires a user context"));

  return db.withConnection(function(client, callback) {
    var query = "SELECT id, shortFilename, longFilename, mtime, size, md5, vanishedAt, hidden, ownerId " +
                "FROM photos_fingerprints " +
                "WHERE longFilename >= $1 ";
    var bindings = [longFilename, count];

    // Apply rights
    if (!userContext.isAdmin)
      query = query + " AND ownerId = '" + userContext.user.uuid + "'";

    query = query + "ORDER BY longFilename " + 
                    "LIMIT $2";

    return db.query(client, "preLoadFingerprints", query, bindings, function(err, result) {
      if (err) return callback(err);
      var fingerprints = [];
      for (var i=0; i<result.length; i++) {
        var row = result[i];
        var fingerprint = {
          uuid:           row["id"],
          shortFilename:  row["shortfilename"],
          longFilename:   row["longfilename"],
          mtime:          row["mtime"],
          size:           row["size"],
          md5:            row["md5"],
          vanishedAt:     row["vanishedat"],
          hidden:         row["hidden"],
          ownerId:        row["ownerid"]
        };
        fingerprints.push(fingerprint);
      }
      return callback(null, fingerprints);
    });
  }, callback);
}

/*
joins = [
  {
    table: "photos_images",
    alias: "i",
    node: "image",
    select: [
      { expr:"i.id",            as:"iid",               attr:"uuid"           },
      { expr:"i.version",       as:"iversion",          attr:"version"        },
      { expr:"i.mtime",         as:"imtime",            attr:"mtime"          },
      { expr:"i.dateTime",      as:"idatetime",         attr:"dateTime"       },
      { expr:"i.width",         as:"iwidth",            attr:"width"          },
      { expr:"i.height",        as:"iheight",           attr:"height"         },
      { expr:"i.orientation",   as:"iorientation",      attr:"orientation"    },
      { expr:"i.hdr",           as:"ihdr",              attr:"hdr"            },
      { expr:"i.latitude",      as:"ilatitude",         attr:"latitude"       },
      { expr:"i.longitude",     as:"ilongitude",        attr:"longitude"      },
      { expr:"i.altitude",      as:"ialtitude",         attr:"altitude"       },
      { expr:"i.dominantColor", as:"idominantcolor",    attr:"dominantColor"  },
      { expr:"i.scanError",     as:"iscanerror",        attr:"scanError"      }
    ]
  },
  {
    table: "miouzik_songs",
    alias: "s",
    node: "song",
    select: [
      { expr:"i.id",            as:"sid",               attr:"uuid"           },
      { expr:"i.title",         as:"stitle",            attr:"title"          },
      { expr:"i.album",         as:"salbum",            attr:"album"          },
      { expr:"i.artist",        as:"sartist",           attr:"artist"         },
      { expr:"i.year",          as:"syear",             attr:"year"           },
      { expr:"i.trackNumber",   as:"strack",            attr:"trackNumber"    },
      { expr:"i.genre",         as:"sgenre",            attr:"genre"          },
    ]
  }
]
*/


/**
 * Get a list of fingerprints/images with pagination
 * @see countFingerPrints
 *
 * @param offset      is the query offset (for pagination)
 * @param limit       is the query limit (for pagination)
 * @param joins       joins to other tables (images, songs...)
 * @param filters     is an array if filter functions. A filter function return the SQL text of a condition. Ex: "id>0"
 *                      SQL aliases: f=fingerprints ; i=images
 * @param order       defines the sorting (as a SQL text, such as 'id' or 'mtime DESC' )
 * @param callback    is the return function
 *                        err is the error object/code
 *                        fingerprints is an array of fingerprint objects
 *
 * Access rights
 * - Requires a user context
 * - admin can load all fingerprints
 * - non-admin can only load their own fingerprints
 */
getFingerPrints = function(db, userContext, offset, limit, joins, filters, order, callback) {
  if (!userContext)
    return callback(db.requiresRights("getFingerPrints requires a user context"));
  if (joins === undefined || joins === null) joins = [];

  return db.withConnection(function(client, callback) {
    var query = "SELECT f.id, f.shortFilename, f.longFilename, f.mtime, f.size, f.md5, f.vanishedAt, f.hidden, f.ownerId"
//              + ", i.id AS iid, i.version, i.mtime AS imtime, i.dateTime, i.width, i.height, "
//              + " i.orientation, i.hdr, i.latitude, i.longitude, i.altitude, i.dominantColor, " 
//              + " i.scanError";
    // Apply joins
    for( var i=0; i<joins.length; i++) {
      var join = joins[i];
      for (var j=0; j<join.select.length; j++) {
        var select = join.select[j];
        query = query + ", " + select.expr;
        if (select.as) query = query + " AS " + select.as;
      }
    }
    // FROM
    query = query + " FROM photos_fingerprints f ";
//    query = query + " LEFT OUTER JOIN photos_images i ON (i.id = f.id)";
    for( var i=0; i<joins.length; i++) {
      var join = joins[i];
      query = query + " LEFT OUTER JOIN " + join.table + " " + join.alias + " ON (";
      if (join.on) query = query + join.on;
      else query = query + join.alias + ".id = f.id";
      query = query + ")";
    }

    // Apply rights
    if (!userContext.isAdmin) {
      filters = filters.slice(0);
      filters.push("f.ownerId = '" + userContext.user.uuid + "'");
    }
    // Apply filters
    for (var i=0; i<filters.length; i++) {
      if (i===0) query = query + " WHERE (";
      else query = query + " AND (";
      query = query + filters[i] + ")";
    }
    if (order) query = query + " ORDER BY " + order;
    query = query + " OFFSET $1 LIMIT $2";
    var bindings = [offset, limit];
    return db.query(client, "getFingerPrints", query, bindings, function(err, result1) {
      if (err) return callback(err);
/*
      var index = query.indexOf(" FROM ");
      var fromWhere = query.substr(index);
      query = "SELECT imageId, index, frameId FROM photos_images_frames WHERE imageId IN (SELECT i.id " + fromWhere + ") ORDER BY imageId, index";
      return db.query(client, "getFingerPrints", query, bindings, function(err, result2) {
        if (err) return callback(err);

        var framesByImageId = {};
        for (var i=0; i<result2.length; i++) {
          var row = result2[i];
          var imageId = row.imageid;
          var frames = framesByImageId[imageId];
          if (!frames) framesByImageId[imageId] = frames = [];
          var frame = { index:row.index, frameId:row.frameid };
          frames.push(frame);
        }
        var keys = Object.keys(framesByImageId);
        for (var i=0; i<keys.length; i++) {
          var imageId = keys[i];
          var frames = framesByImageId[imageId];
          for (var j=0; j<frames.length; j++) {
            frames[j].index = undefined;
          }
        }
*/
        var fingerprints = [];
        for (var i=0; i<result1.length; i++) {
          var row = result1[i];
          var imageId = row["id"];
          var fingerprint = {
            uuid:             imageId,
            shortFilename:    row["shortfilename"],
            longFilename:     row["longfilename"],
            mtime:            row["mtime"],
            size:             row["size"],
            md5:              row["md5"],
            vanishedAt:       row["vanishedat"],
            hidden:           row["hidden"],
            ownerId:          row["ownerid"],
            tags:             undefined, // not loaded
            owner:            {
              uuid:           row["ownerid"],
              login:          undefined, // not loaded
              name:           undefined // not loaded
            },
/*
            image:            {              
              uuid:           row["iid"],
              width:          row["width"],
              height:         row["height"],
              version:        row["version"],
              mtime:          row["imtime"],
              dateTime:       row["datetime"],
              orientation:    row["orientation"],
              make:           row["make"],
              model:          row["model"],
              hdr:            row["hdr"],
              latitude:       row["latitude"],
              longitude:      row["longitude"],
              altitude:       row["altitude"],
              dominantColor:  row["dominantcolor"],
              scanError:      row["scanerror"],
              frames:         framesByImageId[imageId] || [],
              framesCount:    (framesByImageId[imageId] || []).length
            }
*/
          };

          // Apply joins
          for( var ij=0; ij<joins.length; ij++) {
            var join = joins[ij];
            var node = {};
            for (var j=0; j<join.select.length; j++) {
              var select = join.select[j];
              node[select.attr] = row[select.as];
            }
            fingerprint[join.node] = node;
          } 
          fingerprints.push(fingerprint);
        }
        return callback(null, fingerprints);
//      });
    });
  }, callback);
};

/**
 * Count the number of fingerprints/images
 * @see getFingerPrints
 *
 * @param filters     is an array if filter functions. A filter function return the SQL text of a condition. Ex: "id>0"
 *                      SQL aliases: f=fingerprints ; i=images
 * @param callback    is the return function
 *                        err is the error object/code
 *                        count is the number of fingerprints/images
 *
 * Access rights
 * - Requires a user context
 * - admin can count all fingerprints
 * - non-admin can only count their own fingerprints
 */
countFingerPrints = function(db, userContext, filters, callback) {
  if (!userContext)
    return callback(db.requiresRights("countFingerPrints requires a user context"));

  return db.withConnection(function(client, callback) {
    var query = "SELECT COUNT(1) AS count FROM photos_fingerprints f";
    // Apply rights
    if (!userContext.isAdmin) {
      filters = filters.slice(0);
      filters.push("f.ownerId = '" + userContext.user.uuid + "'");
    }
    // Apply filters
    for (var i=0; i<filters.length; i++) {
      if (i===0) query = query + " WHERE (";
      else query = query + " AND (";
      query = query + filters[i] + ")";
    }
    return db.query(client, "countFingerPrints", query, null, function(err, result) {
      if (err) return callback(err);
      var count = parseInt(result[0].count, 10);
      return callback(null, count);
    });
  }, callback);
};

/**
 * Update a fingerprint record. Assumes the uuid of the fingerprint exists.
 * An AccessError will be thrown if the fingerprint could not be updated
 *
 * @param fingerprint       is the fingerprint to update (hollow JSON object) with following specifities
 *                            - missing attribute is left unchanged in the database
 *                            - null attribute is set to null
 *                            - valued attribut is updated
 *                            - attributes whose value is a function can be used to call pg functions
 * @param callback          is the return function
 *                              err is the error code/message
 *
 * Access rights
 * - Requires a user context
 * - admin can update all fingerprints
 * - non-admin can only update their own fingerprints
 */
updateFingerprint = function(db, userContext, fingerprint, callback) {
  if (!userContext)
    return callback(db.requiresRights("updateFingerprint requires a user context"));

  return db.withConnection(function(client, callback) {
    var query = "UPDATE photos_fingerprints SET ";
    var bindings = [ fingerprint.uuid ];
    var nothingToUpdate = true;
    var first = true;
    Object.keys(fingerprint).forEach(function(attr) {
      if (attr !== 'uuid') {
        nothingToUpdate = false;
        var value = fingerprint[attr];
        if (value !== undefined) {
          if (!first) query = query + ", "; else first = false;
          if (value === null) {
            query =  query + attr + " = NULL";
          }
          else if (typeof value === 'function') {
            query =  query + attr + "=" + value.apply(this);
          }
          else {
            var i = bindings.length;
            query =  query + attr + "=$" + (i+1);
            bindings.push(value);
          }
        }
      }
    });
    // Nothing to update => return
    if (nothingToUpdate)
      return callback();
    query = query + " WHERE id=$1";
    // Apply rights
    if (!userContext.isAdmin)
      query = query + " AND ownerId = '" + userContext.user.uuid + "'";
    return db.query(client, "updateFingerprint", query, bindings, function(err, result) {
      var rowCount = result;
      if (rowCount === 0) {
        return callback(db.requiresRights("updateFingerprint did not update any records"));
      }
      return callback(err);
    });
  }, callback);
}

/**
 * Insert a fingerprint record.
 *
 * @param fingerprint       is the fingerprint to create
 * @param callback          is the return function
 *                              err is the error code/message
 *
 * Access rights
 * - Requires a user context
 * - admin can create fingerprints on behalf of anyone
 * - non-admin can only create fingerprints for themselves (must have the ownerId set)
 */
insertFingerprint = function(db, userContext, fingerprint, callback) {
  if (!userContext)
    return callback(db.requiresRights("insertFingerprint requires a user context"));
  // Non-admin can only insert fingerprints for themselves
  if (!userContext.isAdmin) {
    if (fingerprint.ownerId !== userContext.user.uuid)  {
      return callback(db.requiresRights("Cannot insert a fingerprint on behalf of someone else"), {fingerprint:fingerprint, userContext:userContext});
    }
  }
  return db.withConnection(function(client, callback) {
    var query = "INSERT INTO photos_fingerprints (shortFilename, longFilename, mtime, size, md5, vanishedAt, hidden, ownerId) " +
                "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)";
    var bindings = [ fingerprint.shortFilename, fingerprint.longFilename, fingerprint.mtime, fingerprint.size, fingerprint.md5,
                     fingerprint.vanishedAt, fingerprint.hidden, fingerprint.ownerId ];
    return db.query(client, "insertFingerprint(1)", query, bindings, function(err, result) {
      if (err) return callback(err);
      query = "SELECT id, mtime FROM photos_fingerprints WHERE longFilename=$1";
      bindings = [fingerprint.longFilename];
      return db.query(client, "insertFingerprint(2)", query, bindings, function(err, result) {
        if (err) return callback(err);
        fingerprint.uuid = result[0].id;
        return callback(err);
      });
    });
  }, callback);
}

/** ================================================================================
  * Image object manipulation
  * An image record contains image meta-data (exif or other) associated with an image fingerprint
  * ================================================================================ */

/**
 * Load image meta-data
 *
 * @param uuid        is the fingerprint uuid of the image to load
 * @param callback    is the return function
 *                        err is the error object/code
 *                        image is the image object found in the database (or null/undefined if not found)
 *
 * Access rights
 * - Requires a user context
 * - admin can load images
 * - non-admin can only load their own images
 */
loadImage = function(db, userContext, uuid, callback) {
  if (!userContext)
    return callback(db.requiresRights("loadImage requires a user context"));

  return db.withConnection(function(client, callback) {
    var query = "SELECT i.id, i.version, i.mtime, i.dateTime, i.width, i.height, i.resolution, i.orientation, i.make, i.model, " +
                "i.focalLength, i.exposuretime, i.fnumber, i.hdr, i.latitude, i.longitude, i.altitude, i.dominantColor, i.scanError " +
                "FROM photos_images i, photos_fingerprints f WHERE i.id=$1 AND i.id=f.id"; 
    var bindings = [uuid];
    // Apply rights
    if (!userContext.isAdmin)
      query = query + " AND f.ownerId = '" + userContext.user.uuid + "'";
    return db.query(client, "loadImage", query, bindings, function(err, result) {
      if (err) return callback(err);
      if (result.length > 0) {
        var rec = result[0];
        var image = {
          uuid:           rec.id,
          version:        rec.version,
          mtime:          rec.mtime,
          dateTime:       rec.datetime,
          width:          rec.width,
          height:         rec.height,
          resolution:     rec.resolution,
          orientation:    rec.orientation,
          make:           rec.make,
          model:          rec.model,
          focalLength:    rec.focallength,
          exposureTime:   rec.exposuretime,
          fnumber:        rec.fnumber,
          hdr:            rec.hdr,
          latitude:       rec.latitude,
          longitude:      rec.longitude,
          altitude:       rec.altitude,
          dominantColor:  rec.dominantColor,
          scanError:      rec.scanError
        };
      }
      return callback(null, image);
    });
  }, callback);
}

/**
 * Stores (insert/update) image meta-data
 *
 * @param image       is the image object ot store
 *                        The UUID is used as a key (this is the same UUID as for the fingerprint)
 * @param callback    is the return function
 *                        err is the error object/code
 *                        uuid is the uuid of the image object just created/inserted
 *
 * Access rights
 * - Requires a user context
 * - admin can insert/update all images
 * - non-admin can only insert/update images for fingerprints they own
 */
storeImage = function(db, userContext, image, callback) {
  if (!userContext)
    return callback(db.requiresRights("storeImage requires a user context"));

  var uuid = image.uuid;
  return db.withConnection(function(client, callback) {
    // Check if image record already exist and fetch owner id too
    var query = "SELECT f.id AS fid, f.ownerId, i.id AS iid FROM photos_fingerprints f LEFT OUTER JOIN photos_images i ON f.id = i.id WHERE f.id=$1";
    var bindings = [ image.uuid ];
    return db.query(client, "loadImage", query, bindings, function(err, result) {
      if (err) return callback(err);
      if (result.length === 0) {
        var message = "Possible data corruption: inserting an image whith an uuid of a non-existent fingerprint";
        log.warn({image:image}, message);
        return callback(message);
      }
      var rec = result[0];
      var ownerId = rec.ownerid;
      var imageId = rec.iid;

      // Non-admin can only insert fingerprints for themselves
      if (!userContext.isAdmin) {
        if (ownerId !== userContext.user.uuid)  {
          return callback(db.requiresRights("Cannot insert/update a image on behalf of someone else"));
        }
      }

      // Insert new image
      if (!imageId) {
        var query = "INSERT INTO photos_images (id, version, mtime, dateTime, width, height, resolution, orientation, make, model, " +
                    "focalLength, exposuretime, fnumber, hdr, latitude, longitude, altitude, dominantColor, scanError) " +
                    "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)";
        var bindings = [ uuid, 1, image.mtime, image.dateTime, image.width, image.height, image.resolution, image.orientation, 
                         image.make, image.model, image.focalLength, image.exposureTime, image.fnumber, image.hdr,
                         image.latitude, image.longitude, image.altitude, image.dominantColor, image.scanError || false ];
        return db.query(client, "storeImage(insert)", query, bindings, function(err, result) {
          if (err) return callback(err);
          return _updateImageFrames(db, userContext, client, uuid, image.frames, function(err) {
            if (err) return callback(err);
            return callback(null, uuid);
          });
        });
      }

      // Update existing image
      else {
        var query = "UPDATE photos_images SET ";
        var bindings = [ image.uuid ];
        var nothingToUpdate = true;
        var first = true;
        Object.keys(image).forEach(function(attr) {
          if (attr !== 'uuid') {
            nothingToUpdate = false;
            var value = image[attr];
            if (value !== undefined) {
              if (!utils.isArray(value)) {
                if (!first) query = query + ", "; else first = false;
                if (value === null) {
                  query =  query + attr + " = NULL";
                }
                else if (typeof value === 'function') {
                  query =  query + attr + "=" + value.apply(this);
                }
                else {
                  var i = bindings.length;
                  query =  query + attr + "=$" + (i+1);
                  bindings.push(value);
                }
              }
            }
          }
        });
        // Nothing to update => return
        if (nothingToUpdate)
          return callback(null, imageId);
        query = query + " WHERE id=$1";
        return db.query(client, "storeImage(update)", query, bindings, function(err, result) {
          if (err) return callback(err);
          return _updateImageFrames(db, userContext, client, image.uuid, image.frames, function(err) {
            if (err) return callback(err);
            return callback(null, imageId);
          });
        });
      }

    });
  }, callback);

};

_updateImageFrames = function(db, userContext, client, uuid, frames, callback) {
  if (!frames) return callback();
  var query = "DELETE FROM photos_images_frames WHERE imageId=$1";
  var bindings = [uuid];
  return db.query(client, "_updateImageFrames(delete)", query, bindings, function(err) {
    _insertNextImageFrame(db, userContext, client, uuid, frames.slice(0), 0, function(err) {
      return callback(err);
    });
  });
}
_insertNextImageFrame = function(db, userContext, client, uuid, frames, index, callback) {
  if (frames.length === 0) return callback();
  var frame = frames.shift();
  var query = "INSERT INTO photos_images_frames (imageId, index, frameId) VALUES($1,$2,$3)";
  var bindings = [uuid, index, frame.frameId];
  return db.query(client, "_insertNextImageFrame", query, bindings, function(err) {
    if (err) return callback(err);
    return _insertNextImageFrame(db, userContext, client, uuid, frames, index+1, callback);
  });
}


/**
 * Get a list of images
 * 
 * @param from        is the query offset (for pagination)
 *                    The offset is a string of the form
 *                    <type><mtime>##<id>
 * @param limit       is the query limit (for pagination)
 * @param filters     is an array if filter functions. A filter function return the SQL text of a condition. Ex: "id>0"
 *                      SQL aliases: f=fingerprints ; i=images ; ft=fingerprints_tags ; u=users
 * @param callback    is the return function
 *                        err is the error object/code
 *                        fingerprintsAndImages is an array of fingerprint objects
 *
 * Access rights
 * - Requires a user context
 * - admin can view all images and tags
 * - non-admin can only view images for fingerprints they own. Images returned will only have tags the user owns
 */
getImages = function(db, userContext, from, limit, filters, callback) {
  if (!userContext)
    return callback(db.requiresRights("storeImage requires a user context"));
  // Determine if there a need to join with the fingerprints_tags table
  var hasTags = false;
  if (!filters) filters = [];
  filters = filters.slice(0);
  for (var i=0; i<filters.length; i++) {
    if (utils.startsWith(filters[i], 'ft.')) {
      hasTags = true;
      break;
    }
  }

  // Apply rights
  if (!userContext.isAdmin) {
    filters.push("f.ownerId = '" + userContext.user.uuid + "'");
  }
  // Pagination. Decode offset
  // First character : "=" or "<", meaning if were're including the first row or not
  // Then <mtime>##<id>
  var bindings = [];
  if (from) {
    var inclusive = false;
    if (from[0] === '=') inclusive = true;
    else if (from[0] === '<') inclusive = false;
    else from = undefined;
    if (from && from.length < 2) from = undefined;
    if (from) {
      from = from.substr(1);
      from = from.split('##');
      var f = "(f.mtime, f.id) < ($1, $2)";
      if (inclusive) f = "(f.mtime, f.id) <= ($1, $2)";
      if (limit < 0) f = f.replace('<', '>');
      filters.push(f);
      bindings.push(from[0]);
      bindings.push(from[1]);
    }
  }

  var order = limit >= 0 ? 'DESC' : 'ASC';

  return db.withConnection(function(client, callback) {
    var query = "SELECT f.id, f.shortFilename, f.longFilename, f.mtime, f.size, f.md5, " +
                "f.vanishedAt, f.hidden, f.ownerId, " + 
                " i.version, i.mtime AS imtime, i.make, i.model, " +
                " i.dateTime, i.width, i.height, i.orientation, i.hdr, i.latitude, i.longitude, " +
                " i.altitude, i.dominantColor, i.scanError, COALESCE(i.dateTime, f.mtime) AS dt, " +
                " u.id AS userId, u.login AS userLogin, u.name AS userName " + 
                " FROM photos_fingerprints f " +
                " LEFT JOIN photos_images i ON (f.id = i.id) " +
                " LEFT JOIN core_users u ON (f.ownerId = u.id)";
    if (hasTags)
      query = query + " LEFT JOIN photos_fingerprints_tags ft ON (ft.fingerPrintId = f.id)"

    for (var i=0; i<filters.length; i++) {
      if (i===0) query = query + " WHERE (";
      else query = query + " AND (";
      query = query + filters[i] + ")";
    }

    query = query + " ORDER BY f.mtime " + order + ", f.id " + order;
    query = query + " LIMIT $" + (bindings.length + 1);
    bindings.push(Math.abs(limit));

    query = "SELECT r.id, r.shortFilename, r.longFilename, r.mtime, r.size, r.md5, " +
            "r.vanishedAt, r.hidden, r.ownerId,  r.version, r.imtime, r.make, r.model,  " +
            "r.dateTime, r.width, r.height, r.orientation, r.hdr, r.latitude, r.longitude, " +
            "r.altitude, r.dominantColor, r.scanError, r.dt,  r.userId, r.userLogin, r.userName, " +
            "COUNT(if.imageId) AS frames, " +
            "r.mtime || '##' || r.id AS page " +

            "FROM (" +
            query +
            ") r " +

            "LEFT OUTER JOIN photos_images_frames if ON (if.imageId = r.id) " +
            "GROUP BY r.id, r.shortFilename, r.longFilename, r.mtime, r.size, r.md5, r.vanishedAt, " +
            "r.hidden, r.ownerId,  r.version, r.imtime, r.make, r.model,  r.dateTime, r.width, r.height, " +
            "r.orientation, r.hdr, r.latitude, r.longitude,  r.altitude, r.dominantColor, r.scanError, " +
            "r.dt,  r.userId, r.userLogin, r.userName " +
            "ORDER BY r.mtime " + order + ", r.id " + order;

    return db.query(client, "getImages(1)", query, bindings, function(err, result) {
      if (err) return callback(err);
      var fingerprints = [];
      var map = {}; // fingerprints by id
      for (var i=0; i<result.length; i++) {
        var row = result[i];
        var fingerprintAndImage = {
          uuid:             row["id"],
          page:             row["page"],
          shortFilename:    row["shortfilename"],
          longFilename:     row["longfilename"],
          mtime:            row["mtime"],
          size:             +row["size"],
          md5:              row["md5"],
          vanishedAt:       row["vanishedAt"],
          hidden:           row["hidden"],
          ownerId:          row["ownerid"],
          tags:             {},
          owner:            {
            uuid:           row["userid"],
            login:          row["userlogin"],
            name:           row["username"]
          },
          image: {
            uuid:           row["iid"],
            width:          row["width"],
            height:         row["height"],
            version:        row["version"],
            mtime:          row["imtime"],
            dateTime:       row["datetime"],
            orientation:    row["orientation"],
            make:           row["make"],
            model:          row["model"],
            hdr:            row["hdr"],
            latitude:       row["latitude"],
            longitude:      row["longitude"],
            altitude:       row["altitude"],
            dominantColor:  row["dominantcolor"],
            scanError:      row["scanerror"],
            frames:         undefined, // not loaded
            framesCount:    +row["frames"],
          }
        };

        fingerprints.push(fingerprintAndImage);
        map[fingerprintAndImage.uuid] = fingerprintAndImage;
      }
      if (fingerprints.length === 0) {
        return callback(null, fingerprints);
      }
      // ####TODO: Rights management => should filter-out non-owned tags
      query = "SELECT ft.fingerPrintId, t.id, t.name " +
              "FROM photos_fingerprints_tags ft, photos_tags t " +
              "WHERE ft.tagId = t.id AND fingerPrintId IN (";
      for (var i=0; i<fingerprints.length; i++) {
        if (i > 0) query = query + ", ";
        query = query + "'" + fingerprints[i].uuid + "'";
      }
      query = query + ")";
      return db.query(client, "getImages(2)", query, [], function(err, result) {
        if (err) return callback(err);
        for (var i=0; i<result.length; i++) {
          var row = result[i];
          var fp = map[row.fingerprintid];
          fp.tags[row.id] = { uuid:row.id, name:row.name };
        }
        return callback(null, fingerprints);
      });
    });
  }, callback);
};

// Update the cover for a tag (album)
// @param client        is the database connection client
// @param tagId         is the name of the tag(album) for which to update the cover
// @param uuid          is the fingerprint/image id
// @param remove        if false, then fingerprint uuid has just been added to tag and will be used as default cover if not cover set yet
//                      if true, then fingerprint uuid has just been removed from tag, and a new default cover will be used if this was the one
// @param callback      is the return function
_updateCover = function(db, userContext, client, tagId, uuid, remove, callback) {
  // ####TODO: Rights management => should not allow to set non-owned cover
  var query = "SELECT DISTINCT id, name, coverId,"
          + "   first_value(t2.fingerPrintId) OVER (PARTITION BY t2.name ORDER BY t2.fingerPrintId) AS defaultFingerPrintId"
          + " FROM ("
          + "   SELECT t.id, t.name AS name, t.coverId AS coverId, ft.fingerPrintId AS fingerPrintId"
          + "   FROM photos_tags t LEFT OUTER JOIN photos_fingerprints_tags ft ON (t.id=ft.tagId)"
          + "   WHERE t.id='" + escapeForWhere(tagId) + "'"
          + " ) t2";
  var bindings = [];
  return db.query(client, "updateCover(1)", query, bindings, function(err, result) {
    if (err)  return callback(err);
    if (!result || result.length===0) return callback(); // tag not found?
    var row = result[0];
    var coverId = row["coverid"];
    var defaultFingerPrintId = row["defaultfingerprintid"];

    var update = !coverId;
    var newCoverId = uuid;
    if (remove && uuid === coverId) {
      update = true; // tag is removed from cover image
      newCoverId = defaultFingerPrintId;
    }
    if (update) {
      query = "UPDATE photos_tags SET coverId=$1 WHERE id=$2";
      var bindings = [newCoverId, tagId];
      return db.query(client, "updateCover(2)", query, bindings, function(err, result) {
        return callback(err);
      });
    }
    return callback();
  });
}

// Tag/untag an image
// Assumes the tag exists and the image is not tagged yet
// @param uiid      is the image/fingerprint id
// @param tagId     is the id of tag to set
// @param tagUntag  boolean indicating the operation
// @param callback  is the return function
//                      err is the error message/code
_tagUntagImage = function(db, userContext, uuid, tagId, tagUntag, callback) {
  if (!userContext)
    return callback(db.requiresRights("storeImage requires a user context"));

  return db.withConnection(function(client, callback) {

    var query = "SELECT f.ownerId FROM photos_fingerprints f WHERE f.id=$1";
    var bindings = [uuid];
    return db.query(client, "_tagUntagImage(getImageOwner)", query, bindings, function(err, result) {
      if (err) return callback(err);
      if (!result || result.length===0) return callback(); // tag not found?
      var row = result[0];
      var imageOwnerId = row.ownerid;
      if (!userContext.isAdmin && userContext.user.uuid !== imageOwnerId)
        return callback(db.requiresRights("Cannot set/unset tag on a non-owned image"));

      query = "SELECT t.ownerId FROM photos_tags t WHERE t.id=$1";
      bindings = [tagId];
      return db.query(client, "_tagUntagImage(getAlbumOwner)", query, bindings, function(err, result) {
        if (err) return callback(err);
        if (!result || result.length===0) return callback(); // tag not found?
        var row = result[0];
        var albumOwnerId = row.ownerid;
        if (!userContext.isAdmin && userContext.user.uuid !== imageOwnerId)
          return callback(db.requiresRights("Cannot set/unset tag of a non-owned album"));

        if (tagUntag) {
          query = "INSERT INTO photos_fingerprints_tags (tagId, fingerPrintId) VALUES ($1, $2)";
          bindings = [tagId, uuid];
          return db.query(client, "_tagUntagImage(tag)", query, bindings, function(err, result) {
            if (err) return callback(err);
            return _updateCover(db, userContext, client, tagId, uuid, false, function(err) {
              return callback(err);
            });
          });
        }
        else {
          query = "DELETE FROM photos_fingerprints_tags WHERE tagId=$1 AND fingerPrintId=$2" ;
          bindings = [tagId, uuid];
          return db.query(client, "_tagUntagImage(untag)", query, bindings, function(err, result) {
            if (err) return callback(err);
            return _updateCover(db, userContext, client, tagId, uuid, true, function(err) {
              return callback(err);
            });
          });

        }
      });

    });
  }, callback);
};


/**
 * Tag an image
 * Assumes the tag exists and the image is not tagged yet
 *
 * @param uiid      is the image/fingerprint id
 * @param tagId     is the id of tag to set
 * @param callback  is the return function
 *                      err is the error message/code
 *
 * Access rights
 * - Requires a user context
 * - admin can tag/untag all images
 * - non-admin can only tag/untag images for fingerprints they own and for tags (albums) they own
 */
tagImage = function(db, userContext, uuid, tagId, callback) {
  return _tagUntagImage(db, userContext, uuid, tagId, true, callback);
}

/**
 * Remove a tag from an image
 *
 * @param uiid      is the image/fingerprint id
 * @param tagId     is the id of tag to set
 * @param callback  is the return function
 *                      err is the error message/code
 *
 * Access rights
 * - Requires a user context
 * - admin can tag/untag all images
 * - non-admin can only tag/untag images for fingerprints they own and for tags (albums) they own
 */
untagImage = function(db, userContext, uuid, tagId, callback) {
  return _tagUntagImage(db, userContext, uuid, tagId, false, callback);
};

/** ================================================================================
  * Albums
  * ================================================================================ */

/**
 * Load album
 *
 * @param uuid        is the tag uuid of the album to load
 * @param callback    is the return function
 *                        err is the error object/code
 *                        album is the album object found in the database (or null/undefined if not found)
 *
 * Access rights
 * - Requires a user context
 * - admin can load all albums
 * - non-admin can only load albums they own
 */
loadAlbum = function(db, userContext, uuid, callback) {
  if (!userContext)
    return callback(db.requiresRights("storeImage requires a user context"));

  return db.withConnection(function(client, callback) {
    var query = "SELECT t.id, t.name, t.coverId, t.key, t.color, t.filter, t.ownerId FROM photos_tags t WHERE t.id=$1"; 
    var bindings = [uuid];
    // Apply rights
    if (!userContext.isAdmin)
      query = query + " AND (t.ownerId = 'ab8f87ea-ad93-4365-bdf5-045fee58ee3b' OR t.ownerId = '" + userContext.user.uuid + "')";
    return db.query(client, "loadAlbum", query, bindings, function(err, result) {
      if (err) return callback(err);
      if (result.length > 0) {
        var row = result[0];
        var album = {
          uuid:           row["id"],
          name:           row["name"],
          coverId:        row["coverid"],
          key:            row["key"],
          color:          row["color"],
          filter:         row["filter"],
          ownerId:        row["ownerid"]
        }
      }
      return callback(null, album);
    });
  }, callback);
}

/**
 * Get the list of default tags
 *
 * @param callback  is the return function
 *                      @param err is the error code/message
 *                      @param tags is an array of tag objects
 *
 * Access rights
 * - Requires a user context
 * - admin can load all albums
 * - non-admin can only load albums they own
 */
getDefaultTags = function(db, userContext, callback) {
  if (!userContext)
    return callback(db.requiresRights("storeImage requires a user context"));

  return db.withConnection(function(client, callback) {
    var query = "SELECT t.name, t.id, t.key, t.color, t.coverId, t.filter FROM photos_tags t WHERE t.isDefault=TRUE ";
    var bindings = [];
    // Apply rights
    if (!userContext.isAdmin)
      query = query + " AND (t.ownerId = 'ab8f87ea-ad93-4365-bdf5-045fee58ee3b' OR t.ownerId = '" + userContext.user.uuid + "')";
    query = query + " ORDER by t.name";
    return db.query(client, "getDefaultTags", query, bindings, function(err, result) {
      if (err) return callback(err);
      var tags = [];
      for (var i=0; i<result.length; i++) {
        var row = result[i];
        tags.push({
          uuid:                 row["id"],
          name:                 row["name"],
          key:                  row["key"],
          color:                row["color"],
          coverId:              row["coverid"],
          filter:               row["filter"],
          ownerId:              row["ownerid"]
        });
      }
      return callback(null, tags);
    });
  }, callback);
}

/**
 * Update the name of an album
 *
 * @param albumUuid is the album id
 * @param name      is the new name
 * @param callback  is the return function
 *                      @param err is the error code/message
 *
 * Access rights
 * - Requires a user context
 * - admin can modify all albums
 * - non-admin can only modify albums they own
 * - trying to update a non-owned album will return an AccessError
 */
setAlbumName = function(db, userContext, albumUuid, name, callback) {
  if (!userContext)
    return callback(db.requiresRights("storeImage requires a user context"));

  return db.withConnection(function(client, callback) {
    var query = "UPDATE photos_tags SET name=$2 WHERE id=$1";
    var bindings = [albumUuid, name];
    // Apply rights
    if (!userContext.isAdmin)
      query = query + " AND (ownerId = 'ab8f87ea-ad93-4365-bdf5-045fee58ee3b' OR ownerId = '" + userContext.user.uuid + "')";
    return db.query(client, "setAlbumName", query, bindings, function(err, result) {
      var rowCount = result;
      if (rowCount === 0)
        return callback(db.requiresRights("setAlbumName did not update any records"));
      return callback(err);
    });
  }, callback);
}

/**
 * Update the cover of an album
 *
 * @param albumUuid is the album id
 * @param coverUuid is the id of the fingerprint to use as a cover
 * @param callback  is the return function
 *                      @param err is the error code/message
 *
 * Access rights
 * - Requires a user context
 * - admin can modify all albums
 * - non-admin can only modify albums they own using image they own
 * - trying to update a non-owned album will return an AccessError
 */
setAlbumCover = function(db, userContext, albumUuid, coverUuid, callback) {
  if (!userContext)
    return callback(db.requiresRights("setAlbumCover requires a user context"));

  return db.withConnection(function(client, callback) {
    var query = "UPDATE photos_tags SET coverId=$2 WHERE id=$1";
    var bindings = [albumUuid, coverUuid];
    // Apply rights
    if (!userContext.isAdmin) {
      query = query + " AND (ownerId = 'ab8f87ea-ad93-4365-bdf5-045fee58ee3b' OR ownerId = '" + userContext.user.uuid + "')";   // must own album
      if (coverUuid) {
        query = query + " AND EXISTS(SELECT 1 FROM photos_fingerprints f WHERE f.id=$3 AND f.ownerId='" + userContext.user.uuid + "')";   // must own cover image
        bindings.push(coverUuid);
      }
    }
    return db.query(client, "setAlbumCover", query, bindings, function(err, result) {
      var rowCount = result;
      if (rowCount === 0)
        return callback(db.requiresRights("setAlbumCover did not update any records"));
      return callback(err);
    });
  }, callback);
}

/**
 * Deletes an album
 *
 * @param albumUuid is the album id
 * @param callback  is the return function
 *                      @param err is the error code/message
 *
 * Access rights
 * - Requires a user context
 * - admin can delete all albums
 * - non-admin can only delete albums they own and image they own
 * - trying to delete a non-owned album will return an access error
 * - trying to delete a owned album with non-owned image will remove owned images from the album and return an access error
 */
deleteAlbum = function(db, userContext, albumUuid, callback) {
  if (!userContext)
    return callback(db.requiresRights("setAlbumCover requires a user context"));

  return db.withConnection(function(client, callback) {
    var query = "DELETE FROM photos_fingerprints_tags WHERE tagId=$1";
    var bindings = [albumUuid];
    // Apply rights
    if (!userContext.isAdmin)
      query = query + " AND fingerPrintId IN(SELECT id FROM photos_fingerprints WHERE ownerId = '" + userContext.user.uuid + "')";
    return db.query(client, "deleteAlbum(1)", query, bindings, function(err, result) {
      if (err) return callback(err);
      query = "DELETE FROM photos_tags WHERE id=$1";
      bindings = [albumUuid];
      // Apply rights
      if (!userContext.isAdmin)
        query = query + " AND ownerId = '" + userContext.user.uuid + "'";
      return db.query(client, "deleteAlbum(2)", query, bindings, function(err, result) {
        var rowCount = result;
        if (rowCount === 0)
          return callback(db.requiresRights("deleteAlbum: album was not deleted"));
        return callback(err);
      });
    });
  }, callback);
}

/**
 * Creates a new album
 *
 * @param name      is the album name. Optional. If not passed, will use 'Sans titre'
 * @param callback  is the return function
 *                      @param err is the error code/message
 *                      @param album is an object representing the album just created
 *
 * Access rights
 * - Requires a user context
 * - admin can create albums on behalf of anyone
 * - non-admin can only create albums for themselves (will set ownerId)
 */
createAlbum = function(db, userContext, name, callback) {
  if (!userContext)
    return callback(db.requiresRights("setAlbumCover requires a user context"));

  if (!name) name = 'Sans titre';
  return db.withConnection(function(client, callback) {
    var query = "SELECT uuid_generate_v4() AS uuid";
    return db.query(client, "createAlbum(1)", query, null, function(err, result) {
      if (err) return callback(err);
      var uuid = result[0]["uuid"];
      query = "INSERT INTO photos_tags (id, name, ownerId) VALUES ($1, $2, $3)";
      bindings = [uuid, name, userContext.user.uuid];
      return db.query(client, "createAlbum(2)", query, bindings, function(err, result) {
      if (err) return callback(err);
        var album = {
          uuid:     uuid,
          name:     name,
          ownerId:  userContext.user.uuid
        }
        return callback(null, album);
      });
    });
  }, callback);
}

/**
 * Get the list of all albums
 *
 * @param order     defines the sorting (as a SQL text, such as 'id' or 'mtime DESC' ). Optional
 * @param callback  is the return function
 *                      @param err is the error code/message
 *                      @param albums is an array of album objects
 *
 * Access rights
 * - Requires a user context
 * - admin can view all albums and tags
 * - non-admin can only view albums they own
 */
getAlbums = function(db, userContext, order, callback) {
  if (!userContext)
    return callback(db.requiresRights("setAlbumCover requires a user context"));

  return db.withConnection(function(client, callback) {
    var query = "SELECT t.name, t.id as tagId, t.filter as filter, t.ownerId, t.isDefault, " +
                "       f.id, f.shortFilename, f.longFilename, f.mtime, f.size, f.md5, f.vanishedAt, f.hidden, f.ownerId, " +
                "       i.width, i.height, " +
                "       COUNT(ft.fingerPrintId) as imageCount, " +
                "       MIN(i2.dateTime) as tstamp " +
                " FROM photos_tags t LEFT OUTER JOIN photos_fingerprints f ON (t.coverId = f.id)" +
                "             LEFT JOIN photos_images i ON (f.id = i.id)" +
                "             LEFT OUTER JOIN photos_fingerprints_tags ft ON(t.id = ft.tagId)" +
                "             LEFT JOIN core_users u ON (u.id = f.ownerId)" +
                "             LEFT JOIN photos_fingerprints f2 ON (ft.fingerPrintId = f2.id)" +
                "             LEFT JOIN photos_images i2 ON (i2.id = f2.id)" +
                " WHERE 1 = 1";
    // Apply rights
    if (!userContext.isAdmin) {
      query = query + " AND (t.ownerId = 'ab8f87ea-ad93-4365-bdf5-045fee58ee3b' OR t.ownerId = '" + userContext.user.uuid + "')";
      query = query + " AND (f.id IS NULL OR f.ownerId = 'ab8f87ea-ad93-4365-bdf5-045fee58ee3b' OR f.ownerId = '" + userContext.user.uuid + "')"; // Do not return cover if not owner
    }
    query = query + " GROUP BY t.name, t.id, " +
                    "          f.id, f.shortFilename, f.longFilename, f.mtime, f.size, f.md5, f.vanishedAt, f.hidden, f.ownerId, " +
                    "          i.width, i.height";
    if (order) query = query + " ORDER BY " + order;
    return db.query(client, "getAlbums", query, null, function(err, result) {
      if (err) return callback(err);
      var albums = [];
      for (var i=0; i<result.length; i++) {
        var row = result[i];
        var album = {
          uuid:             row["tagid"],
          name:             row["name"],
          filter:           row["filter"],
          ownerId:          row["ownerid"],
          isDefault:        row["isdefault"],
          timestamp:        row["tstamp"],
          cover: {
            uuid:           row["id"],
            shortFilename:  row["shortfilename"],
            longFilename:   row["longfilename"],
            mtime:          row["mtime"],
            size:           row["size"],
            md5:            row["md5"],
            vanishedAt:     row["vanishedat"],
            hidden:         row["hidden"],
            ownedId:        row["ownedid"],
            width:          row["width"],
            height:         row["height"],
          },
          imageCount:       row["imagecount"]
        };
        albums.push(album);
      }
      return callback(null, albums);
    });
  }, callback);
};



/** ================================================================================
  * Database statistics
  * ================================================================================ */

/**
 * Count the number of images in the database
 *
 * @param callback  is the return function
 *                      @param err is the error code/message
 *                      @param count is an object containing the following attibutes
 *                          images: the total number of images
 *                          errors: the number of images with a scan error
 *                          noOwner: the number of images without a owner
 *
 * Access rights
 * - Requires a user context with admin rights
 */
getImageCount = function(db, userContext, callback) {
  if (!userContext || !userContext.isAdmin)
    return callback(db.requiresRights("getImageCount requires admin rights"));

  return db.withConnection(function(client, callback) {
    var query = "SELECT COUNT(1) AS count, f.ownerId, i.scanError " +
                " FROM photos_fingerprints f, photos_images i WHERE f.id=i.id " +
                " AND f.vanishedAt IS NULL " +
                " AND f.hidden=false" +
                " GROUP BY f.ownerId, i.scanError" ;
    var bindings = [];
    return db.query(client, "getImageCount", query, bindings, function(err, result) {
      if (err) return callback(err);
      var count = {
        images: 0,
        errors: 0,
        noOwner: 0
      }
      for (var i=0; i<result.length; i++) {
        var row = result[i];
        var n = parseInt(row.count, 10);
        count.images = count.images + n;
        if (!!row.scanerror) count.errors = count.images + n;
        if (!row.ownerid || row.ownerid.length===0) count.noOwner = count.noOwner + n;
      }
      return callback(null, count);
    });
  }, callback);
};

/**
 * Get the date at which the collection was last scanned
 *
 * @param callback  is the return function
 *                      @param err is the error code/message
 *                      @param lastScanned is the date at which the collection was last scanned. Can be null/undefined
 *
 * Access rights
 * - Requires a user context with admin rights
 */
getLastScanned = function(db, userContext, callback) {
  if (!userContext || !userContext.isAdmin)
    return callback(db.requiresRights("getLastScanned requires admin rights"));

  return db.withConnection(function(client, callback) {
    var query = "SELECT value FROM core_options WHERE name='photos.lastScanned'" ;
    return db.query(client, "getLastScanned", query, null, function(err, result) {
      if (err) return callback(err);
      var lastScanned = moment(result[0].value).toDate();
      return callback(null, lastScanned);
    });
  }, callback);
};

/**
 * Get image size distribution: count number of images for any give size.
 * Size is rounded to a 'resolution' value. For instnace a resolution of 64.
 *
 * @param resolution  is the resolution of the distribution
 * @param callback    is the return function
 *                        @param err is the error code/message
 *                        @param dist is the distribution as an array of objects
 *
 * Access rights
 * - Requires a user context with admin rights
 */
getImageDistributionBySize = function(db, userContext, resolution, callback) {
  if (!userContext || !userContext.isAdmin)
    return callback(db.requiresRights("getImageDistributionBySize requires admin rights"));

  resolution = parseInt(resolution, 10);
  return db.withConnection(function(client, callback) {
    var query = "SELECT i.width-i.width%" + resolution + " AS w, i.height-i.height%" + resolution + " AS h, count(1) " +
                " FROM photos_fingerprints f, photos_images i WHERE f.id=i.id " +
                " AND f.vanishedAt IS NULL " +
                " AND f.hidden=false" +
                " GROUP BY w, h";
    return db.query(client, "getImageDistributionBySize", query, null, function(err, result) {
      if (err) return callback(err);
      var dist = [];
      for (var i=0; i<result.length; i++) {
        var row = result[i];
        dist.push({ width:row.w, height:row.h, count:parseInt(row.count,10) });
      }
      return callback(null, dist);
    });
  }, callback);
};

/**
 * Get image date distribution
 *
 * @param callback    is the return function
 *                        @param err is the error code/message
 *                        @param dist is the distribution as an array of objects
 *
 * Access rights
 * - Requires a user context with admin rights
 */
getImageDistributionByDate = function(db, userContext, callback) {
  if (!userContext || !userContext.isAdmin)
    return callback(db.requiresRights("getImageDistributionByDate requires admin rights"));

  return db.withConnection(function(client, callback) {
    var query = "SELECT extract('year' from i.dateTime) as year, count(1) AS count " +
                " FROM photos_fingerprints f, photos_images i WHERE f.id=i.id " +
                " AND f.vanishedAt IS NULL " +
                " AND f.hidden=false" +
                " GROUP BY year ORDER BY year";
    return db.query(client, "getImageDistributionByDate", query, null, function(err, result) {
      if (err) return callback(err);
      var dist = [];
      for (var i=0; i<result.length; i++) {
        var row = result[i];
        dist.push({ year:parseInt(row.year, 10), count:parseInt(row.count,10) });
      }
      return callback(null, dist);
    });
  }, callback);
};


/**
 * Update the date at which the collection was last scanned
 *
 * @param lastScanned       is the date+time at which the scanned finished
 * @param callback          is the return function
 *                                @param err is the error code/message
 *
 * Access rights
 * - Requires a user context with admin rights
 */
updateLastScanned = function(db, userContext, lastScanned, callback) {
  if (!userContext || !userContext.isAdmin)
    return callback(db.requiresRights("updateLastScanned requires admin rights"));

  return db.withConnection(function(client, callback) {
    var query = "UPDATE core_options SET value=$1 WHERE name='photos.lastScanned'";
    var bindings = [lastScanned];
    return db.query(client, "updateLastScanned", query, bindings, function(err, result) {
      return callback(err);
    });
  }, callback);
}


/** ================================================================================
  * Public interface
  * ================================================================================ */
module.exports = {
  cleanupVanishedFiles:         cleanupVanishedFiles,
  loadFingerprint:              loadFingerprint,
  preLoadFingerprints:          preLoadFingerprints,
  getFingerPrints:              getFingerPrints,
  countFingerPrints:            countFingerPrints,
  updateFingerprint:            updateFingerprint,
  insertFingerprint:            insertFingerprint,
  loadImage:                    loadImage,
  storeImage:                   storeImage,
  getImages:                    getImages,
  tagImage:                     tagImage,
  untagImage:                   untagImage,
  loadAlbum:                    loadAlbum,
  getDefaultTags:               getDefaultTags,              
  setAlbumName:                 setAlbumName,
  setAlbumCover:                setAlbumCover,
  deleteAlbum:                  deleteAlbum,
  createAlbum:                  createAlbum,
  getAlbums:                    getAlbums,
  getImageCount:                getImageCount,
  getLastScanned:               getLastScanned,
  getImageDistributionBySize:   getImageDistributionBySize,
  getImageDistributionByDate:   getImageDistributionByDate,
  updateLastScanned:            updateLastScanned
};
