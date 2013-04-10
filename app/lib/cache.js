// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

var cache = module.exports = {};

// ----------------------------------------------------------------------------
// Imports
// ----------------------------------------------------------------------------

/** @returns {Node.path} */
var r_path =      require('path');
/** @returns {Node.fs} */
var r_fs =        require('fs');
/** @returns {mainConfig} */
var r_cfg =       require('../config');
/** @returns {DateUtil} */
var r_dateUtil =  require('../public/js/shared/dateutil');
/** @returns {core} */
var r_core =      require('./core');

// ----------------------------------------------------------------------------
// Private
// ----------------------------------------------------------------------------

function CachedNote() {
  this.box = '';
  this.date = '';
  this.name = '';
  this.mdate = '';
  this.text = '';
  this.meta = {};
}

/**
 * Updates cached index modified date.
 *
 * @param {String} indexPath optional (if not provided, note path is built with core.getIndexPath())
 * @returns {CachedNote}
 */
CachedNote.prototype.updateModifiedDate = function (indexPath) {
  try {
    indexPath = indexPath || r_core.getIndexPathFromParts(this.box, this.date, this.name);
    this.mdate = r_dateUtil.zeroTimezone(r_fs.statSync(indexPath).mtime);
  } catch (e) {
    this.mdate = r_dateUtil.getDateZero();
  }
  return this;
};

/**
 * Create CachedNote from index file.
 *
 * @param {String} noteId
 * @returns {CachedNote}
 */
CachedNote.fromIndex = function (noteId) {

  var noteIdParts = r_core.getNoteIdParts(noteId);
  var cachedNote = new CachedNote();
  
  cachedNote.box =    noteIdParts.box;
  cachedNote.name =   noteIdParts.name;
  cachedNote.date =   noteIdParts.date;

  var indexPath =  r_core.getIndexPathFromParts(cachedNote.box, cachedNote.date, cachedNote.name);
  cachedNote.updateModifiedDate(indexPath);

  try {
    var indexDataRaw = r_fs.readFileSync(indexPath, 'utf8');
    var noteIndex = r_core.NoteIndex.fromString(indexDataRaw);
    cachedNote.text = noteIndex.text;
    cachedNote.meta = noteIndex.meta;
  } catch (e) {
    console.error('CachedNote.fromIndex() ', indexPath, ': ' + e);
  }

  return cachedNote;
};


var _cachedNotes = {};
var _cachedKeywords = {};

function _invalidate() {
  _cachedNotes = {};
  _cachedKeywords = {};
}

/**
 * Returns a copy of cached note in normalized format (dates with @, keywords always set etc.)
 *
 * @param {CachedNote} cachedNote
 */
function _normalizeNote(cachedNote) {
  var res = r_cfg.merge(new CachedNote(), cachedNote);
  res.date = r_dateUtil.toNormalizedDT(res.date);
  res.mdate = r_dateUtil.toNormalizedDT(res.mdate);
  res.meta.keywords = res.meta.keywords || '';
  return res;
}

function _reloadKeywords() {
  var keywords = {};

  Object.keys(_cachedNotes).forEach(function (noteId) {
    var cachedNote = _cachedNotes[noteId];
    var cachedNoteKeywords = cachedNote.meta.keywords || '';
    var boxKeywords = keywords[cachedNote.box] || [];

    cachedNoteKeywords.split(/[ \t]*,+[ \t]*/).forEach(function (keyword) {
      keyword = keyword.trim();
      if (keyword.length) boxKeywords[keyword] = 1;
    });

    keywords[cachedNote.box] = boxKeywords;
  });

  Object.keys(keywords).forEach(function (boxName) {
    _cachedKeywords[boxName] = Object.keys(keywords[boxName]).sort();
  });
}

function _reloadNotes() {
  var boxes = r_core.getBoxNames(false);

  boxes.forEach(function (box) {
    var boxPath = r_core.getBoxedPath(box);
    var noteDirs = r_core.scanDirNamesSort(boxPath);

    noteDirs.forEach(function (noteDir) {
      try {
        if (!r_fs.statSync(r_path.join(r_core.getBoxedPath(box, noteDir))).isDirectory()) return;
        var noteId = r_core.getNoteId(box, noteDir);
        _cachedNotes[noteId] = CachedNote.fromIndex(noteId);
      } catch (e) {
        console.error('File stat error: %s', e);
      }
    });

  });
}


// ----------------------------------------------------------------------------
// Public
// ----------------------------------------------------------------------------

/**
 * Allog root path (where boxes, templates and trash sit)
 * @returns {String}
 */
cache.init = function () {
  cache.rebuild();
};

/**
 * Rebuild entire cache
 */
cache.rebuild = function () {
  _invalidate();
  _reloadNotes();
  _reloadKeywords();

  console.log("Cache rebuilt:");
  console.log('  Total notes:      ', Object.keys(_cachedNotes).length);
  console.log('  Keywords per box: ', Object.keys(_cachedKeywords).map(function (box) { var res = {}; res[box] = _cachedKeywords[box].length; return res; }));
};


/**
 * Updates cached note index data (text and meta).
 *
 * @param {String} noteId
 * @param {core.NoteIndex} noteIndex
 * @returns {CachedNote}
 */
cache.updateCachedNoteIndex = function (noteId, noteIndex) {
  var cachedNote = _cachedNotes[noteId];
  if (!cachedNote) return new Error('Note "' + noteId + '" not found');
  cachedNote.text = noteIndex.text;
  cachedNote.meta = noteIndex.meta;
  cachedNote.updateModifiedDate();
  _reloadKeywords();
  return _normalizeNote(cachedNote);
};

/**
 * Caches a new note and returns it in normalized format.
 *
 * New note is one that is not yet in cache.
 *
 * @param {String} noteId
 * @returns {CachedNote}
 */
cache.cacheNewNote = function (noteId) {
  var cachedNote = (_cachedNotes[noteId] = CachedNote.fromIndex(noteId));
  _reloadKeywords();
  return _normalizeNote(cachedNote);
};

/**
 * Removes the note from cache.
 *
 * @param {String} noteId
 */
cache.uncacheNote = function (noteId) {
  delete _cachedNotes[noteId];
};

/**
 * Returns CachedNote for noteId (including its text), or null.
 *
 * @param {String} noteId
 * @returns {CachedNote}
 */
cache.getCachedNote = function (noteId) {
  var cachedNote = _cachedNotes[noteId];
  return cachedNote ? _normalizeNote(cachedNote) : null;
};


/**
 * Returns an object with all cached notes, but without their texts
 *
 * @returns {Object}
 */
cache.getCachedNotes = function () {
  var notes = {};
  Object.keys(_cachedNotes).forEach(function (noteId) {
    var cachedNote = _normalizeNote(_cachedNotes[noteId]);
    cachedNote.text = '';
    notes[noteId] = cachedNote;
  });
  return notes;
};

/**
 * Returns an object with all cached notes, but without their texts
 *
 * @returns {Object}
 */
cache.getCachedKeywords = function () {
  return _cachedKeywords;
};