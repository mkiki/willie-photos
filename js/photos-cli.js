/**
 * willie-photos - Photos browser page (client-side code)
 */
// (C) Alexandre Morin 2015 - 2016

var debug = false;

var limit = 100;              // Page size (how much image to preload)
var flavor = "1024x200";      // Thumbs flavor for image overview

$addToAlbum = undefined;      // 'Add to album' command
$setCover = undefined;        // 'Set cover' command

// Access to local storage
var configurationManager = new ConfigurationManager();

// Image date is displayed above the images. If several pictures were taken on the same day,
// the date is displayed on top of the first picture only
var lastDate = undefined;

// Selection mode: "browse" or "tag" (default is browse)
// - In "browse" selection mode, clicking on a thumbnail displays the full sized image
// - In "tag" selection mode, an info panel is displayed for the selection, and more thumbnails can be selected (shift, ctrl...)
var selectionMode;

// Current selection
// key=uuid, value=uuid
var selection = new Selection();
var firstVisibleUUID = undefined;
var lastVisibleUUID = undefined;

// Fingerprints cache
var fpCache = new Fingerprints();

// Current filter by tag = uuid of current album
var currentAlbum = undefined;
var currentFilterByTag = undefined;
var currentFilters = undefined;

// Default tags
var defaultTags = [];

// Locks
var loading = false;    // lock for infinite scrolling
var scrolling = false;  // lock to avoid loading image during forced scrolling

$(function() {
  selectionMode = configurationManager.loadSelectionMode();
});


/** ================================================================================
  * Geoloc (Google Maps)
  * ================================================================================ */

// Callback to initialize google map
function initMap() {
}


/** ================================================================================
  * Selection management
  * ================================================================================ */

// Selection object
// This wraps a LinkedHashMap containing the following elements
// - key: image UUID
// - value: structure containing the image UUID and a direction information
// The direction information indicates how this image was added and can be
//      Added by click (direction = 0)
//      Added by keyboard right arrow (direction = 1)
//      Added by keyboard left arrow (direction = -1)
function Selection() {
  this.selection = new LinkedHashMap();
  // The "focus" is some information on the previous last element in the selection. It is used for #13
  // Basically, when the selection is cleared, we can record a previous focus which will be used to 
  // "resume" selection with keyboard arrows
  this.focus = { next:undefined, prev:undefined };
}
Selection.prototype.clear = function(focus) {
  this.selection.clear();
  if (!focus)
    this.focus = { next:undefined, prev:undefined };
  else
    this.focus = focus;
}
Selection.prototype.getFocus = function()   { return this.focus; }
Selection.prototype.length = function()     { return this.selection.length(); }
Selection.prototype.each = function(fn)     { return this.selection.each(function(key, value) { return fn(key); }); }
Selection.prototype.get = function(uuid)    { var value = this.selection.get(uuid); if (value) return value.uuid; }
Selection.prototype.last = function()       { var uuid = this.selection.lastKey(); if (uuid) return this.selection.get(uuid); }

Selection.prototype.remove = function(uuid) { 
  this.selection.remove(uuid);
  var uuid = this.selection.lastKey();
  this.focus = { next:fpCache.getNextUUID(uuid), prev:fpCache.getPrevUUID(uuid) };
}

Selection.prototype.add = function(uuid, addToSelection, direction)  {
  if (!addToSelection) direction = 0;
  var value = { uuid:uuid, direction:direction };
  if (!addToSelection) {
    this.selection.clear();
    this.selection.add(uuid, value);
  }
  else {
    var oldValue = this.selection.get(uuid);
    if (oldValue)
      this.selection.remove(uuid);
    else
      this.selection.add(uuid, value);
  }
  var uuid = this.selection.lastKey();
  this.focus = { next:fpCache.getNextUUID(uuid), prev:fpCache.getPrevUUID(uuid) };
}

function updateSelectionUI(scrollToLastSelected) {
  $(".canvas-image-item--selected").removeClass("canvas-image-item--selected");
  selection.each(function(uuid) {
    var $item = fpCache.getDOMElement(uuid);
    $item.addClass("canvas-image-item--selected");
  });

  displaySelectionInfos();

  var count = selection.length();
  $(".infos").toggle(count > 0 && selectionMode === 'tag');
  if ($addToAlbum) $addToAlbum.toggle(count>0, 100);
  if ($setCover) $setCover.toggle(!!currentFilterByTag && count>0, 100);

  // Scroll to last selected
  if (scrollToLastSelected) {
    var selItem = selection.last();
    if (selItem) var lastUUID = selItem.uuid;
    var $item = fpCache.getDOMElement(lastUUID);
   if ($item) $("#canvas").scrollTo($item, {duration:100} );
  }
}

// Select an item
function select(uuid, addToSelection) {
  //_computeFirstAndLastVisible();
  selection.add(uuid, addToSelection, 0);
  updateSelectionUI(false);
}

// Select the next element
function selectNext(addToSelection) {
  _computeFirstAndLastVisible();
  var selItem = selection.last();
  // No previous selection => select first visible
  if (selItem === undefined) {
    var uuid = selection.getFocus().next;
    if (!uuid) uuid = firstVisibleUUID;
    selection.add(uuid, addToSelection, 1);
    _moveTo(uuid);
  }
  else {
    // Previous selection was made with keyboard left arrow => revert selection
    if (selItem.direction === -1) {
      var uuid = selItem.uuid;
      selection.remove(uuid);
    }
    // Previous selection was made with keyboard right arrow => continue selecting to the right
    else {
      var uuid = fpCache.getNextUUID(selItem.uuid);
      selection.add(uuid, addToSelection, 1);
      _moveTo(uuid);
    }
  }
  updateSelectionUI(true);
}

// Select the previous element
function selectPrevious(addToSelection) {
  _computeFirstAndLastVisible();
  var selItem = selection.last();
  // No previous selection => select first visible
  if (selItem === undefined) {
    var uuid = selection.getFocus().prev;
    if (!uuid) uuid = firstVisibleUUID;
    selection.add(uuid, addToSelection, -1);
    _moveTo(uuid);
  }
  else {
    // Previous selection was made with keyboard right arrow => revert selection
    if (selItem.direction === 1) {
      var uuid = selItem.uuid;
      selection.remove(uuid);
    }
    // Previous selection was made with keyboard left arrow => continue selecting to the left
    else {
      var uuid = fpCache.getPrevUUID(selItem.uuid);
      if (!uuid) {
        if (!fpCache.isStartReached()) {
          var $first = $(".canvas .canvas-image-item:first");          
          return loadMorePrepend($first, function() {
            var uuid = fpCache.getPrevUUID(selItem.uuid);
            if (uuid) {
              selection.add(uuid, addToSelection, -1);
              updateSelectionUI(true);
              _moveTo(uuid);
            }
          });
        }
      }
      else {
        selection.add(uuid, addToSelection, -1);
        _moveTo(uuid);
      }
    }
  }
  updateSelectionUI(true);
}


/** ================================================================================
  * Display image (or images) details
  * ================================================================================ */

// Refresh the info pannel with the information about an image/fingerprint
// Assumes the image is part of the selection
// @param uuid          Is the image uuid
function displaySelectionInfos() {
  var $atts = $(".infos-section-attributes");
  $atts.empty();
  var $tags = $(".infos-section-tags");
  $tags.empty();

  var numberSelected = selection.length();
  $(".infos-section-details").toggle(numberSelected>=1, 100);

  var attrs = {
    shortFilename:  null,
    longFilename:   null,
    dateTime:       null,
    size:           null,
    width:          null,
    height:         null,
    tags:           null,
    latitude:       null,
    longitude:      null,
    ownerName:      null,
  }

  var mergeAttr = function(oldValue, newValue) {
    if (oldValue === null) return newValue;                             // first time
    if (oldValue === undefined) return undefined;                       // no intersection
    if (newValue === undefined || newValue === null) return oldValue;   // no new value
    if (isDate(newValue)) {
      if (oldValue.getTime() === newValue.getTime()) return newValue;
      return undefined;
    }
    else if (isObject(newValue)) {
      var value = {};
      Object.keys(oldValue).forEach(function(k) {
        if (newValue[k] !== undefined) value[k] = newValue[k];
      });
      return value;
    }
    if (newValue === oldValue) return newValue;
    return undefined;
  }
  var merge = function(fingerprint) {
    if (!fingerprint) return;
    attrs.shortFilename = mergeAttr(attrs.shortFilename, fingerprint.shortFilename);
    attrs.longFilename = mergeAttr(attrs.longFilename, fingerprint.longFilename);
    attrs.dateTime = mergeAttr(attrs.dateTime, fingerprint.image.dateTime);
    attrs.size = mergeAttr(attrs.size, fingerprint.size);
    attrs.width = mergeAttr(attrs.width, fingerprint.image.width);
    attrs.height = mergeAttr(attrs.height, fingerprint.image.height);
    attrs.tags = mergeAttr(attrs.tags, fingerprint.tags);
    attrs.latitude = mergeAttr(attrs.latitude, fingerprint.image.latitude);
    attrs.longitude = mergeAttr(attrs.longitude, fingerprint.image.longitude);
    attrs.ownerName = mergeAttr(attrs.ownerName, fingerprint.owner.name);
  }
  selection.each(function(uuid) {
    var fingerprint = fpCache.getFingerprint(uuid);
    merge(fingerprint);
  });

  if( numberSelected > 1)           { $("<div class='infos-section-attributes-attr'></div>").text("" + numberSelected + " images selected").appendTo($atts); }
  if (attrs.shortFilename)          { $("<div class='infos-section-attributes-attr'></div>").text(attrs.shortFilename).appendTo($atts); }
  if (attrs.width && attrs.height)  { $("<div class='infos-section-attributes-attr'></div>").text("" + attrs.width + " x " + attrs.height).appendTo($atts); }
  if (attrs.dateTime)               { $("<div class='infos-section-attributes-attr'></div>").text(moment(attrs.dateTime).format("llll") + " (" + moment(attrs.dateTime).fromNow() + ")").appendTo($atts); }
  if (attrs.ownerName)              { $("<div class='infos-section-attributes-attr'></div>").text("Owned by: " + attrs.ownerName).appendTo($atts); }
  if (attrs.size)                   { $("<div class='infos-section-attributes-attr'></div>").text(formatSize(attrs.size)).appendTo($atts); }
  $("<p>").appendTo($atts);
  if (attrs.longFilename)           { $("<div class='infos-section-attributes-attr'></div>").text(attrs.longFilename).appendTo($atts); }

  var tags = attrs.tags || []; // tags map for quick lookup  
  var allTags = defaultTags.slice(0);
  Object.keys(tags).forEach(function(tagId) {
    if (!isDefaultTag(tagId))
      allTags.push(tags[tagId]);
  });
  allTags = allTags.sort(function(a,b) { return a.name.toLowerCase().localeCompare(b.name.toLowerCase()); });

  if (attrs.latitude && attrs.longitude && (typeof google !== "undefined") && google.maps) {
    $('#map').toggle(true);
    var position = { lat:attrs.latitude, lng:attrs.longitude };
    var map = new google.maps.Map(document.getElementById('map'), {
      center: position,
      zoom: 11,
      mapTypeId: google.maps.MapTypeId.TERRAIN
    });
    var marker = new google.maps.Marker({
      position: position,
      animation: google.maps.Animation.DROP,
      map: map,
      title: 'Hello World!'
    });
  }
  else {
    $('#map').toggle(false);
  }

  for (var i=0; i<allTags.length; i++) {
    var tag = allTags[i];
    var $tag = $("<div class='infos-section-tags-tag'></div>").appendTo($tags);
    if (tags[tag.uuid] !== undefined) $tag.toggleClass('infos-section-tags-tag--selected');
    var name = tag.name;
    if (tag.key) name = name + " (t+" + tag.key + ")";
    $tag.append($("<span></span>").text(name));
    (function(tagId, tagName) {
      $tag.click(function() {
        toggleTagSelection(tagId, tagName, undefined, function() {});
      });
    })(tag.uuid, tag.name);
  }
}


/** ================================================================================
  * Load images, create DOM
  * ================================================================================ */

// Compute the size of a thumbnail
// @param maxWidth is the maximum thumbnail width (driven by the canvas width)
// @param uuid is the fingerprint uuid
// @return a CSS object, with width, height and padding
function computeThumbsize(maxWidth, uuid) {
  var fingerprint = fpCache.getFingerprint(uuid);

  // Compute thumb size and padding
  var width = fingerprint.image.width;
  var height = fingerprint.image.height;
  // ## TODO This should be done server-side
  if (fingerprint.image.orientation && fingerprint.image.orientation >= 5 && fingerprint.image.orientation <= 8) {
    width = fingerprint.image.height;
    height = fingerprint.image.width;
  }
  width = Math.floor((width / height) * 200);
  height = 200;
  var padding = 0;
  if (width > maxWidth) {
    padding = height; // old height
    height = height * maxWidth / width;
    width = maxWidth;
    padding = (padding - height)/2;
  }
  return { width:width, height:height, paddingTop:padding };
}

 // Add an image/fingerprint item to the DOM
 // @param uuid          Is the image uuid
 // @return              The jQuery element to be added
 //
 // Short description of the positioning of images
 // - Each image is displayed in a contained with 'canvas-image-item' class
 // - Image size is computed as follows
 //       1/ Make sure image has the right orientation (should should have been done server-side)
 //       2/ Maximum image width is computed based on canvas width
 //       3/ If image width fits in canvas, then thumb height is forced to 200 and thumb width is computed accordingly
 //       4/ If image width does not fit in canvas, thumb height is reduced and vertical padding is added so that thumb width fits in canvas 
 
function addImagesItem(uuid) {
  var $canvas = $("#canvas");
  var maxWidth = $canvas.width()-16;

  var fingerprint = fpCache.getFingerprint(uuid);

  // Create image thumb DOM
  var $item = $("<div class='canvas-image-item'></div>");
  //$item.data("uuid", uuid);
  var $date = $("<div class='canvas-image-item-date'></div>").appendTo($item);
  var $thumb = $("<div class='canvas-image-item-thumb'></div>").appendTo($item);
  var $img = $("<img class='canvas-image-item-image'></img>");
  $img.css(computeThumbsize(maxWidth, uuid));
  if (fingerprint.image && fingerprint.image.dominantColor && fingerprint.image.dominantColor.length>0)
    $img.css('backgroundColor', fingerprint.image.dominantColor);

  //$img.css({ width:width, height:height, paddingTop:padding });
  $img.appendTo($thumb);
  if (fingerprint.image.hdr) {
    var $hdr = $("<div class='hdr-tag'></div>").text("HDR");
    $hdr.appendTo($thumb);
  }
  var $hidden = $("<div class='hidden-tag'></div>").text("Hidden").toggle(fingerprint.hidden);
  $hidden.appendTo($thumb);

  // Create DOM for image captions
  var dateTime = fingerprint.image.dateTime;
  if (dateTime) {
    var newDate = moment(dateTime).format("YYYYMMDD");
    if (lastDate !== newDate) {
      if (lastDate !== undefined) {
        $(canvas).append($("<hr></hr>"))
      }
      lastDate = newDate;
      $date.addClass("canvas-image-item-date--hasDate").text(moment(dateTime).format("ll"));
    }
  }
  $("<div class='canvas-image-item-uuid'></div>").text(fingerprint.uuid).appendTo($item);
  $("<div class='canvas-image-item-uuid'></div>").text(fingerprint.shortFilename).appendTo($item);
  if (fingerprint.image.dateTime) {
    var ts = moment(fingerprint.image.dateTime).format("dddd, MMMM Do YYYY, h:mm:ss a");
    if (ts.length>0)
      $("<div class='canvas-image-item-timestamp'></div>").text(ts).appendTo($item);
  }

  var $click = $img;
  // If the image as frames, it is an animation => overlay a play button
  if (fingerprint.image.framesCount && fingerprint.image.framesCount > 1) {
    var $play = $("<div class='canvas-image-item-play'></div>").appendTo($thumb);
    $play.css(computeThumbsize(maxWidth, uuid));
    $click = $play;
  }

  // Bind click and double click events
  $click.click(function(event) {
    if (selectionMode === 'tag') {
      var addToSelection = event.shiftKey;
      return select(uuid, addToSelection);
    }
    _navigator(uuid);
  });

  $click.dblclick(function(event) {
    _navigator(uuid);
  });
  return $item;
}

// Display an image in the navigator
function _navigator(uuid) {
  var url = "/photos/navigator.html?offset=" + encodeURIComponent(fpCache.getOffset(uuid));
  if (currentFilterByTag) url = url + "&tag=" + encodeURIComponent(currentFilterByTag);
  window.location = url;
}

// Load more images (infinite scrolling)
function loadMore(settings, callback) {
  if (loading) return callback();
  loading = true;
  console.log("Loading more images", settings);
  var url = getImagesURL(settings.offset, settings.limit, currentFilterByTag, currentFilters);

  return ajax({
    type: 'GET',
    url: url,
    dataType: 'json',
    success: function(fingerprints) {
      if (fingerprints) {
        var $canvas = $("#canvas");
        var shortRead = fingerprints.length < Math.abs(settings.limit); // Did we read everything?

        if (settings.where === 'prepend') {
          for (var i=0; i<fingerprints.length; i++) {
            var fingerprint = fingerprints[i];
            fpCache.prepend(fingerprint);
            var $item = addImagesItem(fingerprint.uuid);
            $canvas.prepend($item);
            fpCache.setDOMElement(fingerprint.uuid, $item);
          }
          fpCache.setStartReached(shortRead);
        }
        else if (settings.where === 'append') {
          for (var i=0; i<fingerprints.length; i++) {
            var fingerprint = fingerprints[i];
            fpCache.append(fingerprint);
            var $item = addImagesItem(fingerprint.uuid);
            $canvas.append($item);
            fpCache.setDOMElement(fingerprint.uuid, $item);
          }
          fpCache.setEndReached(shortRead);
        }
      }

      loading = false;
      return callback(/*loaded*/);
    },
    error: function(jqxhr, textStatus, error) {
      loading = false;
      flashError("Failed to load more images", jqxhr.status);
      return callback();
    }
  });
}

// Load images visible in the viewport
function _loadVisibleImages() {
  // do not load anything if currently in forced scrolling
  if (scrolling) return;
  _computeFirstAndLastVisible();
  var $canvas = $("#canvas");
  var maxWidth = $canvas.width()-16;
  // iterate over images visible in viewport
  var uuid = firstVisibleUUID;
  while (uuid) {
    var fingerprint = fpCache.getFingerprint(uuid);
    var $item = fpCache.getDOMElement(uuid);
    // Check if item is still visible
    var viewTop = $("#canvas").scrollTop();
    var viewBottom = viewTop + $("#canvas").height();
    var canvasTop = $("#canvas").position().top;
    var offsetTop = viewTop - canvasTop;
    var top = $item.position().top + offsetTop;
    var bottom = top + $item.height();
    var visible = (bottom >= viewTop && top <= viewBottom);
    if (visible) {
      // Update 'src' attribute to reload
      var $img = $('img', $item);
      var size = computeThumbsize(maxWidth, uuid);
      $img.css(size);
      var $play = $('.canvas-image-item-play', $item);
      $play.css(size);

      if (fingerprint.image && fingerprint.image.dominantColor && fingerprint.image.dominantColor.length>0)
        $img.css('backgroundColor', fingerprint.image.dominantColor);
      var src = $img.attr('src');
      if (!src) {
        $img.attr("src", "/photos/thumb/" + flavor + "/" + fingerprint.uuid);
      }
    }
    if (uuid === lastVisibleUUID) break;
    uuid = fpCache.getNextUUID(uuid);
  }  
}


/**
 * Is an item visible?
 */
 /*
function _isVisible($item) {
  var viewTop = $("#canvas").scrollTop();
  var viewBottom = viewTop + $("#canvas").height();
  var canvasTop = $("#canvas").position().top;
  var offsetTop = viewTop - canvasTop;

  var top = $item.position().top + offsetTop;
  var bottom = top + $item.height();
  return bottom > viewTop && top < viewBottom;
}
*/

/**
 * Compute first and last visible items in view
 * To optimize, will start looking from previous known position
 */
function _computeFirstAndLastVisible() {
  var viewTop = $("#canvas").scrollTop();
  var viewBottom = viewTop + $("#canvas").height();
  var canvasTop = $("#canvas").position().top;
  var offsetTop = viewTop - canvasTop;

  var isVisible = function($item) {
    var top = $item.position().top + offsetTop;
    var bottom = top + $item.height();
    return bottom > viewTop && top < viewBottom;
  }

  var startingUUID = firstVisibleUUID;
  var uuid = firstVisibleUUID;
  if (uuid === undefined) uuid = fpCache.getFirstUUID();
  
  firstVisibleUUID = undefined;
  var direction = -1;
  var visible = false;

  // Start from previously known visible uuid. It may not exist because it may have been removed...
  var $item = fpCache.getDOMElement(uuid);
  if ($item) {
    var top = $item.position().top + offsetTop;
    var bottom = top + $item.height();
    if (bottom > viewTop && top < viewBottom) {
      direction = -1;   // look for any previous visible element
      visible = true;   // start in visible state
    }
    else if (bottom <= viewTop) {
      // element is before viewport => look down
      direction = 1;    // look for any future visible element
      visible = false;  // start in non-visible state
    }
    else {
      // element is after viewport => look up
      direction = -1;   // look for any previous visible element
      visible = false;  // start in non-visible state
    }

    // look for any previous visible element
    if (direction === -1) {
      // Move up until we find a visible element
      while (!visible) {
        uuid = fpCache.getPrevUUID(uuid);
        if (!uuid) break; // not found
        $item = fpCache.getDOMElement(uuid);
        visible = isVisible($item);
      }
      // Continue moving up until finding an item not visible or reaching the top
      while(visible) {
        firstVisibleUUID = uuid;
        uuid = fpCache.getPrevUUID(uuid);
        if (!uuid) break; // not found
        $item = fpCache.getDOMElement(uuid);
        visible = isVisible($item);
      }
    }
    // look for any following visible element
    else if (direction === 1) {
      // Move down until we find a visible element
      while (!visible) {
        uuid = fpCache.getNextUUID(uuid);
        if (!uuid) break; // not found
        $item = fpCache.getDOMElement(uuid);
        visible = isVisible($item);
      }
      if (visible) firstVisibleUUID = uuid;
    }
  }

  // Now lookup for last visible item
  lastVisibleUUID = undefined;
  if (firstVisibleUUID) {
    visible = true;
    uuid = firstVisibleUUID;
    while(visible) {
      lastVisibleUUID = uuid;
      uuid = fpCache.getNextUUID(uuid);
      if (!uuid) break; // not found
      $item = fpCache.getDOMElement(uuid);
      visible = isVisible($item);
    }
  }

  // Overlay debug infos
  if (debug) {
    $(".debug").toggle(true, 100);
    $(".canvas-image-item").toggleClass('first', false).toggleClass('last', false);
    var html = "view: top=" + viewTop + ", bottom=" + viewBottom +
        "<br>Starting from: " + startingUUID +
        "<br>First uuid: " + firstVisibleUUID +
        "<br>Last uuid: " + lastVisibleUUID;
    $item = fpCache.getDOMElement(firstVisibleUUID);
    if ($item) {
      $item.toggleClass('first', true)
      var top = $item.position().top + offsetTop;
      var bottom = top + $item.height();
      html = html + "<br>First Item position: " + top + ", " + bottom;
    }  
    $item = fpCache.getDOMElement(lastVisibleUUID);
    if ($item) {
      $item.toggleClass('last', true);
      var top = $item.position().top + offsetTop;
      var bottom = top + $item.height();
      html = html + "<br>Last Item position: " + top + ", " + bottom;
    }  
    $("#debug").html(html);
  }

  if (firstVisibleUUID) {
    var firstVisible = { uuid:firstVisibleUUID, index: fpCache.getOffset(firstVisibleUUID) }
    configurationManager.saveFirstVisible(currentFilterByTag, firstVisible);
  }
}


/** ================================================================================
  * Action: add/remove tag
  * ================================================================================ */

// Toggle a tag for the selection (for all selected images)
// @param tag       Is the tag name
// @param selected  true => force adding tag
//                  false => force removing tag
//                  undefined => toggle tag
// @param callack   is the return message/code
function toggleTagSelection(tag, tagName, selected, callback) {
  runWithWait(
    function(callback) {
      return _privToggleTagSelection(tag, tagName, selected, function(err) {
        return callback(err);
      });
    },
    $('body'),
    function(err) {
      return callback(err);
    }
  );
}

function _privToggleTagSelection(tag, tagName, selected, callback) {
  console.log("Toggling tag", tag);

  if (selected === undefined) {
    var allTagged = true;   // are all selected images already tagged?
    var noneTagged = true;  // are none of the selected images already tagged?
    var count = 0;
    selection.each(function(uuid) {
      var fingerprint = fpCache.getFingerprint(selection.get(uuid));
      if (!fingerprint) return;
      count = count + 1;
      var hasTag = fingerprint.tags[tag] !== null && fingerprint.tags[tag] !== undefined;
      if (!hasTag) allTagged = false;
      if (hasTag) noneTagged = false;
    });
    if (count === 0) return; // nothing selected => nothing to do
    var shouldHaveTag = true;
    if (allTagged) shouldHaveTag = false;
    selected = shouldHaveTag;
  }
  // Compute patch
  var patch = [];
  selection.each(function(uuid) {
    var fingerprint = fpCache.getFingerprint(selection.get(uuid));

    if (fingerprint) {
      var hasTag = fingerprint.tags[tag] !== null && fingerprint.tags[tag] !== undefined;
      if (selected && !hasTag) {
        patch.push({ uuid:uuid, op:"add", path:"/tags/" + tag , value: [ {name:tag} ] });
      }
      else if (!selected && hasTag) {
        patch.push({ uuid:uuid, op:"remove", path:"/tags/" + tag , value: [ {name:tag} ] });
      }
    }
  });
  // Apply tag change through an ajax call
  return _patchImages(patch, function(err) {
    if (!err ) {
      if (selected) flash("Tag [" + tagName + "] set"); else flash("Tag [" + tagName + "] removed");
    }
    return callback(err);
  });
}


/** ================================================================================
  * Display refresh
  * ================================================================================ */


// Refresh all
function refresh() {
  console.log("Refreshing display");
  fpCache.reset();
  selection.clear();
  updateSelectionUI();
  lastDate = undefined;

  var offset = undefined;
  var count = limit;

  // Reposition to last known offset
  var previous = configurationManager.loadFirstVisible(currentFilterByTag);
  if (previous) {
    offset = previous.index;
    if (offset && (typeof offset) === "number") {
      // Offset used to be a number, and now is a string
      offset = undefined;
    }
  }

  var $canvas = $("#canvas");
  $canvas.children().remove();
  $canvas.empty();

  if (offset) offset = "=" + offset; // "=" means inclusive


  loadMore({ offset:offset, limit:limit, where:'append' }, function() {});
}



// Move (scroll) to an item
// @param uuid    is the uuid of the item to scroll to
function _moveTo(uuid) {
  console.log("Moving to", uuid);
  // Check if item is visible
  var $item = fpCache.getDOMElement(uuid);
  if ($item === undefined) {
    // Could not find the navigation item
    _loadVisibleImages();
    return;
  }

  var $canvas = $(".canvas");
  var marginTop = parseInt($canvas.css("marginTop"),10);
  var top = $item.offset().top - $canvas.offset().top + marginTop;
  if (top < 0) {
    var height = $item.height();
    wheelPos = -marginTop - height;
    scrollTo(wheelPos, true);
  }
  else {
    var h = $(".canvap").height() - $item.height();
    if (top >= h ) {
      wheelPos = -marginTop + h;
      scrollTo(wheelPos, true);      
    }
  }
}


/** ================================================================================
  * Action: rescan collection
  * ================================================================================ */

// Force to rescan selection
function rescanSelection() {
  _rescanSelectionNext(Object.keys(selection), function(err) {
    if (err) flashError("Failed to rescan selection");
    else flash("Selection scanned again");
  });
}
function _rescanSelectionNext(keys, callback) {
  if (keys.length === 0) return callback(); 
  var uuid = keys.shift();
  var fingerprint = fpCache.getFingerprint(selection.get(uuid));
  if (!fingerprint) return _rescanSelectionNext(keys, callback);
  // Apply tag change through an ajax call
  var patch = [ { uuid:uuid, op:"rescan" } ];
  return _patchImages(patch, function(err) {
    if (err) return callback(err);
    return _rescanSelectionNext(keys, callback);
  });
}


/** ================================================================================
  * Action: show/hide images
  * ================================================================================ */

// Hide rescan selection
function hideSelection() {
  var numberSelected = selection.length();
  if (numberSelected === 0) return; // no selection
  var patch = [];
  selection.each(function(uuid) {
    patch.push({ uuid:uuid, op:"replace", path:"hidden", value:true }); 
  });
  return _patchImages(patch, function(err) {
    if (!err) {
      var currentFilterShowHidden = currentFilters.currentFilterShowHidden;

      selection.each(function(uuid) {
        var $item = fpCache.getDOMElement(uuid);
        // Hide images or show "Hidden" caption depending on whether hidden images are displayed or not
        if (!currentFilterShowHidden) {
          $item.toggle(false, 100, function() {
            $item.remove();
          });
          
          var last = selection.last().uuid;
          var focus = { next:fpCache.getNextUUID(last), prev:fpCache.getPrevUUID(last) };
          selection.clear(focus);
          fpCache.remove(uuid);
        }
        else {
          $(".hidden-tag", $item).toggle();
        }
      });
    }
  });
}


/** ================================================================================
  * Action: set album cover
  * ================================================================================ */

// Set Album Cover
function setAlbumCover() {
  if (!currentFilterByTag || currentFilterByTag.length===0)
    return; // no curent album
  setAlbumCoverNext(Object.keys(selection), function() {
    flash("Album cover set");
  });
}
function setAlbumCoverNext(keys, callback) {
  if (keys.length === 0) return callback(); 
  var uuid = keys.shift();
  var fingerprint = fpCache.getFingerprint(selection.get(uuid));
  if (!fingerprint) return setAlbumCoverNext(keys, callback);
  // Apply tag change through an ajax call
  var patch = { patch: [ { op:"replace", path:"coverId", value:uuid } ] };
  return _patchAlbum(uuid, patch, function() {
    return callback(); // Stop at fist element in selection
  });
} 

// Set Album Name
function setAlbumName(name) {
  if (!currentFilterByTag || currentFilterByTag.length===0)
    return; // no curent album
  var patch = { patch: [ { op:"replace", path:"name", value:name } ] };
  return _patchAlbum(currentFilterByTag, patch, function() {
    var fnChangeTagName = function(tags) {
      Object.keys(tags).forEach(function(tagId) {
        if (tagId === currentFilterByTag) {
          tags[tagId].name = name;
          return;
        }
      });
    }
    // Iterate over cached image and apply change
    Object.keys(fingerprintsCache).forEach(function(uuid) {
      var fingerprint = fpCache.getFingerprint(uuid);
      var tags = fingerprint.tags;
      fnChangeTagName(tags);
    });
    fnChangeTagName(defaultTagsMap);
    displaySelectionInfos();
  });
} 


/** ================================================================================
  * Actions: generic image/album patch
  * ================================================================================ */

// Patch image
function _patchImages(patch, callback) {
  if (!patch || patch.length === 0) {
    displaySelectionInfos();
    return callback();
  }
  // Split patch into smaller patches of maximum 100 items (Issue #24)
  var smallPatch = patch.splice(0, 100);
  return ajax({
    type: 'PATCH',
    url: '/photos/images/',
    data: {patch: smallPatch},
    dataType: 'json',
    success: function(fingerprints) {
      if (fingerprints) {
        for (var i=0; i<fingerprints.length; i++) {
          var fingerprint = fingerprints[i];
          fpCache.update(fingerprint);
        }        
      }
      return _patchImages(patch, callback);
    },
    error: function(jqxhr, textStatus, error) {
      flashError("Failed to patch image(s)", jqxhr.status);
      return callback(error);
    }
  });  
}

// Patch album
function _patchAlbum(uuid, patch, callback) {
  if (!patch) return callback();
  ajax({
    type: 'PATCH',
    url: '/photos/album/' + currentFilterByTag,
    data: patch, 
    dataType: 'json',
    success: function(album) {
      return callback();
    },
    error: function(jqxhr, textStatus, error) {
      flashError("Failed to patch album", jqxhr.status);
      return callback();
    }
  });  
}



/** ================================================================================
  * 
  * ================================================================================ */

/**
 * Compute a map with default tages to allow quick lookup of tags
 */
defaultTagsMap = {};
function isDefaultTag(tagId) {
  return defaultTagsMap[tagId] !== undefined;
}
function getDefaultTags(callback) {
  return ajax({
    type: 'GET',
    url: '/photos/defaultTags',
    dataType: 'json',
    success: function(tags) {
      defaultTags = tags;
      defaultTagsMap = {};
      for (var i=0; i<defaultTags.length; i++) {
        var tag = defaultTags[i];
        defaultTagsMap[tag.uuid] = tag;
      }
      return callback();
    },
    error: function(jqxhr, textStatus, error) {
      defaultTags = [];
      defaultTagsMap = {};
      flashError("Failed to load default tags", jqxhr.status);
      return callback();
    }
  });
}


/** ================================================================================
  * Actions: add an image or images to an album
  * ================================================================================ */

/**
 * Add to album command : add the current selection to the current album
 */
function addToAlbum() {
  var modal = openDialog({title:'Add to album'}, function($body) {
    ajax({
      type: 'GET',
      url: '/photos/albums/byName',
      dataType: 'json',
      success: function(albums) {
        if (albums !== null && albums !== undefined && albums.length > 0) {
          _selectorAddAlbumRow(modal, null);
          for (var i=0; i<albums.length; i++) {
            var album = albums[i];
            _selectorAddAlbumRow(modal, album);
          }
        }
      },
      error: function(jqxhr, textStatus, error) {
        modal.close();
        flashError("Failed to get album list", jqxhr.status);
      }
    });
  });
}


/** ================================================================================
  * Album picker
  * ================================================================================ */

// Insert a new row in the album picker
// @param modal is the modal (dialog)
// @param album is the album for which to add a row. If null or undefined, a "New album" row will be created
function _selectorAddAlbumRow(modal, album) {
  var $body = modal.$body;
  var $row = $('<div class="selector-row"></div>');
  var $icon = $('<div class="selector-row-icon"></div>').appendTo($row);
  var $name = $('<div class="selector-row-name"></div>').appendTo($row);
  var $title = $('<div class="selector-row-name-title"></div>').appendTo($name);
  var $details = $('<div class="selector-row-name-details"></div>').appendTo($name);
  if (album) {
    $title.text(album.name);
    $details.text(album.imageCount + " éléments");
    if (album.cover && album.cover.uuid) {
      var $img = $('<img></img>').appendTo($icon);
      $img.attr('src', '/photos/thumb/40/' + album.cover.uuid);
    }
  }
  else {
    var $circle = $('<div class="selector-row-icon-new-album"></div>').appendTo($icon);
    createSetCoverIcon().appendTo($circle);
    $title.text("New album");
  }
  $row.click(function() {
    if (album) {
      var tagId = album.uuid;
      return toggleTagSelection(tagId, album.name, true, function(err) {
        //window.location = "/photos/photos.html?tag=" + encodeURIComponent(tagId);
        modal.close();
      });      
    }
    else {
      return ajax({
        type: 'POST',
        url: '/photos/album',
        data: { name:'Sans titre' },
        dataType: 'json',
        success: function(album) {
          if (album) {
            var tagId = album.uuid;
            return toggleTagSelection(tagId, album.name, true, function(err) {
              if (!err) window.location = "/photos/photos.html?tag=" + encodeURIComponent(tagId);
            });
          }
        },
        error: function(jqxhr, textStatus, error) {
          flashError("Failed to create album", jqxhr.status);
        }
      }); 
    }
  });
  $row.appendTo($body);    
}


/** ================================================================================
  * 
  * ================================================================================ */

// Load (asynchronously) the current album info (if any)
function _loadCurrentAlbumInfo(callback) {
  currentAlbum = undefined;
  if (!!currentFilterByTag) {
    return ajax({
      type: 'GET',
      url: '/photos/album/' + currentFilterByTag,
      dataType: 'json',
      success: function(album) {
        currentAlbum = album;
        _setAlbumName();
        return callback();
      },
      error: function(jqxhr, textStatus, error) {
        flashError("Failed to load information about current album", jqxhr.status);
        return callback();
      }
    });
  }
  _setAlbumName();
  return callback();
}

function _setAlbumName() {
  var album = currentAlbum;
  var name = "All photos";
  var title = name;
  var color = undefined;
  if (album) {
    name = album.name;
    title = "Photos - " + album.name;
    color = album.color;
  }

  var subTitle = [];
  var currentFilterByYear = currentFilters.currentFilterByYear;
  if (currentFilterByYear) {
    var currentYear = moment().year();
    if (currentFilterByYear.from && currentFilterByYear.to)
      subTitle.push("from " + currentFilterByYear.from + " to " + currentFilterByYear.to);
    else if (currentFilterByYear.to && currentFilterByYear.to !== currentYear)
      subTitle.push("up to " + currentFilterByYear.to);
  }
  var currentFilterShowHidden = currentFilters.currentFilterShowHidden;
  if (currentFilterShowHidden) {
    subTitle.push("Hidden files included");
  }

  $(".album-name").toggleClass("album-name--editable", currentFilterByTag && currentFilterByTag.length>0);
  if( !currentFilterByTag || currentFilterByTag.length === 0) $('.album-name').attr('readonly', 'readonly');
  $(".album-name").val(name);
  $(".album-subtitle").text(subTitle.join(" · "));
  document.title = title;
  if (color) {
    $("#menu").css({ backgroundColor:color });
  }
}

// Load (asynchronously) the list of default tags
function _loadDefaultTags(callback) {
  return getDefaultTags(function() {
    // Setup kyboard shortcuts for default tags
    // If the key 't' and a tag key (ex: 's' for Selfies) are pressed together, then it toggles the corresponding tag
    for (var i=0; i<defaultTags.length; i++) {
      var tag = defaultTags[i];
      var sequence = "t+" + tag.key;
      (function(tag) {
        keyboardJS.bind([sequence], function() { toggleTagSelection(tag.uuid, tag.name, undefined, function(){}); });
      })(tag);
    }
    return callback();
  });
}


/** ================================================================================
  * Image loading
  * ================================================================================ */
var wheelPos = 0;
//var canvas = document.getElementById("canvas");
var lockLoading = false;
var lastWheel = 0;
var lastWheelPos = -1;

function shouldLoadMoreAppend() {
  if (fpCache.isEndReached()) return;
  var $canvas = $(".canvas");
  var $last = $(".canvas .canvas-image-item:last");
  if (!$last.offset()) return;
  var top = $last.offset().top - $canvas.offset().top + parseInt($canvas.css("marginTop"),10)
  var h = $(".canvap").height();
  return (!lockLoading && top <= h);
}
function shouldLoadMorePrepend($first) {
  if (fpCache.isStartReached()) return;
  var $canvas = $(".canvas");
  if (!$first.offset()) return;
  var top = $first.offset().top - $canvas.offset().top + parseInt($canvas.css("marginTop"),10)
  return (!lockLoading && top > 0);
}
function loadMoreAppend(callback) {
  lockLoading = true;
  var offset = fpCache.getLastOffset();
  if (offset) offset = "<" + offset; // ">" means non inclusive
  return loadMore({ offset:offset, limit:limit, where:'append' }, function() {
    lockLoading = false;
    _loadVisibleImages();
    if (shouldLoadMoreAppend())
      return loadMoreAppend(callback);
    return callback();
  });  
}
function loadMorePrepend($first, callback) {
  var $canvas = $(".canvas");
  lockLoading = true;
  var offset = fpCache.getFirstOffset();
  if (offset) offset = "<" + offset; // ">" means non inclusive
  return loadMore({ offset:offset, limit:-limit, where:'prepend' }, function() {
    lockLoading = false;
    var newTop = $first.offset().top - $canvas.offset().top + parseInt($canvas.css("marginTop"),10)
    wheelPos = newTop;
    var canvas = document.getElementById("canvas");
    scrollTo(wheelPos);
    _loadVisibleImages();
    if (shouldLoadMorePrepend($first))
      return loadMorePrepend($first, callback);
    return callback();
  });
}

function wheel() {
  lastWheel = Date.now();
  if (lastWheelPos != wheelPos) {
    lastWheelPos = wheelPos;
    if (shouldLoadMoreAppend()) {
      return loadMoreAppend(function() {});
    }
    var $first = $(".canvas .canvas-image-item:first");
    if (shouldLoadMorePrepend($first)) {
      return loadMorePrepend($first, function() {});
    }
  }
  _loadVisibleImages();
}

function scrollTo(pos, animate) {
  if (animate) {
    $(".canvas").animate({marginTop: -pos}, 100, function() {
    });
  }
  else {
    canvas.style.marginTop = (-pos) + "px";
  }
}


/** ================================================================================
  * Main
  * ================================================================================ */
$(function() {

  var menus = [].concat(document.sideMenu);

  // Decode parameters
  // - 'tag'  (optional) is the tag id (album uuid) to filter with
  currentFilterByTag = getUrlParameter('tag');
  if (currentFilterByTag) currentFilterByTag = decodeURIComponent(currentFilterByTag);
  // Load filters
  currentFilters = configurationManager.loadFilters();

  // Load (asynchronously) the current album info (if any)
  _loadCurrentAlbumInfo(function() {
    refresh();
  });
  _loadDefaultTags(function() {
  });

  // 'Mode' command
  var $toggleMode = $('<div class="menu-command" original-title="Selection mode"></div>').toggle(true);
  $toggleMode.toggleClass('menu-command--selected', selectionMode === 'tag');  
  $toggleMode.append(createModeIcon);
  $toggleMode.tipsy({ gravity:'w' });
  $toggleMode.click(function() {
    if (selectionMode === 'browse') selectionMode = 'tag';
    else selectionMode = 'browse';
    $toggleMode.toggleClass('menu-command--selected', selectionMode === 'tag');  
    configurationManager.saveSelectionMode();
    if (selectionMode === 'browse') {
      selection.clear();
      updateSelectionUI();
    }
  });
  menus.push({ $command:$toggleMode, index:120 });


  // 'Create Album' command
  $addToAlbum = $('<div class="menu-command" original-title="Create new Album"></div>').toggle(false);
  $addToAlbum.append(createCreateIcon);
  $addToAlbum.tipsy({ gravity:'w' });
  $addToAlbum.click(function() {
    addToAlbum();
  });
  menus.push({ $command:$addToAlbum, index:130 });

  // 'Delete Album' command
  $deleteAlbum = $('<div class="menu-command" original-title="Delete album"></div>').toggle(!!currentFilterByTag);
  $deleteAlbum.append(createDeleteIcon);
  $deleteAlbum.tipsy({ gravity:'w' });
  $deleteAlbum.click(function() {
    ajax({
      url: '/photos/album/' + encodeURIComponent(currentFilterByTag), 
      type: 'DELETE',
      success: function(result) {
        window.location = '/photos/photos.html';
      },
      error: function(jqxhr, textStatus, error) {
        flashError("Failed to delete album", jqxhr.status);
      }
    });
  });
  menus.push({ $command:$deleteAlbum, index:140 });

  // 'Set Cover' command
  $setCover = $('<div class="menu-command" original-title="Set as cover"></div>').toggle(false);
  $setCover.append(createSetCoverIcon);
  $setCover.tipsy({ gravity:'w' });
  $setCover.click(function() {
    setAlbumCover();
  });
  menus.push({ $command:$deleteAlbum, index:150 });

  createMenu(menus, "photos"); 

  // Add a close icon to the infos pannel
  createCloseIcon().appendTo(".infos-close").click(function() {
    $(".infos").toggle(false);
  });

  var $slider = $(".filter-years-slider");
  $slider.on('change', function(v) {
    var newValue = v.value.newValue;
    var from = newValue[0];
    var to = newValue[1];
    if (from <= 1990) from = undefined;
    currentFilters.currentFilterByYear = { from:from, to:to };
    configurationManager.saveFilters(currentFilters);
  });
  var $hidden = $("#filterByHidden");
  $hidden.on('change', function(v) {
    var checked = $hidden[0].checked;
    currentFilters.currentFilterShowHidden = checked;
    configurationManager.saveFilters(currentFilters);
  });
  //var $refresh = $('<button class="filter-refresh">Refresh</button>').appendTo($filters);
  var $refresh = $('.filter-refresh');
  $refresh.click(function() {
    _toggleHamburger(false);
    refresh();
  });

  // Initilize side menu
  var $filters = $("#menu-filters").toggle(false);
  // Initialize slider (to filter by year range)
  var $slider = $(".filter-years-slider");
  var maxYear = moment().year();
  var currentFilterByYear = currentFilters.currentFilterByYear;
  var from = 1990; if (currentFilterByYear && currentFilterByYear.from) from = currentFilterByYear.from;
  var to = maxYear; if (currentFilterByYear && currentFilterByYear.to) to = currentFilterByYear.to;
  $slider.slider({
    min: 1990,
    max: maxYear,
    step: 1,
    tooltip: 'always',
    value: [from, to]
  });
  // Initialize checkbox (to filter by hidden images)
  var $hidden = $("#filterByHidden");
  var currentFilterShowHidden = currentFilters.currentFilterShowHidden;
  var value = !!currentFilterShowHidden;
  $hidden[0].checked = value;

  keyboardJS.bind('z', function() { rescanSelection(); });
  keyboardJS.bind('h', function() { hideSelection(); });
  keyboardJS.bind('c', function() { setAlbumCover(); }); 

  $(".album-name").keypress(function(e) { e.stopPropagation(); });
  $(".album-name").keydown(function(e) { e.stopPropagation(); });
  $(".album-name").keyup(function(e) { e.stopPropagation(); });
  $(".album-name").change(function(e) {
    e.stopPropagation();
    var name = $(".album-name").val();
    setAlbumName(name);
  });

  $(document).keydown(function(e) {
    var addToSelection = e.shiftKey;
    switch(e.which) {
      case KEY_RIGHT_ARROW: {
        e.stopPropagation(); 
        return selectNext(addToSelection);
      }
      case KEY_LEFT_ARROW: {
        e.stopPropagation(); 
        return selectPrevious(addToSelection);
      }
      case KEY_ESCAPE: {
        e.stopPropagation();
        _toggleHamburger(false);
      }
    }
  });



setInterval(function() {
  wheel();
}, 250);

var canvas = document.getElementById("canvas");
document.onwheel = function(e) {
  var delta = e.deltaY;
  if (delta !== 0 ) {
    if (delta < 0 && fpCache.isStartReached()) {
      if (wheelPos < 0) delta = 0;
    }
    if (delta > 0 && fpCache.isEndReached()) {
      var $last = $(".canvas .canvas-image-item:last");
      if ($last.offset().top < 0) delta = 0;
    }
    wheelPos += delta;
    scrollTo(wheelPos);
    //canvas.style.marginTop = (-wheelPos) + "px";

    var now = Date.now();
    if (now-lastWheel > 250) {
      wheel();
    }

  }
}
});


