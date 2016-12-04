/**
 * willie-photos - Fingerprints structure unit tests
 *
 * (C) Alexandre Morin 2015 - 2016
 */

var assert = require('assert');

describe('Fingerprints', function() {

  var Fingerprints = require('../js/fingerprints.js').Fingerprints;

  var fp1 = { uuid: "7827c16d-958e-45d4-8144-a779b89dc5f3",   shortFilename: "DSCN0973.JPG",    page:"p1" };
  var fp2 = { uuid: "3e458aa6-e4ab-4c31-98b7-1a3d6e000bf4",   shortFilename: "DSCN0972.JPG",    page:"p2" };
  var fp3 = { uuid: "2a6c7f98-4fdf-4721-ba88-4d108b742d49",   shortFilename: "DSCN0971.JPG",    page:"p3" };
  var fp4 = { uuid: "ace972a3-a918-4755-94e3-d284dc6e4b7d",   shortFilename: "DSCN0970.JPG",    page:"p4" };
  var fp5 = { uuid: "ac7369f2-d44a-4ccf-9567-db125f08a363",   shortFilename: "DSCN0969.JPG",    page:"p5" };

  it('Should append one', function(done) {
    var fpCache = new Fingerprints();
    fpCache.append(fp1);
    assert (fpCache.getFingerprint(fp1.uuid).uuid === fp1.uuid);
    assert (fpCache.getOffset(fp1.uuid) === "p1");
    assert (fpCache.getNextUUID(fp1.uuid) === null);
    assert (fpCache.getLastOffset() === "p1");
    assert (fpCache.getFirstUUID() === fp1.uuid);
    assert (fpCache.getLastUUID() === fp1.uuid);
    return done();
  });

  it('Should append four', function(done) {
    var fpCache = new Fingerprints();
    fpCache.append(fp1);
    fpCache.append(fp2);
    fpCache.append(fp3);
    fpCache.append(fp4);
    assert (fpCache.getFingerprint(fp1.uuid).uuid === fp1.uuid);
    assert (fpCache.getFingerprint(fp2.uuid).uuid === fp2.uuid);
    assert (fpCache.getFingerprint(fp3.uuid).uuid === fp3.uuid);
    assert (fpCache.getFingerprint(fp4.uuid).uuid === fp4.uuid);
    assert (fpCache.getOffset(fp1.uuid) === "p1");
    assert (fpCache.getOffset(fp2.uuid) === "p2");
    assert (fpCache.getOffset(fp3.uuid) === "p3");
    assert (fpCache.getOffset(fp4.uuid) === "p4");
    assert (fpCache.getNextUUID(fp1.uuid) === fp2.uuid);
    assert (fpCache.getNextUUID(fp2.uuid) === fp3.uuid);
    assert (fpCache.getNextUUID(fp3.uuid) === fp4.uuid);
    assert (fpCache.getNextUUID(fp4.uuid) === null);
    assert (fpCache.getPrevUUID(fp1.uuid) === null);
    assert (fpCache.getPrevUUID(fp2.uuid) === fp1.uuid);
    assert (fpCache.getPrevUUID(fp3.uuid) === fp2.uuid);
    assert (fpCache.getPrevUUID(fp4.uuid) === fp3.uuid);
    assert (fpCache.getLastOffset() === "p4");
    assert (fpCache.getFirstUUID() === fp1.uuid);
    assert (fpCache.getLastUUID() === fp4.uuid);
    return done();
  });

  it('Should remove', function(done) {
    var fpCache = new Fingerprints();
    fpCache.append(fp1);
    fpCache.append(fp2);
    fpCache.append(fp3);
    fpCache.append(fp4);
    assert (fpCache.getLastOffset() === "p4");

    // Remove element in the middle => Cache contains fp1, fp3, fp4
    fpCache.remove(fp2.uuid);
    assert (fpCache.getOffset(fp1.uuid) === "p1");
    assert (fpCache.getOffset(fp2.uuid) === undefined);   // undefined because element not in map
    assert (fpCache.getOffset(fp3.uuid) === "p3");
    assert (fpCache.getOffset(fp4.uuid) === "p4");
    assert (fpCache.getNextUUID(fp1.uuid) === fp3.uuid);
    assert (fpCache.getNextUUID(fp2.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getNextUUID(fp3.uuid) === fp4.uuid);
    assert (fpCache.getNextUUID(fp4.uuid) === null);      // null because last item
    assert (fpCache.getPrevUUID(fp1.uuid) === null);      // null because first item
    assert (fpCache.getPrevUUID(fp2.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getPrevUUID(fp3.uuid) === fp1.uuid);
    assert (fpCache.getPrevUUID(fp4.uuid) === fp3.uuid);
    assert (fpCache.getLastOffset() === "p4");
    assert (fpCache.getFirstUUID() === fp1.uuid);
    assert (fpCache.getLastUUID() === fp4.uuid);

    // Remove head element => Cache contains fp3, fp4
    fpCache.remove(fp1.uuid);
    assert (fpCache.getOffset(fp1.uuid) === undefined);   // undefined because element not in map
    assert (fpCache.getOffset(fp2.uuid) === undefined);   // undefined because element not in map
    assert (fpCache.getOffset(fp3.uuid) === "p3");
    assert (fpCache.getOffset(fp4.uuid) === "p4");
    assert (fpCache.getNextUUID(fp1.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getNextUUID(fp2.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getNextUUID(fp3.uuid) === fp4.uuid);
    assert (fpCache.getNextUUID(fp4.uuid) === null);      // null because last item
    assert (fpCache.getPrevUUID(fp1.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getPrevUUID(fp2.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getPrevUUID(fp3.uuid) === null);      // null because first item
    assert (fpCache.getPrevUUID(fp4.uuid) === fp3.uuid);
    assert (fpCache.getLastOffset() === "p4");
    assert (fpCache.getFirstUUID() === fp3.uuid);
    assert (fpCache.getLastUUID() === fp4.uuid);

    // Remove tail element => Cache contains fp3
    fpCache.remove(fp4.uuid);
    assert (fpCache.getOffset(fp1.uuid) === undefined);   // undefined because element not in map
    assert (fpCache.getOffset(fp2.uuid) === undefined);   // undefined because element not in map
    assert (fpCache.getOffset(fp3.uuid) === "p3");
    assert (fpCache.getOffset(fp4.uuid) === undefined);   // undefined because element not in map
    assert (fpCache.getNextUUID(fp1.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getNextUUID(fp2.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getNextUUID(fp3.uuid) === null);      // null because last item
    assert (fpCache.getNextUUID(fp4.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getPrevUUID(fp1.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getPrevUUID(fp2.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getPrevUUID(fp3.uuid) === null);      // null because first item
    assert (fpCache.getPrevUUID(fp4.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getLastOffset() === "p3");
    assert (fpCache.getFirstUUID() === fp3.uuid);
    assert (fpCache.getLastUUID() === fp3.uuid);

    // Remove last element => Cache is empty
    fpCache.remove(fp3.uuid);
    assert (fpCache.getOffset(fp1.uuid) === undefined);   // undefined because element not in map
    assert (fpCache.getOffset(fp2.uuid) === undefined);   // undefined because element not in map
    assert (fpCache.getOffset(fp3.uuid) === undefined);   // undefined because element not in map
    assert (fpCache.getOffset(fp4.uuid) === undefined);   // undefined because element not in map
    assert (fpCache.getNextUUID(fp1.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getNextUUID(fp2.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getNextUUID(fp3.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getNextUUID(fp4.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getPrevUUID(fp1.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getPrevUUID(fp2.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getPrevUUID(fp3.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getPrevUUID(fp4.uuid) === undefined); // undefined because element not in map
    assert (fpCache.getLastOffset() === undefined);
    assert (fpCache.getFirstUUID() === null);
    assert (fpCache.getLastUUID() === null);

    return done();
  });

  it('Should preserve DOM element', function(done) {
    var fpCache = new Fingerprints();
    fpCache.append(fp1);
    fpCache.append(fp2);
    fpCache.append(fp3);
    fpCache.append(fp4);
    fpCache.setDOMElement(fp1.uuid, "dom1");
    fpCache.setDOMElement(fp2.uuid, "dom2");
    fpCache.setDOMElement(fp3.uuid, "dom3");
    fpCache.setDOMElement(fp4.uuid, "dom4");

    assert (fpCache.getDOMElement(fp1.uuid) === "dom1");
    assert (fpCache.getDOMElement(fp2.uuid) === "dom2");
    assert (fpCache.getDOMElement(fp3.uuid) === "dom3");
    assert (fpCache.getDOMElement(fp4.uuid) === "dom4");
    
    fpCache.remove(fp1.uuid);
    assert (fpCache.getDOMElement(fp1.uuid) === undefined);
    assert (fpCache.getDOMElement(fp2.uuid) === "dom2");
    assert (fpCache.getDOMElement(fp3.uuid) === "dom3");
    assert (fpCache.getDOMElement(fp4.uuid) === "dom4");

    fpCache.remove(fp2.uuid);
    assert (fpCache.getDOMElement(fp1.uuid) === undefined);
    assert (fpCache.getDOMElement(fp2.uuid) === undefined);
    assert (fpCache.getDOMElement(fp3.uuid) === "dom3");
    assert (fpCache.getDOMElement(fp4.uuid) === "dom4");

    fpCache.remove(fp3.uuid);
    assert (fpCache.getDOMElement(fp1.uuid) === undefined);
    assert (fpCache.getDOMElement(fp2.uuid) === undefined);
    assert (fpCache.getDOMElement(fp3.uuid) === undefined);
    assert (fpCache.getDOMElement(fp4.uuid) === "dom4");

    fpCache.remove(fp4.uuid);
    assert (fpCache.getDOMElement(fp1.uuid) === undefined);
    assert (fpCache.getDOMElement(fp2.uuid) === undefined);
    assert (fpCache.getDOMElement(fp3.uuid) === undefined);
    assert (fpCache.getDOMElement(fp4.uuid) === undefined);

    return done();
  });

});


