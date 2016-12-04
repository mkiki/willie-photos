/**
 * willie-photos - Albumns browser (client-side code)
 */
// (C) Alexandre Morin 2015 - 2016


var flavor = "386x258";      // Thumbs flavor for image overview

// Cache albums (key=uuid, value=album)
var albumsCache = {};

function addAlbumItem($canvas, uuid) {
  var album = albumsCache[uuid];
  if (!album) return;

  var $item = $("<div class='canvas-album-item'></div>");

  var $thumb = $("<div class='canvas-album-item-thumb'></div>").appendTo($item);
  if (album.cover.uuid) {
    var $img = $("<img class='canvas-album-item-image'></img>").appendTo($thumb);
    $img.attr("src", "/photos/thumb/" + flavor + "/" + album.cover.uuid);
  }

  var $captionBack = $("<div class='canvas-album-caption-background'></div>").appendTo($item);
  
  var $caption = $("<div class='canvas-album-caption'></div>").appendTo($captionBack);
  var $name = $("<div class='canvas-album-item-name'></div>").appendTo($caption); $name.text(album.name);
  var $dateRange = $("<div class='canvas-album-item-dateRange'></div>").appendTo($caption); 
  var text = "";
  if (album.timestamp) {
    var ts = moment(album.timestamp).format("MMMM YYYY");
    if (ts.length>0) text = text + ts;
  }
  // Number of elements
  text = text + "  ·  ";
  if (album.filter && album.filter.length > 0) {
    // smart album
    text = text + "Smart album";
  }
  else {
    text = text + album.imageCount + " éléments"
  }
  $dateRange.text(text);

  var $interceptor = $("<div class='canvas-album-item-interceptor'></div>").appendTo($item);
  $interceptor.click(function(event) {
    var url = "/photos/photos.html?tag=" + encodeURIComponent(uuid);
    window.location = url;
  });

  $canvas.append($item);
  return $item;
}

// Refresh all
function refresh() {
  var canvas = document.getElementById("canvas");
  $(canvas).children().remove();
  $(canvas).empty();

  var url = '/photos/albums/byDateDesc';
  return ajax({
    type: 'GET',
    url: url,
    dataType: 'json',
    success: function(albums) {
      if (albums !== null && albums !== undefined && albums.length > 0) {
        for (var i=0; i<albums.length; i++) {
          var album = albums[i];
          albumsCache[album.uuid] = album;
          var $item = addAlbumItem($(canvas), album.uuid);
        }
      }
    },
    error: function(jqxhr, textStatus, error) {
      flashError("Failed to load albums", jqxhr.status);
    }
  });

    
}

/**
 * Main
 */
$(function() {
  createMenu(document.sideMenu, "albums");  

  $('#infos').toggle(false); // no info pannel
  $('.canvas').addClass('canvas-no-infos');
  refresh();
});
