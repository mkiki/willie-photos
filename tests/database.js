/**
 * willie-photos - database unit tests
 */
// (C) Alexandre Morin 2015 - 2016

const assert = require('assert');
const helpers = require('./helpers.js');
const Database = require('wg-database').Database;
const photodb = require('../lib/database.js');

describe('Database', function() {
  
  /** ================================================================================
    * Fingerprint manipulation
    * ================================================================================ */

  describe('Fingerprints', function() {

    it('Should load single fingerprint by ID', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return photodb.loadFingerprint(db, userContext, '3419f433-dac9-45ba-9dba-475c3b87fbf8', function(err, fingerprint) {
          if (err) return done(err);
          assert(fingerprint, "Fingerprint not found");
          return done();
        });
      });
    });

    it('Should not be able to load other users fingerprints', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return photodb.loadFingerprint(db, userContext, '3a487f3b-b70f-44eb-85b9-3fe5c6dff0fc', function(err, fingerprint) {
          if (err) return done(err);
          assert(!fingerprint, "Fingerprint found");
          return done();
        });
      });
    });

    it('Should load nobody\'s fingerprints in order (by uuid)', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return photodb.getFingerPrints(db, userContext, 0, 100, undefined, [], "id", function(err, fingerprints) {
          if (err) return done(err);
          assert.equal(fingerprints.length, 3);
          assert.equal(fingerprints[0].uuid, '0126f9ab-cbe8-481e-8f63-311f938fa0fb');
          assert.equal(fingerprints[1].uuid, '021510d6-9070-4087-aa4e-8cc94232b75f');
          assert.equal(fingerprints[2].uuid, '3419f433-dac9-45ba-9dba-475c3b87fbf8');
          return done();
        });
      });
    });

    it('Should load nobody\'s fingerprints in order (by shortname)', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return photodb.getFingerPrints(db, userContext, 0, 100, undefined, [], "shortFilename", function(err, fingerprints) {
          if (err) return done(err);
          assert.equal(fingerprints.length, 3);
          assert.equal(fingerprints[0].shortFilename, 'dog2.jpg');
          assert.equal(fingerprints[1].shortFilename, 'dog.jpg');
          assert.equal(fingerprints[2].shortFilename, 'elephant.jpg');
          return done();
        });
      });
    });

    it('Should count nobody\'s fingerprints', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return photodb.countFingerPrints(db, userContext, [], function(err, count) {
          if (err) return done(err);
          assert.equal(count, 3);
          return done();
        });
      });
    });

    it('Should get all fingerprints starting with a "d"', function(done) {
      return helpers.asAlexAdmin(function(db, userContext) {
        return photodb.getFingerPrints(db, userContext, 0, 100, undefined, ["f.shortFilename LIKE 'd%'"], "shortFilename", function(err, fingerprints) {
          if (err) return done(err);
          assert.equal(fingerprints.length, 3);
          assert.equal(fingerprints[0].shortFilename, 'dog2.jpg');
          assert.equal(fingerprints[1].shortFilename, 'dog.jpg');
          assert.equal(fingerprints[2].shortFilename, 'dronte.jpg');
          return done();
        });
      });
    });

    it('Should get first page (size=2) of all fingerprints starting with a "d"', function(done) {
      return helpers.asAlexAdmin(function(db, userContext) {
        return photodb.getFingerPrints(db, userContext, 0, 2, undefined, ["f.shortFilename LIKE 'd%'"], "shortFilename", function(err, fingerprints) {
          if (err) return done(err);
          assert.equal(fingerprints.length, 2);
          assert.equal(fingerprints[0].shortFilename, 'dog2.jpg');
          assert.equal(fingerprints[1].shortFilename, 'dog.jpg');
          return done();
        });
      });
    });

    it('Should get second page (size=2) of all fingerprints starting with a "d"', function(done) {
      return helpers.asAlexAdmin(function(db, userContext) {
        return photodb.getFingerPrints(db, userContext, 2, 2, undefined, ["f.shortFilename LIKE 'd%'"], "shortFilename", function(err, fingerprints) {
          if (err) return done(err);
          assert.equal(fingerprints.length, 1);
          assert.equal(fingerprints[0].shortFilename, 'dronte.jpg');
          return done();
        });
      });
    });

    it('Should change a fingerprint file name', function(done) {
      return helpers.asAlexAdmin(function(db, userContext) {
        // Load record and check expected value
        return photodb.loadFingerprint(db, userContext, '0277a01e-af22-450d-a969-ca31697edf45', function(err, fingerprint) {
          if (err) return done(err);
          assert.equal(fingerprint.shortFilename, "dronte.jpg");
          assert.equal(fingerprint.longFilename, "/tmp/dronte.jpg");
          // Update record
          return photodb.updateFingerprint(db, userContext, {uuid:'0277a01e-af22-450d-a969-ca31697edf45', shortFilename:'drone.jpg', longFilename:'/tmp/drone.jpg' }, function(err) {
            if (err) return done(err);
            // Reload record and check
            return photodb.loadFingerprint(db, userContext, '0277a01e-af22-450d-a969-ca31697edf45', function(err, fingerprint) {
              if (err) return done(err);
              assert.equal(fingerprint.shortFilename, "drone.jpg");
              assert.equal(fingerprint.longFilename, "/tmp/drone.jpg");
              // Restore value
              return photodb.updateFingerprint(db, userContext, { uuid:'0277a01e-af22-450d-a969-ca31697edf45', shortFilename:'dronte.jpg', longFilename:'/tmp/dronte.jpg' }, function(err) {
                if (err) return done(err);
                return done();
              });
            });
          });
        });
      });
    });

    it('Non-owner should not be able to change a fingerprint file name', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return photodb.updateFingerprint(db, userContext, { uuid:'3a487f3b-b70f-44eb-85b9-3fe5c6dff0fc', shortFilename:'cot.jpg', longFilename:'/tmp/cot.jpg' }, function(err) {
          assert(Database.isAccessError(err), "Call to 'updateFingerprint' should have failed");
          // Check that fingerprint was not modified
          return helpers.asAlexAdmin(function(db, userContext) {
            return photodb.loadFingerprint(db, userContext, '3a487f3b-b70f-44eb-85b9-3fe5c6dff0fc', function(err, fingerprint) {
              if (err) return done(err);
              assert.equal(fingerprint.shortFilename, "cat.jpg");
              assert.equal(fingerprint.longFilename, "/tmp/cat.jpg");
              return done();  
            });
          });
        });
      });
    });

    it('Should insert a new fingerprint', function(done) {
      return helpers.asNobody(function(db, userContext) {
        // Count fingerprints (will expect one more)
        return photodb.countFingerPrints(db, userContext, [], function(err, count) {
          if (err) return done(err);
          var countBefore = count;
          // Insert new fingerprint
          return photodb.insertFingerprint(db, userContext, { shortFilename:'rat.jpg', longFilename:'/tmp/rat.jpg', ownerId:'ab8f87ea-ad93-4365-bdf5-045fee58ee3b', hidden:false }, function(err) {
            if (err) return done(err);
            // Count fingerprints again
            return photodb.countFingerPrints(db, userContext, [], function(err, count) {
              if (err) return done(err);
              var countAfter = count;
              assert.equal(countAfter, countBefore+1);
              return done();
            });
          });
        });        
      });
    });

  });

  /** ================================================================================
    * images manipulation
    * ================================================================================ */

  describe('Images', function() {

    it('Should load single image by ID', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return photodb.loadImage(db, userContext, '3419f433-dac9-45ba-9dba-475c3b87fbf8', function(err, image) {
          if (err) return done(err);
          assert(image, "Image not found");
          return done();
        });
      });
    });

    it('Should not be able to load someone else\'s image', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return photodb.loadImage(db, userContext, '3a487f3b-b70f-44eb-85b9-3fe5c6dff0fc', function(err, image) {
          if (err) return done(err);
          assert(!image, "Image should not have been found");
          return done();
        });
      });
    });

    it('Should change a image', function(done) {
      return helpers.asNobody(function(db, userContext) {
        // Load record and check expected value
        return photodb.loadImage(db, userContext, '3419f433-dac9-45ba-9dba-475c3b87fbf8', function(err, image) {
          if (err) return done(err);
          assert.equal(image.width, 800);
          assert.equal(image.height, 600);
          // Update record
          return photodb.storeImage(db, userContext, { uuid:'3419f433-dac9-45ba-9dba-475c3b87fbf8', width:1280, height:1024 }, function(err, uuid) {
            if (err) return done(err);
            assert.equal(uuid, '3419f433-dac9-45ba-9dba-475c3b87fbf8');
            // Reload record and check
            return photodb.loadImage(db, userContext, '3419f433-dac9-45ba-9dba-475c3b87fbf8', function(err, image) {
              if (err) return done(err);
              assert.equal(image.width, 1280);
              assert.equal(image.height, 1024);
              // Restore
              return photodb.storeImage(db, userContext, { uuid:'3419f433-dac9-45ba-9dba-475c3b87fbf8', width:800, height:600 }, function(err) {
                if (err) return done(err);
                assert.equal(uuid, '3419f433-dac9-45ba-9dba-475c3b87fbf8');
                return done();
              });
            });
          });
        });
      });
    });

    it('Should not be able to change someone else image', function(done) {
      return helpers.asNobody(function(db, userContext) {
        // Update record
        return photodb.storeImage(db, userContext, { uuid:'3a487f3b-b70f-44eb-85b9-3fe5c6dff0fc', width:1280, height:1024 }, function(err) {
          assert(Database.isAccessError(err), "Call to 'storeImage' should have failed");
          // Reload record and check
          return helpers.asAlexAdmin(function(db, userContext) {
            return photodb.loadImage(db, userContext, '3a487f3b-b70f-44eb-85b9-3fe5c6dff0fc', function(err, image) {
              if (err) return done(err);
              assert.equal(image.width, 800);
              assert.equal(image.height, 600);
              return done();
            });
          });
        });
      });
    });

    it('Should insert an image', function(done) {
      return helpers.asNobody(function(db, userContext) {
        // Load record and check expected value
        return photodb.loadImage(db, userContext, '021510d6-9070-4087-aa4e-8cc94232b75f', function(err, image) {
          if (err) return done(err);
          assert(!image, "Image should not have been found");
          // Insert record
          return photodb.storeImage(db, userContext, { uuid:'021510d6-9070-4087-aa4e-8cc94232b75f', width:1280, height:1024 }, function(err, uuid) {
            if (err) return done(err);
            assert.equal(uuid, '021510d6-9070-4087-aa4e-8cc94232b75f');
            // Reload record and check
            return photodb.loadImage(db, userContext, '021510d6-9070-4087-aa4e-8cc94232b75f', function(err, image) {
              if (err) return done(err);
              assert.equal(image.width, 1280);
              assert.equal(image.height, 1024);
              return done();
            });
          });
        });
      });
    });

    it('Should not be able to insert an image on someone else fingerprint', function(done) {
      return helpers.asNobody(function(db, userContext) {
        // Create record
        return photodb.storeImage(db, userContext, { uuid:'0277a01e-af22-450d-a969-ca31697edf45', width:1280, height:1024 }, function(err) {
          assert(Database.isAccessError(err), "Call to 'storeImage' should have failed");
          // Reload record and check
          return helpers.asAlexAdmin(function(db, userContext) {
            return photodb.loadImage(db, userContext, '0277a01e-af22-450d-a969-ca31697edf45', function(err, image) {
              if (err) return done(err);
              assert(!image, "Image should not have been created");
              return done();
            });
          });
        });
      });
    });
 
     it('Should get all images starting with a "d"', function(done) {
      return helpers.asAlexAdmin(function(db, userContext) {
        return photodb.getImages(db, userContext, undefined, 100, ["f.shortFilename LIKE 'd%'"], function(err, images) {
          if (err) return done(err);
          assert.equal(images.length, 3);
          assert.equal(images[0].shortFilename, 'dog.jpg');
          assert.equal(images[0].image.width, null);  // no image record
          assert.equal(images[1].shortFilename, 'dog2.jpg');
          assert.equal(images[1].image.width, 800);
          assert.equal(images[2].shortFilename, 'dronte.jpg');
          assert.equal(images[2].image.width, null);  // no image record
          return done();
        });
      });
    });

  });


  /** ================================================================================
    * albums manipulation
    * ================================================================================ */

  describe('Albums', function() {

    it('Should load single album by ID', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return photodb.loadAlbum(db, userContext, '029f46b0-e225-41b7-8974-873a7748da2c', function(err, album) {
          if (err) return done(err);
          assert(album, "Album not found");
          return done();
        });
      });
    });

    it('Should not be able to load someone else\'s album', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return photodb.loadAlbum(db, userContext, '0288b621-8567-495b-8717-75ec173934bc', function(err, album) {
          if (err) return done(err);
          assert(!album, "Album should not have been found");
          return done();
        });
      });
    });

    it('Should change a album name', function(done) {
      return helpers.asNobody(function(db, userContext) {
        // Load record and check expected value
        return photodb.loadAlbum(db, userContext, '029f46b0-e225-41b7-8974-873a7748da2c', function(err, album) {
          if (err) return done(err);
          assert.equal(album.name, 'Beasts');
          // Update record
          return photodb.setAlbumName(db, userContext, '029f46b0-e225-41b7-8974-873a7748da2c', 'The Beasts', function(err) {
            if (err) return done(err);
            // Reload record and check
            return photodb.loadAlbum(db, userContext, '029f46b0-e225-41b7-8974-873a7748da2c', function(err, album) {
              if (err) return done(err);
              assert.equal(album.name, 'The Beasts')
              // Restore
              return photodb.setAlbumName(db, userContext, '029f46b0-e225-41b7-8974-873a7748da2c', 'Beasts', function(err) {
                if (err) return done(err);
                return done();
              });
            });
          });
        });
      });
    });

    it('Should not be able to change someone else album name', function(done) {
      return helpers.asNobody(function(db, userContext) {
        // Update record
        return photodb.setAlbumName(db, userContext, '0288b621-8567-495b-8717-75ec173934bc', 'Public', function(err) {
          assert(Database.isAccessError(err), "Call to 'setAlbumName' should have failed");
          // Reload record and check
          return helpers.asAlexAdmin(function(db, userContext) {
            return photodb.loadAlbum(db, userContext, '0288b621-8567-495b-8717-75ec173934bc', function(err, album) {
              if (err) return done(err);
              assert.equal(album.name, 'Private');
              return done();
            });
          });
        });
      });
    });

    it('Should change an album cover', function(done) {
      return helpers.asNobody(function(db, userContext) {
        // Load record and check expected value
        return photodb.loadAlbum(db, userContext, '029f46b0-e225-41b7-8974-873a7748da2c', function(err, album) {
          if (err) return done(err);
          assert.equal(album.name, 'Beasts');
          assert.equal(album.coverId, null);
          // Update record
          return photodb.setAlbumCover(db, userContext, '029f46b0-e225-41b7-8974-873a7748da2c', '021510d6-9070-4087-aa4e-8cc94232b75f', function(err) {
            if (err) return done(err);
            // Reload record and check
            return photodb.loadAlbum(db, userContext, '029f46b0-e225-41b7-8974-873a7748da2c', function(err, album) {
              if (err) return done(err);
              assert.equal(album.name, 'Beasts')
              assert.equal(album.coverId, '021510d6-9070-4087-aa4e-8cc94232b75f');
              // Restore
              return photodb.setAlbumCover(db, userContext, '029f46b0-e225-41b7-8974-873a7748da2c', null, function(err) {
                if (err) return done(err);
                return done();
              });
            });
          });
        });
      });
    });

    it('Should not be able to change someone else album cover', function(done) {
      return helpers.asNobody(function(db, userContext) {
        // Update record
        return photodb.setAlbumCover(db, userContext, '0288b621-8567-495b-8717-75ec173934bc', '021510d6-9070-4087-aa4e-8cc94232b75f', function(err) {
          assert(Database.isAccessError(err), "Call to 'setAlbumCover' should have failed (album not owned)");
          // Reload record and check
          return helpers.asAlexAdmin(function(db, userContext) {
            return photodb.loadAlbum(db, userContext, '0288b621-8567-495b-8717-75ec173934bc', function(err, album) {
              if (err) return done(err);
              assert.equal(album.name, 'Private');
              assert.equal(album.coverId, null);
              return done();
            });
          });
        });
      });
    });

    it('Should not be able to set album cover to a non-owned image', function(done) {
      return helpers.asNobody(function(db, userContext) {
        // Update record
        return photodb.setAlbumCover(db, userContext, '029f46b0-e225-41b7-8974-873a7748da2c', '0277a01e-af22-450d-a969-ca31697edf45', function(err) {
          assert(Database.isAccessError(err), "Call to 'setAlbumCover' should have failed (cover not owned)");
          // Reload record and check
          return helpers.asAlexAdmin(function(db, userContext) {
            return photodb.loadAlbum(db, userContext, '029f46b0-e225-41b7-8974-873a7748da2c', function(err, album) {
              if (err) return done(err);
              assert.equal(album.coverId, null);
              return done();
            });
          });
        });
      });
    });

    it('Should delete album', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return db.executeSQL(userContext, [
            "INSERT INTO photos_tags (id, name, ownerid) VALUES ('029f46b0-e225-41b7-8974-873a7748daff', 'Beasts (for deletion)',   'ab8f87ea-ad93-4365-bdf5-045fee58ee3b')"
          ], function() {
          return photodb.deleteAlbum(db, userContext, '029f46b0-e225-41b7-8974-873a7748daff', function(err) {
            if (err) return done(err);
            return photodb.loadAlbum(db, userContext, '029f46b0-e225-41b7-8974-873a7748daff', function(err, album) {
              if (err) return done(err);
              assert(!album, "Album should have been deleted");
              return done();
            });
          });        
        });
      });
    });

    it('Should not be able to delete someone else album', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return db.executeSQL(userContext, [
          "INSERT INTO photos_tags (id, name, ownerid) VALUES ('0288b621-8567-495b-8717-75ec173934ff', 'Private (for deletion)',  'dec4c80d-e0f4-4bd8-b64d-8425fe04e1ea')"
          ], function() {
          return photodb.deleteAlbum(db, userContext, '0288b621-8567-495b-8717-75ec173934ff', function(err) {
            assert(Database.isAccessError(err), "Call to 'deleteAlbum' should have failed");
            return helpers.asAlexAdmin(function(db, userContext) {
              return photodb.loadAlbum(db, userContext, '0288b621-8567-495b-8717-75ec173934ff', function(err, album) {
                if (err) return done(err);
                assert(album, "Album should not have been deleted");
                // Cleanup
                return db.executeSQL(userContext, [ "DELETE FROM photos_tags WHERE id='0288b621-8567-495b-8717-75ec173934ff'" ], function() {
                  return done();
                });
              });
            });
          });
        });        
      });
    });

    it('Should create an album', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return photodb.createAlbum(db, userContext, 'Test album', function(err, album) {
          if (err) return done(err);
          assert(album, "Should have created an album");
          assert.equal(album.ownerId, 'ab8f87ea-ad93-4365-bdf5-045fee58ee3b');
          return photodb.loadAlbum(db, userContext, album.uuid, function(err, album) {
            if (err) return done(err);
            assert(album, "Album should have been created");
            return helpers.asAlexAdmin(function(db, userContext) {
              // Cleanup
              return db.executeSQL(userContext, [ "DELETE FROM photos_tags WHERE name='Test album'" ], function() {
                return done();
              });
            });
          });
        });
      });
    });

    it('Should load nobody\'s albums in order (by uuid)', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return photodb.getAlbums(db, userContext, "id", function(err, albums) {
          if (err) return done(err);
          albums = albums.filter(function(el) { return el.isDefault === false; });
          assert.equal(albums.length, 2);
          assert.equal(albums[0].uuid, '029100d1-2261-4cc9-b2a7-f16c40d3dee8');
          assert.equal(albums[1].uuid, '029f46b0-e225-41b7-8974-873a7748da2c');
          return done();
        });
      });
    });

  });

  /** ================================================================================
    * Image tagging
    * ================================================================================ */

  describe('Tagging', function() {

    it('Should tag image', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return db.executeSQL(userContext, [ // image required for getImages function
          "INSERT INTO photos_images (id, version) VALUES ('0126f9ab-cbe8-481e-8f63-311f938fa0fb', 1)"
          ], function() {
          // Tag image (dog.jpg => Beasts)
          return photodb.tagImage(db, userContext, '0126f9ab-cbe8-481e-8f63-311f938fa0fb', '029f46b0-e225-41b7-8974-873a7748da2c', function(err) {
            if (err) return done(err);
            // Tag image (dog2.jpg => Beasts)
            return photodb.tagImage(db, userContext, '3419f433-dac9-45ba-9dba-475c3b87fbf8', '029f46b0-e225-41b7-8974-873a7748da2c', function(err) {
              if (err) return done(err);
              // Tag image (dog.jpg => Cats)
              return photodb.tagImage(db, userContext, '0126f9ab-cbe8-481e-8f63-311f938fa0fb', '029100d1-2261-4cc9-b2a7-f16c40d3dee8', function(err) {
                if (err) return done(err);
                // Check album
                return photodb.loadAlbum(db, userContext, '029f46b0-e225-41b7-8974-873a7748da2c', function(err, album) {
                  if (err) return done(err);
                  assert.equal(album.coverId, "0126f9ab-cbe8-481e-8f63-311f938fa0fb");
                  // Check dog image
                  return photodb.getImages(db, userContext, undefined, 1, ["i.id='0126f9ab-cbe8-481e-8f63-311f938fa0fb'"], function(err, images) {
                    if (err) return done(err);
                    assert.equal(images.length, 1, "Should have found an image");
                    assert.equal(Object.keys(images[0].tags).length, 2);
                    assert(images[0].tags['029f46b0-e225-41b7-8974-873a7748da2c']);
                    assert(images[0].tags['029100d1-2261-4cc9-b2a7-f16c40d3dee8']);
                    // Cleanup
                    return db.executeSQL(userContext, [
                      "DELETE FROM photos_fingerprints_tags WHERE fingerPrintId='0126f9ab-cbe8-481e-8f63-311f938fa0fb'",
                      "DELETE FROM photos_fingerprints_tags WHERE fingerPrintId='3419f433-dac9-45ba-9dba-475c3b87fbf8'",
                      "DELETE FROM photos_images WHERE id='0126f9ab-cbe8-481e-8f63-311f938fa0fb'"
                      ], function() {
                      return done();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

    it('Should untag image', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return db.executeSQL(userContext, [ // image required for getImages function
          "INSERT INTO photos_images (id, version) VALUES ('0126f9ab-cbe8-481e-8f63-311f938fa0fb', 1)"
          ], function() {
          // Tag image (dog.jpg => Beasts)
          return photodb.tagImage(db, userContext, '0126f9ab-cbe8-481e-8f63-311f938fa0fb', '029f46b0-e225-41b7-8974-873a7748da2c', function(err) {
            if (err) return done(err);
            // Tag image (dog.jpg => Cats)
            return photodb.tagImage(db, userContext, '0126f9ab-cbe8-481e-8f63-311f938fa0fb', '029100d1-2261-4cc9-b2a7-f16c40d3dee8', function(err) {
              if (err) return done(err);
              // UnTag image (dog.jpg =/=> Beasts)
              return photodb.untagImage(db, userContext, '0126f9ab-cbe8-481e-8f63-311f938fa0fb', '029f46b0-e225-41b7-8974-873a7748da2c', function(err) {
                if (err) return done(err);
                // Check result
                return photodb.getImages(db, userContext, undefined, 1, ["i.id='0126f9ab-cbe8-481e-8f63-311f938fa0fb'"], function(err, images) {
                  if (err) return done(err);
                  assert.equal(images.length, 1, "Should have found an image");
                  assert(!images[0].tags['029f46b0-e225-41b7-8974-873a7748da2c']);
                  assert(images[0].tags['029100d1-2261-4cc9-b2a7-f16c40d3dee8']);
                  // Cleanup
                  return db.executeSQL(userContext, [
                    "DELETE FROM photos_fingerprints_tags WHERE fingerPrintId='0126f9ab-cbe8-481e-8f63-311f938fa0fb'",
                    "DELETE FROM photos_images WHERE id='0126f9ab-cbe8-481e-8f63-311f938fa0fb'"
                    ], function() {
                    return done();
                  });
                });
              });
            });
          });
        });
      });
    });

    it('Should get default tags (as nobody)', function(done) {
      return helpers.asNobody(function(db, userContext) {
        return photodb.getDefaultTags(db, userContext, function(err, albums) {
          if (err) return done(err);
          assert.equal(albums.length, 18);
          assert.equal(albums[0].uuid, '3c2f995f-98c6-475e-8450-d2451082c027');
          return done();
        });
      });
    });

    it('Should get default tags (as admin)', function(done) {
      return helpers.asAlexAdmin(function(db, userContext) {
        return photodb.getDefaultTags(db, userContext, function(err, albums) {
          if (err) return done(err);
          assert.equal(albums.length, 18);
          assert.equal(albums[0].uuid, '3c2f995f-98c6-475e-8450-d2451082c027');
          assert.equal(albums[1].uuid, '7a6097fa-0486-418c-b4ed-fce2a7e8dd1f');
          return done();
        });
      });
    });

    // Insert images into album Beasts: [dog.jpg, dog2.jpg, cat.jpg]
    // Everythings belongs to nobody except for the cat image which belongs to admin
    // Check that reading album as nobody and admin produces the right results
    it('Read an album containing non-owned images', function(done) {
      return helpers.asAlexAdmin(function(db, userContext) {
        return db.executeSQL(userContext, [ // image required for getImages function
          "INSERT INTO photos_images (id, version) VALUES ('0126f9ab-cbe8-481e-8f63-311f938fa0fb', 1)"
          ], function() {
          // Tag image (dog.jpg => Beasts)
          return photodb.tagImage(db, userContext, '0126f9ab-cbe8-481e-8f63-311f938fa0fb', '029f46b0-e225-41b7-8974-873a7748da2c', function(err) {
            if (err) return done(err);
            // Tag image (dog2.jpg => Beasts)
            return photodb.tagImage(db, userContext, '3419f433-dac9-45ba-9dba-475c3b87fbf8', '029f46b0-e225-41b7-8974-873a7748da2c', function(err) {
              if (err) return done(err);
              // Tag image (cat.jpg => Beasts) - note: cat belongs to admin
              return photodb.tagImage(db, userContext, '3a487f3b-b70f-44eb-85b9-3fe5c6dff0fc', '029f46b0-e225-41b7-8974-873a7748da2c', function(err) {
                if (err) return done(err);
                return helpers.asNobody(function(db, userContext) {
                  return photodb.getImages(db, userContext, undefined, 100, ["ft.tagId='029f46b0-e225-41b7-8974-873a7748da2c'"], function(err, images) {
                    if (err) return done(err);
                    assert.equal(images.length, 2, "Should have found an image");
                    assert.equal(images[0].uuid, '0126f9ab-cbe8-481e-8f63-311f938fa0fb');
                    assert.equal(images[1].uuid, '3419f433-dac9-45ba-9dba-475c3b87fbf8');
                    return helpers.asAlexAdmin(function(db, userContext) {
                      return photodb.getImages(db, userContext, undefined, 100, ["ft.tagId='029f46b0-e225-41b7-8974-873a7748da2c'"], function(err, images) {
                        if (err) return done(err);
                        assert.equal(images.length, 3, "Should have found an image");
                        assert.equal(images[0].uuid, '0126f9ab-cbe8-481e-8f63-311f938fa0fb');
                        assert.equal(images[1].uuid, '3419f433-dac9-45ba-9dba-475c3b87fbf8');
                        assert.equal(images[2].uuid, '3a487f3b-b70f-44eb-85b9-3fe5c6dff0fc');
                        // Cleanup
                        return db.executeSQL(userContext, [
                          "DELETE FROM photos_fingerprints_tags WHERE tagId='029f46b0-e225-41b7-8974-873a7748da2c'",
                          "DELETE FROM photos_images WHERE id='0126f9ab-cbe8-481e-8f63-311f938fa0fb'"
                          ], function() {
                          return done();
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });    

    // Insert images into album Private: [dog.jpg, dog2.jpg, cat.jpg]
    // Everythings belongs to nobody except for the cat image and Private album which belongs to admin
    // Check that deleting album as nobody produces the right results, that is remove dog an dog2 from the album
    it('Should not delete an album containing non-owned images', function(done) {
      return helpers.asAlexAdmin(function(db, userContext) {
        return db.executeSQL(userContext, [ // image required for getImages function
          "INSERT INTO photos_images (id, version) VALUES ('0126f9ab-cbe8-481e-8f63-311f938fa0fb', 1)"
          ], function() {
          // Tag image (dog.jpg => Beasts)
          return photodb.tagImage(db, userContext, '0126f9ab-cbe8-481e-8f63-311f938fa0fb', '0288b621-8567-495b-8717-75ec173934bc', function(err) {
            if (err) return done(err);
            // Tag image (dog2.jpg => Beasts)
            return photodb.tagImage(db, userContext, '3419f433-dac9-45ba-9dba-475c3b87fbf8', '0288b621-8567-495b-8717-75ec173934bc', function(err) {
              if (err) return done(err);
              // Tag image (cat.jpg => Beasts) - note: cat belongs to admin
              return photodb.tagImage(db, userContext, '3a487f3b-b70f-44eb-85b9-3fe5c6dff0fc', '0288b621-8567-495b-8717-75ec173934bc', function(err) {
                if (err) return done(err);
                return helpers.asNobody(function(db, userContext) {
                  // Check that album cannot be deleted
                  return photodb.deleteAlbum(db, userContext, '0288b621-8567-495b-8717-75ec173934bc', function(err) {
                    assert(Database.isAccessError(err), "Call to 'deleteAlbum' should have failed");
                    // Check what remains in album
                    return helpers.asAlexAdmin(function(db, userContext) {
                      return photodb.getImages(db, userContext, undefined, 100, ["ft.tagId='0288b621-8567-495b-8717-75ec173934bc'"], function(err, images) {
                        if (err) return done(err);
                        assert.equal(images.length, 1, "Should have found an image");
                        assert.equal(images[0].uuid, '3a487f3b-b70f-44eb-85b9-3fe5c6dff0fc');
                        // Cleanup
                        return db.executeSQL(userContext, [
                          "DELETE FROM photos_fingerprints_tags WHERE tagId='0288b621-8567-495b-8717-75ec173934bc'",
                          "DELETE FROM photos_images WHERE id='0126f9ab-cbe8-481e-8f63-311f938fa0fb'"
                          ], function() {
                          return done();
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });   
  });



});


