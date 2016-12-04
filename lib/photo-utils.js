/**
 * willie-photos - Utility functions
 */
// (C) Alexandre Morin 2015 - 2016


/**
 * Returns the file where a thumbnail is stored
 * Structure of this directory is as follows
 *    base/flavor/sub1/sub2/uuid.png
 *
 * See @getThumbsDir for the directory structure
 */
getThumbsFile = function(thumbsDir, flavor, uuid) {
  var subdir1 = uuid.substr(9, 4);
  var subdir2 = uuid.substr(14, 4);
  var base = thumbsDir;
  var file = base + "/" + flavor + "/" + subdir1 + "/" + subdir2 + "/" + uuid + ".png";
  return file;
}

/** ================================================================================
  * Public interface
  * ================================================================================ */
module.exports = {
  getThumbsFile:              getThumbsFile,
};
