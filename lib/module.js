/**
 * Photo Organiser - Module definition
 */
// (C) Alexandre Morin 2016

const fs = require('fs');
const moment = require('moment');
const extend = require('extend');

const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;
const utils = require('wg-utils');
const Database = require('wg-database').Database;
const Scanner = require('wg-scanner').Scanner;

const CronJob = require('cron').CronJob;
const photodb = require('./database.js');
const ModuleConfig = require('./config.js');
const ThumbnailsHandler = require('./scanners/thumbnails.js');
const ExifHandler = require('./scanners/exif.js');
const DominantColorHandler = require('./scanners/dominantColor.js');
const ScannerDb = require('./scanner-db.js');


const log = Log.getLogger('willie-photos::module');




/** ================================================================================
  * Delegate to access long-term storage
  * ================================================================================ */

function newDatabaseProgressDelegate(db, userContext) {
  var delegate = new ScannerDb.DatabaseProgressDelegate(db, userContext);
  return delegate;
}

function newDatabaseStorageDelegate(db, userContext) {
  var joins = [
    {
      table: "photos_images",
      alias: "i",
      node: "image",
      select: [
        { expr:"i.id",                as:"iid",             attr:"uuid"           },
        { expr:"i.version",           as:"iversion",        attr:"version"        },
        { expr:"i.mtime",             as:"imtime",          attr:"tagMTime"       },
        { expr:"i.dateTime",          as:"idatetime",       attr:"title"          },
        { expr:"i.width",             as:"iwidth",          attr:"album"          },
        { expr:"i.height",            as:"iheight",         attr:"height"         },
        { expr:"i.orientation",       as:"iorientation",    attr:"orientation"    },
        { expr:"i.hdr",               as:"ihdr",            attr:"hdr"            },
        { expr:"i.latitude",          as:"ilatitude",       attr:"latitude"       },
        { expr:"i.longitude",         as:"ilongitude",      attr:"longitude"      },
        { expr:"i.altitude",          as:"ialtitude",       attr:"altitude"       },
        { expr:"i.dominantColor",     as:"idominantcolor",  attr:"dominantColor"  },
        { expr:"i.scanError",         as:"iscanError",      attr:"scanError"      },
      ]
    }
  ];
  var delegate = new ScannerDb.DatabaseStorageDelegate(db, userContext, joins);

  /**
   * Store image in the database
   */
  delegate.storeImage = function(image, callback) {
    var that = this;
    return photodb.storeImage(that.db, that.userContext, image, function(err, uuid) {
      return callback(err, uuid);
    });
  }
  return delegate;
}










/** ================================================================================
  * Module life cycle
  * ================================================================================ */

/**
 * 
 * @class Module
 */
function Module() {
  this.config = undefined;
  this.moduleConfig = ModuleConfig.defaultConfig;
  this.modules = [];
}

/**
 * Start the module.
 * @memberOf Module
 *
 * @param config - Willie application configuration
 * @param modules - Array of willie modules
 */
Module.prototype.start = function(config, moduleConfig, modules, callback) {
  var that = this;
  log.debug("Starting module");
  moduleConfig = extend(true, {}, ModuleConfig.defaultConfig, moduleConfig);
  return ModuleConfig.check(moduleConfig, function(err) {
    if (err) return callback(new Exception(undefined, "Configuration fail checked", err));
    log.debug({err:err, moduleConfig:moduleConfig}, "Configuration loaded.");
    if (err) return callback(err);
    that.config = config;
    that.moduleConfig = moduleConfig;
    that.modules = modules;
    log.debug("Module started");
    return callback();
  });
}

/**
 * Shuts down the module.
 * @memberOf Module
 *
 * @param {Module~shutdown_callback} callback - is the return function
 */
Module.prototype.shutdown = function(callback) {
  log.debug("Shutting down module");
  return callback();
}
/**
 * Callback for the shutdown function.
 * @ignore
 *
 * @callback Module~shutdown_callback
 * @param err - is the error code/message
 *
 * @see shutdown
 */

/** ================================================================================
  * Scan command: scan the collection
  *
  * - no arguments => (re)scan the whole collection
  * - 1 argument (file or directory) => only (re)scan the specified file or directory
  * ================================================================================ */
Module.prototype.scanCommand = function(argv, callback) {
  var that = this;
  var scanOptions = { 
    force:            false,
    minImageWidth:    that.moduleConfig.minImageWidth,
    minImageHeight:   that.moduleConfig.minImageHeight,
    thumbs:           ModuleConfig.getThumbFlavors(that.moduleConfig).slice(0),
    thumbsDir:        that.moduleConfig.thumbsDir
  };
  if (argv.length>0) {
    var filename = process.argv[0];
    if (filename === '-force') {
      scanOptions.force = true;
      process.argv.shift();
      filename = process.argv[0];
    }
    log.info({argv:argv, filename:filename}, "Executing 'scan' command (limiting scope to file/folder)");
    process.argv.shift();
    if (filename !== "") {
      return fs.lstat(filename, function(err, stats) {
        if (err) return callback(err);
        log.debug({ filename:filename, stats:stats }, "Scanning file");
        var scope;
        if (stats.isDirectory())  scope = Scanner.newDirectoryScope(filename);
        else                      scope = Scanner.newFilesScope([ filename ]);
        return that._runScan(scope, scanOptions, false, function(err) {
          return callback(err);
        });
      });
    }
  }

  log.info({argv:argv}, "Executing 'scan' command (scanning all)");
  return that._runScan(undefined, scanOptions, true, function(err) {
    return callback(err);
  });
}

Module.prototype._runScan = function(scope, scanOptions, generateGifs, callback) {
  var that = this;
  log.info({ scope:scope }, "Executing scan command");
  var tsStart = moment();
  var adminContext = { authenticated:true, isAdmin:true, user:{}, rights:{} };
  var db = new Database(that.config.cnx);

  var endScan = function(err, cumulatedStats) {
/*
    if (generateGifs) {
      return that._generateGIFs(db, adminContext, function(err) {
        return endScan2(err, cumulatedStats);
      });
    }
*/
    return endScan2(err, cumulatedStats);
  }

  var endScan2 = function(err, cumulatedStats) {
    if (err) {
      return Database.shutdown(function() {
        return callback(err);
      });
    }
    var tsEnd = moment();
    log.info("Cumulated statistics (%d@s)", tsEnd.diff(tsStart, 'seconds'));
    log.info("- Forward scan: %d files (%d processed, %d failed)", cumulatedStats.forward.scanned, cumulatedStats.forward.processed, cumulatedStats.forward.errors);
    log.info("- Reverse scan: %d files (%d processed, %d failed)", cumulatedStats.reverse.scanned, cumulatedStats.reverse.processed, cumulatedStats.reverse.errors);
    return photodb.updateLastScanned(db, adminContext, tsEnd.toDate(), function(err) {
      return Database.shutdown(function() {
        return callback(err);
      });
    });
  }

  if (scope === undefined) {
    var cumulatedStats = { forward: {scanned:0, processed:0, errors:0}, reverse:{scanned:0, processed:0, errors:0} };
    var collections = that.moduleConfig.collections.slice(0);
    return that._scanNextCollection(db, adminContext, collections, scanOptions, cumulatedStats, function(err) {
      return endScan(err, cumulatedStats);
    });
  }
  return that._scanScope(db, adminContext, scope, scanOptions, function(err, stats) {
    return endScan(err, stats);
  })
}

Module.prototype._scanNextCollection = function(db, userContext, collections, scanOptions, cumulatedStats, callback) {
  var that = this;
  if (collections.length === 0) return callback(null);
  var collection = collections.shift();
  var folder = collection.folder;
  return that._scanFolder(db, userContext, folder, scanOptions, function(err, stats) {
    if (err) return callback(err);
    cumulatedStats.forward.scanned = cumulatedStats.forward.scanned + stats.forward.scanned;
    cumulatedStats.forward.processed = cumulatedStats.forward.processed + stats.forward.processed;
    cumulatedStats.forward.errors = cumulatedStats.forward.errors + stats.forward.errors;
    cumulatedStats.reverse.scanned = cumulatedStats.reverse.scanned + stats.reverse.scanned;
    cumulatedStats.reverse.processed = cumulatedStats.reverse.processed + stats.reverse.processed;
    cumulatedStats.reverse.errors = cumulatedStats.reverse.errors + stats.reverse.errors;
    return that._scanNextCollection(db, userContext, collections, scanOptions, cumulatedStats, callback);
  });
}

Module.prototype._scanFolder = function(db, userContext, folder, scanOptions, callback) {
  var that = this;
  var scope = Scanner.newDirectoryScope(folder);
  scope.includeFiles(that.moduleConfig.include).
    exclude(that.moduleConfig.exclude).
    excludeFilesLargerThan(that.moduleConfig.maxFileSize).
    excludeFilesSmallerThan(that.moduleConfig.minFileSize);
  return that._scanScope(db, userContext, scope, scanOptions, callback);
};

Module.prototype._scanScope = function(db, userContext, scope, scanOptions, callback) {
  var that = this;
  var storageDelegate = newDatabaseStorageDelegate(db, userContext);
  var progressDelegate = newDatabaseProgressDelegate(db, userContext);
  var handlers = [ThumbnailsHandler, ExifHandler, DominantColorHandler];
  return Scanner.scan(storageDelegate, progressDelegate, scope, handlers, scanOptions, function(err, stats) {
    return callback(err, stats);
  });
};

// Generate GIF animations
Module.prototype._generateGIFs = function(db, userContext, callback) {
  var that = this;
  log.info("Looking for animations to generate");

  return Scanner.generateGIFs(db, userContext, {
      minFrames:  that.moduleConfig.animGenerator.minFrames,
      flavors:    that.moduleConfig.animGenerator.flavors,
      thumbsDir:  that.moduleConfig.thumbsDir,
      delay:      that.moduleConfig.animGenerator.delay
    }, function(err) {
    if (err) return callback(err);

    // Scan gif folder
    var folder = that.moduleConfig.thumbsDir + "/gifs";
    return that._scanFolder(db, userContext, folder, function(err) {
      return callback(err);
    });
  });
}

/** ================================================================================
  * exif command: display exif information
  * ================================================================================ */
Module.prototype.exifCommand = function(argv, callback) {
  var that = this;
  var filename = process.argv[0];
  process.argv.shift();
  log.info("Running exif command on file", filename);
  return Exif.extractEXIF(filename, function(err, exif) {
    log.info({ err:err, exif:exif }, "Result");
    return callback(err);
  });
}


/** ================================================================================
  * Cleanup command: cleanup database
  * ================================================================================ */
Module.prototype.cleanupCommand = function(argv, callback) {
  var that = this;
  return that.runCleanup(function(err) {
    return callback(err);
  })
}

Module.prototype.runCleanup = function(callback) {
  var that = this;
  log.info("Executing database cleanup command");
  var adminContext = { authenticated:true, isAdmin:true, user:{}, rights:{} };
  var db = new Database(config.cnx);
  return that._cleanup(db, adminContext, function(err) {
    return Database.shutdown(function() {
      return callback(err);
    });
  });
}

Module.prototype._cleanup = function(db, userContext, callback) {
  var that = this;
  log.info("Cleaning up vanished files");
  return photodb.cleanupVanishedFiles(db, userContext, function(err) {
    if (err) return callback(err);
    log.info("Running database vacuum");
    return db.vacuum(userContext, function(err) {
      if (err) return callback(err);
      return callback();
    });
  });
}

/**
 * Parse command line arguments and run command.
 * @memberOf Module
 * 
 * @param {string[]} argv - Command args, shifted, so that the first item (index 0) represents the command name
 * @param {Module~command_callback} callback - is the return function
 */
Module.prototype.command = function(argv, callback) {
  var that = this;
  var command = argv[0];  // command

  // Decode module options
  while (command && command[0]==='-') {
    log.warn({ arg:command}, "Ignoring parameter");
    command = argv[0];
    argv.shift();
  }
  argv.shift();

  // Execute commands
  if (command === 'scan')         return that.scanCommand(argv, callback);          // scan folder and create database
  if (command === 'cleanup')      return that.cleanupCommand(argv, callback);       // cleanup database
  if (command === 'exif')         return that.exifCommand(argv, callback);          // extract exif information from file

  return callback(new Exception({command:command}, "Invalid command"));
}

/**
 * help command: display help
 * @memberOf Module
 * @return a multi-line string containing the module help
 */
Module.prototype.getHelpString = function() {
  var that = this;
  var help = "Photos collection scanner and browser\n"
           + "Options:\n"
           + "    No options for this module\n"
           + "Commands:\n"
           + "    scan [<filename>]             Incrementally scan the collection\n"
           + "                                  Without arguments, the whole collection is scanned\n"
           + "                                  filename can be either a file or a folder\n"
           + "    cleanup                       Cleanup the database\n"
           + "    exif <filename>               Extract exif information from file\n";
  return help;
}


/**
 * Start background jobs
 * @memberOf Module
 *
 * @param web -
 * @patam {function} callback - return function
 */
 /*
Module.prototype.startBackgroundJobs = function(web, callback) {
  var that = this;
  // Run a scan every hour at past 15 minutes
  log.info("Scanning for new at 15 minutes of every hour");
  web.scheduledScan = new CronJob({
    cronTime: '15 * * * *',
    onTick: function() { return that._scheduledScan(function(err) { done(err); } ); },
    start: true,
    timeZone: 'UTC'
  });

  log.info("Cleaning up database five minutes after midnight, every day");
  // Run a cleanup every night (5 minutes after midnight, every day)
  web.scheduledCleanup = new CronJob({
    cronTime: '5 0 * * *',
    onTick: function() { return that._scheduledCleanup(function(err) { done(err); } ); },
    start: true,
    timeZone: 'UTC'
  });

  return callback();
}


var scanLock = false;
Module.prototype._scheduledScan = function(callback) {
  var that = this;
  log.info("Running scheduled scan");
  if (scanLock) {
    log.info("Skipping because scan is currently running");
    return callback();
  }
  scanLock = true;
  try {
    return that._runScan(undefined, true, function(err) {
      return callback(err);
    });
  } finally {
    scanLock = false;
  }
}


var cleanupLock = false;
Module.prototype._scheduledCleanup = function(callback) {
  var that = this;
  log.info("Running scheduled cleanup");
  if (cleanupLock) {
    log.info("Skipping because cleanup is currently running");
    return callback();
  }
  cleanupLock = true;
  try {
    return that._runCleanup(function(err) {
      return callback(err);
    });
  } finally {
    cleanupLock = false;
  }
}
*/



/**
 * Load a module file
 * @param {string} relativePath - is the file name, relative to the module root
 * @param {function} callback - is the return function, passing the file contents
 */
Module.prototype.loadTextFile = function(relativePath, callback) {
  var filename = __dirname + '/../' + relativePath;
  log.debug({filename:filename}, "Loading text file from module");
  return fs.readFile(filename, 'utf8', function(err, contents) {
    return callback(err, contents);
  });
}


/**
 * Public interface
 */
module.exports = Module;


