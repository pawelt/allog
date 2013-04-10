// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

var core = module.exports = {};

// ----------------------------------------------------------------------------
// Imports
// ----------------------------------------------------------------------------

/** @returns {Node.path} */
var r_path =    require('path');
/** @returns {Node.fs} */
var r_fs =      require('fs');
/** @returns {wrench} */
var r_wrench =  require('wrench');
/** @returns {mainConfig} */
var r_cfg =     require('../config');
/** @returns {DateUtil} */
var r_dateUtil =  require('../public/js/shared/dateutil');

// ----------------------------------------------------------------------------
// Private
// ----------------------------------------------------------------------------

/**
 *
 * @param {String} name
 * @param {bool} isDir
 * @returns {File}
 */
function File(name, isDir) {
  this.name = name;
  this.isDir = isDir;
}

// ----------------------------------------------------------------------------
// Public
// ----------------------------------------------------------------------------

// Index file format
//
//  Index files contain two sections:
//  - meta data (optional):
//        a set of key - value pairs (meta entries)
//  - text
//        arbitrary text data
//
//  Parsing rules:
//  1. text begins with the first non-blank line that doesn't start with @
//  2. everything before text is meta data
//  3. all meta data lines that start with @ define a new meta entry key
//  4. everyting between meta keys becomes meta values for respective meta entries
core.NoteIndex = function (text, meta) {
  this.text = text || '';
  this.meta = meta || {};
};

/**
 * Create NoteIndex from string.
 *
 * @param {String} indexRawString
 * @returns {NoteIndex}
 */
core.NoteIndex.fromString = function (indexRawString) {
  var lines = (indexRawString.trim() + '\n').split('\n'), linesLeft = lines.length;
  var line, curLine = 0, reKey = /\s/;
  var c0, blanks = 0, key = '', val = '', meta = {}, text = '';

  while (linesLeft--) {
    line = lines[curLine++];
    c0 = line[0] || ' ';
    if (' \r\t@'.indexOf(c0) === -1) {
      if (key) meta[key] = (meta[key] || '') + val.trim();
      break;
    }
    if (c0 === '@') {
      if (key) meta[key] = (meta[key] || '') + val.trim();
      key = line.split(reKey)[0].substring(1);
      val = line.substring(key.length + 1);
    }
    else {
      val += '\n' + line;
    }
    blanks = line.length === 0 ? blanks + 1 : 0;
    if (blanks > 1) {
      meta[key] = val.trim();
      break;
    }
    if (linesLeft === 0) {
      meta[key] = val.trim();
    }
  }
  text = lines.slice(curLine - 1).join('\n');
  return new core.NoteIndex(text, meta);
};

/**
 * Serializes CachedNote text and meta to index file format.
 */
core.NoteIndex.prototype.toString = function () {
  var outStr = '', meta = this.meta;
  Object.keys(meta).forEach(function (metaKey) {
    var metaVal = meta[metaKey];
    outStr += '@' + metaKey + '    ' + metaVal + '\n';
  });
  outStr += '\n';
  outStr += this.text;
  return outStr;
};

/**
 * Allog root path (where boxes, templates and trash sit)
 * @returns {String}
 */
core.getRootPath = function () {
  return r_cfg.paths.root;
};

/**
 * Prepends a relative path built from arguments with allog boxes path.
 * Use it to build absolute paths to notes and files in notes' subdirectories.
 *
 * Important: the path formed by arguments has to begin with a box name.
 *
 * @param {String[var_args]} box box name
 * @returns {String}
 */
core.getBoxedPath = function () {
  var parts = Array.prototype.slice.call(arguments);
  return r_path.join.apply(r_path, [r_cfg.paths.boxes].concat(parts));
};

/**
 * Get absolute path to note's index file.
 * Use this function to avoid hardcoding index file name anywhere else in the code.
 *
 * @param {String} noteId
 * @returns {String}
 */
core.getIndexPath = function (noteId) {
  return core.getBoxedPath(noteId, 'index.txt');
};

/**
 * Get absolute path to note's index file.
 *
 * @param {String} noteId
 * @returns {String}
 */
core.getIndexPathFromParts = function (box, date, name) {
  var noteId = r_dateUtil.isZero(date)
    ? core.getNoteId(box, name)
    : core.getNoteId(box, date, name);
  return core.getIndexPath(noteId);
};

/**
 * Builds note ID from note's box, date and name
 * or from box and note dir name, if second parameter is a string.
 *
 * @param {String} box
 * @param {Date|String} date|dirName
 * @param {String} name
 * @returns {String}
 */
core.getNoteId = function (box, dateOrDirName, name) {
  if (typeof dateOrDirName === 'string') return box + '/' + dateOrDirName;
  var nameDate = r_dateUtil.toNoteName(dateOrDirName);
  return box + '/' + nameDate + '-' + name;
};


/**
 * Splits note ID into three components: box, date and name.
 * This function is a reversed version of core.getNoteId()
 *
 * @param {String} noteId
 * @returns {Object} Note ID parts: { box: '', date: new Date(), name: ''}
 */
core.getNoteIdParts = function (noteId) {
  var res = { box: '', date: r_dateUtil.getDateZero(), name: ''};
  var parts = noteId.match(/^([^\/]+)\/(\d\d.\d\d.\d\d-\d\d.\d\d.\d\d)-(.+)$/);
  // if note id doesn't match the pattern,
  // try to extract box name and folder name
  if (!parts) {
    parts = noteId.split('/', 2);
    if (parts.length !== 2) return res;
    res.box = parts[0];
    res.name = parts[1];
    res.date = r_dateUtil.getDateZero();
    return res;
  }
  res.box = parts[1];
  res.date = r_dateUtil.fromNoteName(parts[2]);
  res.name = parts[3];
  return res;
};

/**
 * Returns a list of template names.
 * @returns {Array}
 */
core.getTemplateNames = function () {
  return this.scanDirNamesSort(r_cfg.paths.templates);
};

/**
 * Returns a list of special folder names.
 * @returns {Array}
 */
core.getSpecialNames = function () {
  return r_cfg.specials;
};

/**
 * Returns a list of box names, including the pseudo-box "any" if argument includeAny !== false.
 *
 * @param {bool} includeAny
 * @returns {Array}
 */
core.getBoxNames = function (includeAny) {
  var boxes = this.scanDirFilesSort(r_cfg.paths.boxes).filter(
      function (file) { return file.isDir;
  }).map(function (file) { return file.name; });
  return includeAny !== false
    ? [r_cfg.names.anyBox].concat(boxes)
    : boxes;
};

/**
 * Returnes sorted list of file names in given directory.
 *
 * @param {type} dirPath
 * @returns {Array}
 */
core.scanDirNamesSort = function (dirPath) {
  return r_fs.readdirSync(dirPath).sort();
};

/**
 * Returnes sorted list of File objects representing files in given directory.
 *
 * @param {type} dirPath
 * @returns {Array} array of File objects
 */
core.scanDirFilesSort = function (dirPath) {
  try {
    return r_fs.readdirSync(dirPath).map(function(fileName) {
      var filePath = r_path.join(dirPath, fileName);
      return new File(fileName, r_fs.statSync(filePath).isDirectory());
    }).sort(function(a, b) {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return  1;
      var an = a.name.toLowerCase(), bn = b.name.toLowerCase();
      return an.localeCompare(bn);
    });
  } catch (e) {
    console.error("core.scanDirFilesSort(): " + e);
    return false;
  }
};

/**
 * Saves changed note index to disk.
 *
 * @param {String} noteId
 * @param {Obect} noteIndex object containing text and meta fields
 * @returns {CachedNote}
 */
core.saveNoteIndex = function (noteId, noteIndex) {
  try {
    var indexPath = core.getIndexPath(noteId);
    var changedIndex = new core.NoteIndex(noteIndex.text, noteIndex.meta);
    r_fs.writeFileSync(indexPath, changedIndex.toString());
    return changedIndex;
  } catch (e) {
    console.error("core.saveNoteIndex(): " + e);
    return e;
  }
};

/**
 * Moves the note to trash.
 *
 * @param {String} noteUri
 * @returns {Boolean}
 */
core.trashNote = function (noteUri) {
  try {
    var srcPath = core.getBoxedPath(noteUri);
    var dstPath = r_path.join(r_cfg.paths.trash, noteUri.substring(noteUri.indexOf('/') + 1));

    console.log("Trash: " + srcPath + "\n        " + dstPath);

    r_fs.renameSync(srcPath, dstPath);
    return true;
  } catch (e) {
    console.error("core.trashNote(): " + e);
    return e;
  }
};

core.moveNote = function (noteId, noteIndex) {
  try {
    var dstDate = r_dateUtil.fromNormalizedString(noteIndex.date);

    if (r_dateUtil.isZero(dstDate)) return new Error('Invalid date or time format');

    var dstNoteId = core.getNoteId(noteIndex.box, dstDate, noteIndex.name);
    var dstPath = core.getBoxedPath(dstNoteId);
    var srcPath = core.getBoxedPath(noteId);

    if (srcPath === dstPath) return new Error('Source and destination directory names are the same');

    console.log('Move SRC: ' + srcPath);
    console.log('Move DST: ' + dstPath);

    r_fs.renameSync(srcPath, dstPath);
    return dstNoteId;
  } catch (e) {
    console.error("core.moveNote(): " + e);
    return e;
  }
};

core.cloneTemplate = function(template, boxName) {
  try {
    var date = r_dateUtil.zeroTimezone(new Date());
    var newNoteid = core.getNoteId(boxName, date, template);
    var dstPath = core.getBoxedPath(newNoteid);
    var srcPath = r_path.join(r_cfg.paths.templates, template);

    console.log('Clone SRC: ' + srcPath);
    console.log('Clone DST: ' + dstPath);

    r_wrench.copyDirSyncRecursive(srcPath, dstPath);
    return newNoteid;
  } catch (e) {
    return e;
  }
};