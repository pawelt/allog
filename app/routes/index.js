// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

var routes = module.exports = {};

// ----------------------------------------------------------------------------
// Imports
// ----------------------------------------------------------------------------

/** @returns {Node.path} */
var r_path =  require('path');
/** @returns {Node.fs} */
var r_fs =    require("fs");
/** @returns {Node.child_process} */
var r_cproc=  require('child_process');
/** @returns {mainConfig} */
var r_cfg =   require('../config');
/** @returns {core} */
var r_core =  require('../lib/core');
/** @returns {cache} */
var r_cache = require('../lib/cache');
/** @returns {DateUtil} */
var r_dateUtil =  require('../public/js/shared/dateutil');


// ----------------------------------------------------------------------------
// Private
// ----------------------------------------------------------------------------

/**
 * Creates an absolute path for given item.
 *
 * @param {String} itemType one of: 'special', ''
 * @param {String} itemUri
 * @returns {String} resolved item path or empty string
 */
function _getItemPath(itemType, itemUri) {
  if (itemType !== 'special') return itemUri ? r_core.getBoxedPath(itemUri) : '';
  return r_cfg.specials.indexOf(itemUri) > -1 ? r_cfg.paths[itemUri] : '';
}

/**
 * Standard JSON response.
 * 
 * @returns {JsonRes}
 */
function JsonRes() {
  this.status = 0;
  this.message = '';
  this.data = '';
}

JsonRes.prototype.toString = function () {
  return JSON.stringify(this);
};

JsonRes.prototype.send = function (res, endResponse) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.write(this.toString());
  if (endResponse !== false) res.end();
};

JsonRes.withError = function (status, message) {
  var res = new JsonRes();
  res.status = status;
  res.message = message;
  return res;
};

JsonRes.withMessage = function (message) {
  var res = new JsonRes();
  res.message = message;
  return res;
};

JsonRes.withData = function (data) {
  var res = new JsonRes();
  res.data = data;
  return res;
};


// ----------------------------------------------------------------------------
// Public
// ----------------------------------------------------------------------------


routes.index = function(req, res) {

  var resParams = {

    specials:     r_core.getSpecialNames(),
    templates:    r_core.getTemplateNames(),
    boxes:        r_core.getBoxNames(),

    defaultBox:   r_cfg.names.defaultBox,
    anyBox:       r_cfg.names.anyBox,

    appName:      r_cfg.app.name,
    appVersion:   r_cfg.app.version,

    ajaxTimeout:  r_cfg.app.ajaxTimeout,
    autosave:     r_cfg.app.autosave,

    pretty:       true
  };

  res.render('main', resParams);
};


routes.getCachedKeywords = function(req, res) {
  JsonRes.withData(r_cache.getCachedKeywords()).send(res);
};


routes.getCachedNotes = function(req, res) {
  var notes = r_cache.getCachedNotes();
  JsonRes.withData(notes).send(res);
};


routes.getNoteSubdir = function (req, res) {
  var notePath = _getItemPath(req.body.itemType || '', req.body.itemUri || '');
  var files = r_core.scanDirFilesSort(notePath);
  if (files) {
    JsonRes.withData(files).send(res);
  } else {
    JsonRes.withError(1, 'Note folder "' + notePath + '" not found. Try rebuilding cache.').send(res);
  }
};


routes.getNoteIndex = function (req, res) {
  var noteId = req.body.itemUri || '';
  var note = r_cache.getCachedNote(noteId);
  if (note) {
    note.fileCount = 0;
    try {
      note.fileCount = r_core.scanDirNamesSort(r_core.getBoxedPath(noteId)).length;
    } catch (e) {}
    JsonRes.withData(note).send(res);
  } else {
    JsonRes.withError(1, 'Note "' + noteId + '" not found. Try rebuilding cache.').send(res);
  }
};


routes.saveNoteIndex = function (req, res) {
  var noteUri = req.body.itemUri || '';
  var noteIndex = req.body.index || {};

  var cachedNote = r_cache.getCachedNote(noteUri);
  if (cachedNote) {
    var indexPath = r_core.getIndexPath(noteUri);
    if (r_fs.existsSync(indexPath)) {
      var mdate = r_dateUtil.zeroTimezone(r_fs.statSync(indexPath).mtime);
      mdate = r_dateUtil.toNormalizedDT(mdate);
      if (mdate !== cachedNote.mdate) {
        JsonRes.withError(1, 'Note "' + noteUri + '" index was modified externally. \nPlease copy your changes, if you want to keep them, and rebuild cache').send(res);
        return;
      }
    }
  }

  var changedIndex = r_core.saveNoteIndex(noteUri, noteIndex);
  if (changedIndex instanceof Error) {
    JsonRes.withError(1, 'Failed to save note "' + noteUri + '": ' + changedIndex).send(res);
  } else {
    cachedNote = r_cache.updateCachedNoteIndex(noteUri, changedIndex);
    if (cachedNote instanceof Error) {
      JsonRes.withError(1, 'Note "' + noteUri + '" index changes were saved, but cache was not updated. \nPlease rebuild cache.').send(res);
    } else {
      JsonRes.withData(cachedNote).send(res);
    }
  }
};


routes.trashNote = function (req, res) {
  var noteUri = req.body.itemUri || '';
  var err = r_core.trashNote(noteUri);
  if (err instanceof Error) {
    JsonRes.withError(1, 'Failed to trash note "' + noteUri + '".\n' + err).send(res);
  } else {
    r_cache.uncacheNote(noteUri);
    JsonRes.withMessage('Note "' + noteUri + '" trashed').send(res);
  }
};


routes.moveNote = function (req, res) {
  var noteId = req.body.itemUri || '';
  var noteIndex = req.body.index || {};

  var newNoteId = r_core.moveNote(noteId, noteIndex);
  if (newNoteId instanceof Error) {
    JsonRes.withError(1, 'Failed to move note "' + noteId + '".\n ' + newNoteId).send(res);
  } else {
    r_cache.uncacheNote(noteId);
    var cachedNote = r_cache.cacheNewNote(newNoteId);
    JsonRes.withData({noteId: newNoteId, note: cachedNote}).send(res);
  }
};


routes.cloneNoteTemplate = function (req, res) {
  var template = req.body.template || '';
  var box = req.body.box || '';
  var newNoteId = r_core.cloneTemplate(template, box);
  if (newNoteId instanceof Error) {
    JsonRes.withError(1, 'Failed to clone template "' + template + '".\n' + newNoteId).send(res);
  } else {
    var cachedNote = r_cache.cacheNewNote(newNoteId);
    JsonRes.withData({noteId: newNoteId, note: cachedNote}).send(res);
  }
};


routes.launch = function(req, res) {
  var path = _getItemPath(req.body.itemType || '', req.body.itemUri || '');

  if (!path || !r_fs.existsSync(path)) {
    console.error('LAUNCH FAIL: invalid path: "' + path + '"');
    JsonRes.withError(1, 'Invalid path: "' + path + '"').send(res);
  } else {
    console.log('LAUNCH PATH: ' + path);
    console.log('LAUNCH CMD:  ' + r_cfg.exec.prepare(path));
    var proc = r_cproc.exec(r_cfg.exec.prepare(path));
    JsonRes.withMessage('Launched: ' + path).send(res);
  }
};


routes.rebuildCache = function(req, res) {
  r_cache.rebuild();
  JsonRes.withMessage('Cache rebuilt').send(res);
};


routes.saveFilters = function(req, res) {
  var filters = req.body.filters || {};
  var filtersPath = r_path.join(r_cfg.paths.root, 'filters.js');
  try {
    r_fs.writeFileSync(filtersPath, filters.replace(/","/g, '"\n,"'));
    JsonRes.withMessage('Filters saved').send(res);
  } catch (e) {
    JsonRes.withError(1, 'Failed to save filters.\n' + e).send(res);
  }
};


routes.fetchFilters = function(req, res) {
  var filtersPath = r_path.join(r_cfg.paths.root, 'filters.js');
  try {
    var filters = JSON.parse(r_fs.readFileSync(filtersPath, 'utf8'));
    JsonRes.withData(filters).send(res);
  } catch (e) {
    JsonRes.withError(1, 'Failed to load filters.\n' + e).send(res);
  }
};

