/**
 * willie-photos - Photos navigator (client-side code)
 */
// (C) Alexandre Morin 2015 - 2016


// UUID of current tag/album
// undefined or empty means 'all' album
var curentTag = undefined;

// Current offset (image to load)
var currentOffset = undefined;

// Is there a next image
var hasNextImage = false;
var nextOffset = undefined;

// Access to local storage
var configurationManager = new ConfigurationManager();

/**
 * Reload image
 */
function reloadImage(callback) {
  var filters = configurationManager.loadFilters();
  var url = getImagesURL("=" + currentOffset, 2, curentTag, filters);
  return ajax({
    type: 'GET',
    url: url,
    dataType: 'json',
    success: function(images) {
      return _privReloadImage(url, images, callback);
    },
    error: function(jqxhr, textStatus, error) {
      flashError("Failed to load image", jqxhr.status);
      return callback(error);
    }
  });
}

function _privReloadImage(url, images, callback) {

  if (!images || images.length===0) return;
  hasNextImage = images.length === 2;
  nextOffset = hasNextImage ? images[1].page : undefined;
  var image = images[0];

  var $img = $('<img class="nav-photo"></img>');
  var backgroundColor = image.image.dominantColor;

  var width = image.image.width;
  var height = image.image.height;
  var canvasWidth = $('.nav-canvas').width();
  var canvasHeight = $('.nav-canvas').height();

  var maxWidth = canvasWidth - 2*72;
  var maxHeight = canvasHeight - 2*8;

  if (width > maxWidth) {
    var k = maxWidth/width;
    width = width * k;
    height = height * k;
  }
  if (height > maxHeight) {
    var k = maxHeight/height;
    width = width * k;
    height = height * k;
  }

  $('.nav-photo').remove();
  $img.appendTo($('.nav-canvas'));

  var center = ($('.nav-canvas').height() - 56)/2;
  $('.nav-right-icon').css({
    top: center
  }).toggle(hasNextImage);
  $('.nav-left-icon').css({
    top: center
  }).toggle(true); // ## TODO should detect first image

  var loaded = false;
  $img.bind('load', function() {
    loaded = true;
    if ($wait) $wait.toggle(false);
  });

  $img.attr({
    src: '/photos/image/' + image.uuid
  });
  $img.css({
    position: 'relative',
    top: (canvasHeight-height)/2,
    left: (canvasWidth-width)/2,
    width: width,
    height: height,
    backgroundColor: backgroundColor
  });

  $img.click(function() {
    displayNext();
  });

  var $wait;
  setTimeout(function() {
    if (!loaded) {
      // From https://viget.com/inspire/experiments-in-loading-how-long-will-you-wait
      $wait = $('<img class="nav-wait" src="images/wait-630.gif"></img>');
      $wait.css({
        position: 'absolute',
        top: (canvasHeight-80)/2,
        left: (canvasWidth-80)/2,
        width: 80,
        height: 80,
        zIndex: 5000
      });
      $wait.appendTo($('.nav-canvas'));
    }
  }, 500);

  return callback();
}

/**
 */
function backToAlbum() {
  var url = "/photos/photos.html";
  if (curentTag) url = url + "?tag=" + encodeURIComponent(curentTag);
  window.location = url;
}

/**
 * Display next image
 */
function displayNext() {
  if (!hasNextImage) return;
  currentOffset = nextOffset;
  reloadImage(function() {});
}

/**
 * Display previous image
 */
function displayPrevious() {

  var filters = configurationManager.loadFilters();
  var url = getImagesURL("=" + currentOffset, -2, curentTag, filters);
  return ajax({
    type: 'GET',
    url: url,
    dataType: 'json',
    success: function(images) {
      if (!images || images.length < 2)
         $('.nav-left-icon').toggle(false);
       else {
        currentOffset = images[1].page;
        reloadImage(function() {});
      }
    },
    error: function(jqxhr, textStatus, error) {
      flashError("Failed to load image", jqxhr.status);
    }
  });
}

/**
 * Main
 */
$(function() {
  curentTag = getUrlParameter('tag');
  currentOffset = getUrlParameter('offset');
  if (currentOffset) currentOffset = decodeURIComponent(currentOffset);
  reloadImage(function() {});

  $(".nav-left-icon").toggle(false).append(createLeftArrowIcon());
  $(".nav-right-icon").toggle(false).append(createRightArrowIcon());

  $(".nav-right-icon").click(function(event)  { displayNext(); });
  $(".nav-left-icon").click(function(event)   { displayPrevious(); });

  // Add a close icon
  createCloseIcon().appendTo(".nav-close").click(function() {
    backToAlbum();
  });


  $(document).keydown(function(e) {
    switch(e.which) {
      case KEY_ESCAPE: return backToAlbum();
      case KEY_RIGHT_ARROW: return displayNext();
      case KEY_LEFT_ARROW: return displayPrevious();
    }
  });

});
