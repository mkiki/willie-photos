/**
 * willie-photos - Scanner unit tests
 */
// (C) Alexandre Morin 2015 - 2016

const assert = require('assert');
const Scanner = require('wg-scanner').Scanner;
const ScannerTest = require('wg-scanner').Test();

describe('Scanner', function() {

  var storageDelegate = ScannerTest.storageDelegate;
  var progressDelegate = ScannerTest.progressDelegate;

  function checkStats(cumulatedStats, fs, fp, fe, rs, rp, re) {
    assert.equal(cumulatedStats.forward.scanned, fs);
    assert.equal(cumulatedStats.forward.processed, fp);
    assert.equal(cumulatedStats.forward.errors, fe);
    assert.equal(cumulatedStats.reverse.scanned, rs);
    assert.equal(cumulatedStats.reverse.processed, rp);
    assert.equal(cumulatedStats.reverse.errors, re);
  }

  function scan(relativeFileName, callback) {
    var scope = Scanner.newFilesScope([__dirname + "/" + relativeFileName]);
    var scanOptions = {
      force: false
    };
    var handlers = [];
    return Scanner.scan(storageDelegate, progressDelegate, scope, handlers, scanOptions, function(err, cumulatedStats) {
      if (err) return callback(err);
      return callback(null, cumulatedStats);
    });
  }

  /** ================================================================================
    * Test various collections
    * ================================================================================ */

  describe('Test collection with images known to have generated scan errors', function() {
    it('Should scan', function(done) {
      return scan("collections/failures/IMG_6399.jpg", function(err, cumulatedStats) {
        if (err) return done(err);
        checkStats(cumulatedStats, 1, 1, 0, 1, 0, 0);
        return done();
      });
    });
    it('Should scan', function(done) {
      return scan("collections/failures/MorinAlexandre_21.jpg", function(err, cumulatedStats) {
        if (err) return done(err);
        checkStats(cumulatedStats, 1, 1, 0, 1, 0, 0);
        return done();
      });
    });
    it('Should scan', function(done) {
      return scan("collections/failures/POSTER - TOMBS OF THE BLIND DEAD (2).JPG", function(err, cumulatedStats) {
        if (err) return done(err);
        checkStats(cumulatedStats, 1, 1, 0, 1, 0, 0);
        return done();
      });
    });
  });


});


