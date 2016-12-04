/**
 * willie-photos - Client-side utility functions
 */
// (C) Alexandre Morin 2015 - 2016


/** ================================================================================
  * Compute URLs
  * ================================================================================ */
function getImagesURL(offset, limit, tag, filters) {
  var url = '/photos/images?offset=' + encodeURIComponent(offset) + '&limit=' + encodeURIComponent(limit);
  if (tag && tag.length>0)
    url = url + "&tag=" + encodeURIComponent(tag);
  var currentFilterByYear = filters.currentFilterByYear;
  if (currentFilterByYear && (currentFilterByYear.from || currentFilterByYear.to)) {
    var from = currentFilterByYear.from ? currentFilterByYear.from : "";
    var to = currentFilterByYear.to ? currentFilterByYear.to : "";
    url = url + "&byYear=" + encodeURIComponent("" + from + "," + to);
  }
  var currentFilterShowHidden = filters.currentFilterShowHidden;
  if (currentFilterShowHidden) {
    url = url + "&hidden=true";
  }
  return url;
}


/** ================================================================================
  * Patch Configuration manager
  * ================================================================================ */

// Load filters from local storage
ConfigurationManager.prototype.loadFilters = function() {
  var that = this;
  var currentFilterByYear = { from:undefined, to:undefined };
  var range = that._localGetItem('byYear');
  if (range && (range.from || range.to)) currentFilterByYear = { from:range.from, to:range.to };

  var currentFilterShowHidden = false;
  var hidden = that._localGetItem('byHidden');
  if (hidden && hidden.hidden) currentFilterShowHidden = true;

  return {
    currentFilterByYear: currentFilterByYear,
    currentFilterShowHidden: currentFilterShowHidden
  }
}

ConfigurationManager.prototype.saveFilters = function(filters) {
  var that = this;
  that._localSetItem('byYear', filters.currentFilterByYear);
  that._localSetItem('byHidden', { hidden: filters.currentFilterShowHidden});
}

ConfigurationManager.prototype.loadFirstVisible = function(currentTag) {
  var that = this;
  if (!currentTag) currentTag = "00000000-0000-0000-0000-000000000000";
  var firstVisible = that._localGetItem(currentTag + ".firstVisible");
  return firstVisible;
}

ConfigurationManager.prototype.saveFirstVisible = function(currentTag, firstVisible) {
  var that = this;
  if (!currentTag) currentTag = "00000000-0000-0000-0000-000000000000";
  that._localSetItem(currentTag + ".firstVisible", firstVisible);
}

ConfigurationManager.prototype.loadSelectionMode = function(currentTag) {
  var that = this;
  var selectionMode = that._localGetItem("selectionMode");
  if (selectionMode !== 'browse' && selectionMode !== 'tag') selectionMode = 'browse';
  return selectionMode;
}

ConfigurationManager.prototype.saveSelectionMode = function(currentTag, selectionMode) {
  var that = this;
  that._localSetItem("selectionMode", selectionMode);
}


/** ================================================================================
  * SVG icons
  * ================================================================================ */
function createCreateIcon()         { return $('<svg width="24px" height="24px" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path></svg>'); }
function createZoomIcon()           { return $('<svg width="24px" height="24px" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path><path d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z"></path></svg>'); }
function createToggleTagIcon()      { return $('<svg width="24px" height="24px" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path></svg>'); }
function createDeleteIcon()         { return $('<svg width="24px" height="24px" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2v-12h-12v12zm13-15h-3.5l-1-1h-5l-1 1h-3.5v2h14v-2z"></path></svg>'); }
function createSetCoverIcon()       { return $('<svg width="24px" height="24px" viewBox="0 0 24 24"><path d="M18 2h-12c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-16c0-1.1-.9-2-2-2zm-12 2h5v8l-2.5-1.5-2.5 1.5v-8zm0 15l3-3.86 2.14 2.58 3-3.86 3.86 5.14h-12z"></path></svg>'); }
function createRightArrowIcon()     { return $('<svg width="36px" height="36px" viewBox="0 0 24 24"><path d="M8.59 16.34l4.58-4.59-4.58-4.59L10 5.75l6 6-6 6z"></path></svg>'); }
function createLeftArrowIcon()      { return $('<svg width="36px" height="36px" viewBox="0 0 24 24"><path d="M15.41 16.09l-4.58-4.59 4.58-4.59L14 5.5l-6 6 6 6z"></path></svg>'); }
function createCloseIcon()          { return $('<svg width="24px" height="24px" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path><path d="M0 0h24v24H0z" fill="none"></path></svg>'); }
function createModeIcon()           { return $('<svg width="24px" height="24px" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg>'); }
