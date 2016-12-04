/**
 * willie-photos
 *
 * Fingerprints data structures.
 * This structure keeps track of the fingerprints loaded and of the following information:
 *  - next and previous fingerprints
 *  - offset (index) of each fingerprint
 *  - first and last fingerprints
 */


function Fingerprints() {

  // Cache fingerprints (key=uuid, value=image/fingerprint)
  // By principles, everytime a fingerprint is loaded from the server, the cache is updated and all functions
  // take uuid as parameters and lookup fingerprints when they need
  this.fingerprintsCache = {};
  this.firstUUID = null;
  this.lastUUID = null;

  // Navigation between items
  // key = uuid
  // value = {
  //    uuid:<uuid>,      The UUID of the item
  //    index:<index>,    The index of the item in this list
  //    next:<uuid>,      The UUID of the next item (or undefined if last)
  //    prev:<uuid>,      The UUID of the previous item (or undefined if first)
  //    $item:<jQuery>,   The jQuery element corresponding to the item
  // }
  this.fingerprintNavigation = {};

  // Is the start or end reached?
  this.endReached = false;
  this.startReached = false;
}

Fingerprints.prototype.setEndReached = function(reached) {
  this.endReached = reached;
}

Fingerprints.prototype.isEndReached = function() {
  return this.endReached;
}

Fingerprints.prototype.setStartReached = function(reached) {
  this.startReached = reached;
}

Fingerprints.prototype.isStartReached = function() {
  return this.startReached;
}

Fingerprints.prototype.reset = function() {
  this.fingerprintsCache = {};
  this.firstUUID = null;
  this.lastUUID = null;
  this.fingerprintNavigation = {};
  this.endReached = false;
  this.startReached = false;
}

Fingerprints.prototype.getFingerprint = function(uuid) {
  return this.fingerprintsCache[uuid];
}

Fingerprints.prototype.getOffset = function(uuid) {
  var nav = this.fingerprintNavigation[uuid];
  if (!nav) return undefined;
  return nav.index;
}

Fingerprints.prototype.getDOMElement = function(uuid) {
  var nav = this.fingerprintNavigation[uuid];
  if (!nav) return undefined;
  return nav.$item;
}

Fingerprints.prototype.setDOMElement = function(uuid, $item) {
  var nav = this.fingerprintNavigation[uuid];
  if (!nav) return undefined;
  nav.$item = $item;
}

Fingerprints.prototype.getNextUUID = function(uuid) {
  var nav = this.fingerprintNavigation[uuid];
  if (!nav) return undefined;
  return nav.next;
}

Fingerprints.prototype.getPrevUUID = function(uuid) {
  var nav = this.fingerprintNavigation[uuid];
  if (!nav) return undefined;
  return nav.prev;
}

Fingerprints.prototype.getFirstUUID = function(uuid) {
  return this.firstUUID;
}

Fingerprints.prototype.getLastUUID = function(uuid) {
  return this.lastUUID;
}

Fingerprints.prototype.getLastOffset = function() {
  return this.getOffset(this.getLastUUID());
}

Fingerprints.prototype.getFirstOffset = function() {
  return this.getOffset(this.getFirstUUID());
}

Fingerprints.prototype.update = function(fingerprint) {
  return this.fingerprintsCache[fingerprint.uuid] = fingerprint;
}

Fingerprints.prototype.append = function(fingerprint) {
  if (this.fingerprintsCache[fingerprint.uuid]) {
    if (console.assert) {
      console.assert(false, "fingerprint " + fingerprint.uuid + " already appended");
    }
    return;
  }
  this.fingerprintsCache[fingerprint.uuid] = fingerprint;
  this.fingerprintNavigation[fingerprint.uuid] = { uuid:fingerprint.uuid, next:null, prev:this.lastUUID, $item:null };
  if (this.lastUUID) this.fingerprintNavigation[this.lastUUID].next = fingerprint.uuid;
  this.lastUUID = fingerprint.uuid;
  if (!this.firstUUID) this.firstUUID = fingerprint.uuid;
  this.fingerprintNavigation[fingerprint.uuid].index = fingerprint.page;
}

Fingerprints.prototype.prepend = function(fingerprint) {
  if (this.fingerprintsCache[fingerprint.uuid]) {
    if (console.assert) {
      console.assert(false, "fingerprint " + fingerprint.uuid + " already prepended");
    }
    return;
  }
  this.fingerprintsCache[fingerprint.uuid] = fingerprint;
  this.fingerprintNavigation[fingerprint.uuid] = { uuid:fingerprint.uuid, next:this.firstUUID, prev:null, $item:null };
  if (this.firstUUID) this.fingerprintNavigation[this.firstUUID].prev = fingerprint.uuid;
  this.firstUUID = fingerprint.uuid;
  if (!this.lastUUID) this.lastUUID = fingerprint.uuid;
  this.fingerprintNavigation[fingerprint.uuid].index = fingerprint.page;
}

Fingerprints.prototype.remove = function(uuid) {
  var nav = this.fingerprintNavigation[uuid];
  if (!nav) return;
  if (uuid === this.firstUUID) this.firstUUID = nav.next;
  if (uuid === this.lastUUID)  this.lastUUID = nav.prev;
  if (nav.next) this.fingerprintNavigation[nav.next].prev = nav.prev;
  if (nav.prev) this.fingerprintNavigation[nav.prev].next = nav.next;
  delete this.fingerprintNavigation[uuid];
  delete this.fingerprintsCache[uuid];
  // ## TODO should find a more efficitent way to proceed
  this._reIndex();
}

// Reindex the navigation
Fingerprints.prototype._reIndex = function() {
  var uuid = this.firstUUID;
  this.lastOffset = undefined;
  var index = 0;
  while (uuid) {
    var nav = this.fingerprintNavigation[uuid];
    if (!nav) break;
    uuid = nav.next;
  }
}


/** ================================================================================
  * Node public interface
  * ================================================================================ */
if (typeof(module) !== "undefined") {
  module.exports = {
    Fingerprints:                 Fingerprints
  };
}
