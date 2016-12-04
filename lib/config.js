/**
 * @file willie-photos - Module configuration
 */
// (C) Alexandre Morin 2016


/**
 * @module core/config
 */

/**
 * @typedef config
 * @property {string} name - Module name (camel-case, no spaces)
 * @property {string} path - Module path (on file system)
 * @property {string} version - Module version (major.minor.micro)
 * @property {menuItem[]} homeMenu - list of menu items to insert on the application home page (/). The index attribute is used to control the display order
 * @property {menuItem[]} sideMenu - list of menu items to insert on the left-side menu. The index attribute is used to control the display order
 * @property {string} thumbsDir - 
 * @property {string[]} folders - 
 * @property {string} convertCommand - 
 * @property {string} identifyCommand - 
 * @property {string[]} flavors - Scaled images and thumbnail flavors. Example: "40", "200", "1024x200", "=386x358"
 * @property {integer} minFileSize - Ignore files smaller than this value
 * @property {integer} maxFileSize - Ignore files larger than this value
 * @property {integer} minImageWidth - Ignore images having either a smaller width or height
 * @property {integer} minImageHeight - Ignore images having either a smaller width or height
 * @property {string[]} exclude - Exclude the following files/folders
 * @property {string[]} include - Include only the following file patterns (case-insensitive)
 * property animGenerator - Configuration of the anim (GIF) generator
 * property {integer} animGenerator.minFrames - 
 * property {integer} animGenerator.delay - 
 * @property {string[]} animGenerator.flavors - 
 */

/**
 * @typedef menuItem
 * @property {string} name - Menu identifier (camel-case, no spaces)
 * @property {string} label - Menu title (human readable)
 * @property {string} href - Link to navigate to when clicking menu
 * @property {string} icon - Menu icon (svg 24x24)
 * @property {string} index - Menu index, used to determine in which order to display menu items relative one to another
 */


/**
 * @ignore
 */
const Exception = require('wg-log').Exception;


/*
 * Is this a valid flavor
 * @param config - is the module configuration object
 */
function _isValidFlavor(config, flavor) {
  var flavors = config.flavors;
  return flavors.indexOf(flavor) !== -1 || flavors.indexOf('=' + flavor) !== -1;
}

/**
 * Get the list of flavors as thumbs objects
 * @param config - is the module configuration object
 */
function _getThumbFlavors(config) {
  var thumbs = [];
  var flavors = config.flavors;
  for (var i=0; i<flavors.length; i++) {
    var flavor = flavors[i].toLowerCase();
    var exact = false; // Keep exact size
    if (flavor[0] === '=') {
      flavor = flavor.substr(1);
      exact = true;
    }
    var xIndex = flavor.indexOf('x');
    if (xIndex === -1) {
      var size = +flavor;
      thumbs.push({ size:size, exact:true });
    }
    else {
      var width = +flavor.substr(0, xIndex);
      var height = +flavor.substr(xIndex+1);
      thumbs.push({ width:width, height:height, exact:exact });
    }
  }
  return thumbs;
}




const defaultConfig = {
  name: "photos",
  path: __dirname + "/..",
  version: "1.2.0",

  // list of menu items to insert on the application home page (/). The index attribute is used to control the display order
  homeMenu: [ 
  	{ label:"Photos", href:"photos/photos.html", index:100 },
  	{ label:"Albums", href:"photos/albums.html", index:110 }
  ],

  // list of menu items to insert on the left-side menu. The index attribute is used to control the display order
  "sideMenu": [
  	{ name:"photos:photos", 	label:"Photos (All)", 	href:"/photos/photos.html", 	icon:"/photos/images/photos.svg", 	index:100 },
  	{ name:"photos:albums", 	label:"Albums", 		href:"/photos/albums.html", 	icon:"/photos/images/albums.svg", 	index:110 }
  ],

  // Working directory where to generate thumbnails
  // Should be set in config.json
  thumbsDir: undefined,

  // Collection to scan
  // Should be set in config.json
  collections: undefined,

  // Image-magick command 'convert' (Ex: which convert)
  convertCommand: "convert",

  // Image-magick command 'identify' (Ex: which identify)
  identifyCommand: "identify",

  // Scaled images and thumbnail flavors
  // 3 formats are supported
  //    - <size> : a single number means a square thumbnails of the exact dimension
  //    - <width>x<height> : a scaled image fitting in the dimension. Aspect ratio is maintained, but the resulting image size may be smaller
  //    - =<width>x<height> : a non-square thumbnail of the exact dimension
  flavors: [
    "40",           // very small thumbnail
    "200",          // square small thumbnail
    "1024x200",     // scaled image for photo view
    "=386x258"      // fixed-size thumbnail for album covers
  ],

  // Ignore files smaller than this value
  minFileSize: 12*1024,

  // Ignore files larger than this value
  maxFileSize: 52428800,

  // Ignore images having either a smaller width or height
  minImageWidth: 200,
  minImageHeight: 200,

  // Exclude the following files/folders
  exclude: [
    "iPhoto Library", "iPhoto Library.migratedphotolibrary", "Photos Library.photoslibrary", 
    "Microsoft User Data", ".svn", "node_modules", "svn", ".picasaoriginals", "__incoming__",
    "iPhoto Library.photolibrary", "wpp", "datakit", "nl"
  ],

  // Include only the following file patterns (case-insensitive)
  include: [
    "*.jpg", "*.jpeg",
    "*.gif",
    "*.png"
  ],

  // Configuration of the anim (GIF) generator
  animGenerator: {
    minFrames:  3,
    delay:      25,
    flavors: [
      "386x258"
    ]
  },
};


function _checkConfig(config, callback) {
  if (!config.thumbsDir)                                      return callbak(new Exception(undefined, "Invalid configuration (missing 'thumbsDir'"));
  if (!config.collections || config.collections.length===0)   return callbak(new Exception(undefined, "Invalid configuration ('collections')"));
  return callback(undefined, config);
}

/**
 * Public interface
 * @ignore
 */
module.exports = {
  defaultConfig: defaultConfig,
  check: _checkConfig,
  getThumbFlavors: _getThumbFlavors,
  isValidFlavor: _isValidFlavor
}
