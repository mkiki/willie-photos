/**
 * Photo Organiser - Utils
 *
 * Linked Hash Map structure
 * This structrue provides semantics similar to the Java LinkedHashMap and maintains a HashMap with insertion iteration order
 *
 * (C) Alexandre Morin 2015 - 2016
 */


// ## This code is duplicated (see willie/src)


function LinkedHashMap() {
  this.clear();
}

// Get item by key
LinkedHashMap.prototype.get = function(key) {
  var item = this.map[key] || {};
  return item.value;
};

// Return the number of element
LinkedHashMap.prototype.length = function() {
  return this.len;
};

// Clear the map
LinkedHashMap.prototype.clear = function() {
  this.map = {};
  this.first = undefined;
  this.last = undefined;
  this.len = 0;
};

// Add key/value item
LinkedHashMap.prototype.add = function(key, value) {
  this.remove(key);
  var item = {
    key: key,
    value: value,
    prev: this.last,
    next: undefined
  };
  if (this.last) {
    this.last.next = item;
  }
  if (!this.first) {
    this.first = item;
  }
  this.last = item;
  this.map[key] = item;
  this.len += 1;
};

// Remove item by key
LinkedHashMap.prototype.remove = function(key) {
  var item = this.map[key];
  if (!item) return;
  if (this.first === item) {
    this.first = item.next;
  }
  if (this.last === item) {
    this.last = item.prev;
  }
  if (item.prev) {
    item.prev.next = item.next;
  }
  if (item.next) {
    item.next.prev = item.prev;
  }
  delete this.map[item.key];
  this.len -= 1;
};

// Iterate over map
// Iterates over elements of the map in insertion order and call the 'fn' function for each item, passing it:
// - the "that" parameter value as the "this" context
// - the item key and item value as parameters
// - expecting "false" return code to abort iteration. Every other return code will be ignored
LinkedHashMap.prototype.each = function(fn, that) {
  var item = this.first;
  while (item !== undefined) {
    var res = fn.call(that, item.key, item.value);
    if (res == false) break;
    item = item.next;
  }
};

LinkedHashMap.prototype.firstKey = function() {
  if (!this.first) return;
  return this.first.key;
}

LinkedHashMap.prototype.lastKey = function() {
  if (!this.last) return;
  return this.last.key;
}


/** ================================================================================
  * Node public interface
  * ================================================================================ */
if (typeof(module) !== "undefined") {
  module.exports = {
    LinkedHashMap:                 LinkedHashMap
  };
}
