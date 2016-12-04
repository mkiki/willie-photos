/**
 * willie-photos - Test utils / helpers
 */
// (C) Alexandre Morin 2015 - 2016

const extend = require('extend');

const utils = require('wg-utils');
const Database = require('wg-database').Database;
const Log = require('wg-log').Log;
const Exception = require('wg-log').Exception;

var willieCoreModule = require('willie-core').Module;

var Module = require('../lib/module.js');
var williePhotosModule = new Module();


const log = Log.getLogger('willie-photos::database::test');

const DBNAME = "willietest";
const DBUSER = "willie";
const DBPASS = "willie";

const ADMINCNX = "postgres://postgres@localhost/postgres";
const ADMINCNX2 = "postgres://postgres@localhost/" + DBNAME;
const CNX = "postgres://" + DBUSER + ":" + DBPASS + "@localhost/" + DBNAME;

var db = new Database(CNX);

// Wrappers to run functions with different sets of credentials
asNobody = function(callback)       { var userContext = { authenticated:true, isAdmin:false, user:{uuid:'ab8f87ea-ad93-4365-bdf5-045fee58ee3b'}, rights:{admin:false} };  return callback(db, userContext); };
asAlexAdmin = function(callback)    { var userContext = { authenticated:true, isAdmin:true,  user:{uuid:'dec4c80d-e0f4-4bd8-b64d-8425fe04e1ea'}, rights:{admin:true}  };  return callback(db, userContext); };

recreateDatabase = function(dbname, dbuser, callback) {
  var adminDB = new Database(ADMINCNX);
  var adminDB2 = new Database(ADMINCNX2);

  var adminContext = { authenticated:true, user:{uuid:'ab8f87ea-ad93-4365-bdf5-045fee58ee3b'}, rights:{admin:true} };
  return asNobody(function(db, adminContext) {
    log.info("Recreating database");
    return adminDB.executeSQL(adminContext, [
      "DROP DATABASE IF EXISTS " + dbname,
      "CREATE DATABASE " + dbname + " LC_COLLATE 'en_US.utf8' LC_CTYPE 'en_US.utf8'",
    ], function(err) {
      if (err) return callback(err);

      return adminDB2.executeSQL(adminContext, [
        "GRANT ALL PRIVILEGES ON DATABASE " + dbname + " TO " + dbuser,
        "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
      ], function(err) {
        if (err) return callback(err);

        log.info("Database created");
        return willieCoreModule.loadTextFile('sql/update.sql', function(err, update) {
          if (err) return callback(new Exception({module:module.moduleConfig.name}, "Failed to load update.sql file from module", err));
          return willieCoreModule.loadTextFile('sql/data.sql', function(err, data) {
            if (err) return callback(new Exception(undefined, "Failed to load data.sql file from module", err));

            var commands = [
              update,
              data,
              // Core
              "INSERT INTO core_users (id, login, name, canLogin) VALUES ('dec4c80d-e0f4-4bd8-b64d-8425fe04e1ea',   'alex',     'Alexandre Morin',  true)",
            ];
            return db.executeSQL(adminContext, commands, function(err) {
              if (err) return callback(new Exception(undefined, "Failed to execute the database SQL update scripts of module", err));

              return williePhotosModule.loadTextFile('sql/update.sql', function(err, update) {
                if (err) return callback(new Exception({module:module.moduleConfig.name}, "Failed to load update.sql file from module", err));
                return williePhotosModule.loadTextFile('sql/data.sql', function(err, data) {
                  if (err) return callback(new Exception(undefined, "Failed to load data.sql file from module", err));


                  var commands = [
                    update,
                    data,
   
                    // Photos

                    "INSERT INTO photos_fingerprints (id, shortFilename, longFilename, ownerId, mtime) VALUES ('021510d6-9070-4087-aa4e-8cc94232b75f', 'elephant.jpg',   '/tmp/elephant.jpg',    'ab8f87ea-ad93-4365-bdf5-045fee58ee3b',   '2016-06-05T05:36:30.000Z' )",
                    "INSERT INTO photos_fingerprints (id, shortFilename, longFilename, ownerId, mtime) VALUES ('0126f9ab-cbe8-481e-8f63-311f938fa0fb', 'dog.jpg',        '/tmp/dog.jpg',         'ab8f87ea-ad93-4365-bdf5-045fee58ee3b',   '2016-06-05T05:36:30.000Z' )", // same timestamps as above
                    "INSERT INTO photos_fingerprints (id, shortFilename, longFilename, ownerId, mtime) VALUES ('3419f433-dac9-45ba-9dba-475c3b87fbf8', 'dog2.jpg',       '/tmp/dog2.jpg',        'ab8f87ea-ad93-4365-bdf5-045fee58ee3b',   '2016-05-05T05:36:30.000Z' )",
                    "INSERT INTO photos_fingerprints (id, shortFilename, longFilename, ownerId, mtime) VALUES ('3a487f3b-b70f-44eb-85b9-3fe5c6dff0fc', 'cat.jpg',        '/tmp/cat.jpg',         'dec4c80d-e0f4-4bd8-b64d-8425fe04e1ea',   '2016-04-05T05:36:30.000Z' )",
                    "INSERT INTO photos_fingerprints (id, shortFilename, longFilename, ownerId, mtime) VALUES ('0277a01e-af22-450d-a969-ca31697edf45', 'dronte.jpg',     '/tmp/dronte.jpg',      'dec4c80d-e0f4-4bd8-b64d-8425fe04e1ea',   '2016-03-05T05:36:30.000Z' )",

                    // 021510d6-9070-4087-aa4e-8cc94232b75f
                    // 0126f9ab-cbe8-481e-8f63-311f938fa0fb
                    "INSERT INTO photos_images (id, version, width, height) VALUES ('3419f433-dac9-45ba-9dba-475c3b87fbf8', 1, 800, 600)",
                    "INSERT INTO photos_images (id, version, width, height) VALUES ('3a487f3b-b70f-44eb-85b9-3fe5c6dff0fc', 1, 800, 600)",
                    // 0277a01e-af22-450d-a969-ca31697edf45

                    "INSERT INTO photos_tags (id, name, ownerid, isDefault) VALUES ('029f46b0-e225-41b7-8974-873a7748da2c', 'Beasts',   'ab8f87ea-ad93-4365-bdf5-045fee58ee3b', FALSE)",
                    "INSERT INTO photos_tags (id, name, ownerid, isDefault) VALUES ('029100d1-2261-4cc9-b2a7-f16c40d3dee8', 'Catz',     'ab8f87ea-ad93-4365-bdf5-045fee58ee3b', FALSE)",
                    "INSERT INTO photos_tags (id, name, ownerid, isDefault) VALUES ('0288b621-8567-495b-8717-75ec173934bc', 'Private',  'dec4c80d-e0f4-4bd8-b64d-8425fe04e1ea', FALSE)",
                  ];
                  return db.executeSQL(adminContext, commands, function(err) {
                    if (err) return callback(new Exception(undefined, "Failed to execute the database SQL update scripts of module", err));
                    return callback();
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}


/**
 * Database setup
 */

// Called once before executing tests
before(function(done) {
   this.timeout(15000);
  return recreateDatabase(DBNAME, DBUSER, function(err) {
     return done(err);
  });
});

// Called once after executing tests
after(function(done) {
  return Database.shutdown(function(err, stats) {
    if (err) log.warn({err:err}, "Failed to shutdown database");
    return done();
  });
});

// Executed before each test
beforeEach(function(done) {
  return asNobody(function() {
    done();
  });
});


/** ================================================================================
  * Public interface
  * ================================================================================ */
module.exports = {
  cnx:                CNX,
  db:                 db,
  asNobody:           asNobody,
  asAlexAdmin:        asAlexAdmin
};
