
// ==========================================================================================

var m_pubsub = _.extend({}, Backbone.Events);

// ==========================================================================================

var m_cache = (function () {
  'use strict';

  var exports = {};

  var _cachedNotes = [];
  var _cachedKeywords = [];

  var _cachedBoxedNotes = {};

  function _findNotePos(noteId) {
    for (var i in _cachedNotes) {
      if (_cachedNotes[i].id === noteId) return i;
    }
    return false;
  }

  exports.init = function () {
    m_ajax.postJSON('/get-cached-notes', { }).done(function (res) {
      console.log('DONE /get-cached-notes', res);
      _cachedNotes = [];
      for (var noteId in res.data) {
        _cachedNotes.push({id: noteId, note: res.data[noteId], visible: true});
      }
      m_pubsub.trigger('cache:ready');
    }).fail(function (res) {
      console.log('FAIL /get-cached-notes', res);
      m_pubsub.trigger('msgbox:crit',  res.message.replace(/\n/g, '<br />'));
    });

    exports.reloadKeywords();
  };

  exports.reloadKeywords = function() {
    m_ajax.postJSON('/get-cached-keywords', { }).done(function (res) {
      console.log('DONE /get-cached-keywords', res);
      _cachedKeywords = res.data;
    }).fail(function (res) {
      console.log('FAIL /get-cached-keywords', res);
    });
  };

  exports.sortNotes = function (noteArr, descending) {
    return noteArr.sort(function (a, b) {
        var an, bn;
        if (a.note.date !== b.note.date) {
          an = a.note.date, bn = b.note.date;
        } else if (a.note.name !== b.note.name) {
          an = a.note.name, bn = b.note.name;
        } else {
          an = a.id, bn = b.id;
        }
        return descending ? bn.localeCompare(an) : an.localeCompare(bn);
    });
  };

  exports.cacheNote = function (noteId, note) {
    var i = _findNotePos(noteId);
    if (i !== false) {
      _cachedNotes[i].note = note;
    } else {
      _cachedNotes.push({id: noteId, note: note});
    }
    _cachedBoxedNotes = {};
    m_pubsub.trigger('cache:cached', noteId);
  };

  /**
   * Remove note from client cache.
   *
   * @param {String} noteId
   */
  exports.uncacheNote = function (noteId) {
    var i = _findNotePos(noteId);
    if (i !== false) {
      delete _cachedNotes[i];
      _cachedBoxedNotes = {};
    }
    m_pubsub.trigger('cache:uncached', noteId);
  },

  exports.getNotes = function (boxName) {
    var notes = [];
    if (!boxName) {
      notes = _cachedNotes;
    } else {
      if (_cachedBoxedNotes[boxName]) return _cachedBoxedNotes[boxName];
      for (var i in _cachedNotes) {
        var n = _cachedNotes[i];
        if (n.note.box === boxName) notes.push(n);
      }
    }
    return _cachedBoxedNotes[boxName] = this.sortNotes(notes, true);
  };

  exports.getKeywords = function (boxName) {
    return boxName ? _cachedKeywords[boxName] : _cachedKeywords;
  };

  return exports;
})();

// ==========================================================================================

var m_router = (function () {
  'use strict';

  var exports = {};

  // note: move everything but routes out if the router object
  var _router = new (Backbone.Router.extend({
    routes: {
      '':                         'index',

      'show/:box':                'showBox',
      'show/:box/':               'showBox',
      'show/:box/:note':          'showNote',
      'show/:box/:note/':         'showNote',
      'browse/:box/:note':        'browseNote',
      'browse/:box/:note/*all':   'browseNote',

      'showall/:box':             'showBox',
      'showall/:box/':            'showBox',
      'showall/:box/:note':       'showNote',
      'showall/:box/:note/':      'showNote'
    },

    prevNoteUri: '',
    prevMode: '',

    curMode: 'browse-box',
    curBox: '',
    curNote: '',
    curSubdir: '',

    update: function (mode, box, note, subdir) {
      this.prevNoteUri = exports.getCurrentNoteUri();

      this.prevMode = this.curMode;
      this.curMode = mode;
      this.curBox = box;
      this.curNote = note;
      this.curSubdir = subdir;

      console.log('Router current: ', exports.getCurrentUri());
    },

    triggerEvents: function (mode, box, note, subdir) {
      var boxChanged = box !== this.curBox && this.curBox !== srv.anyBox;
      var noteChanged = note !== this.curNote;

      this.update(mode, box, note, subdir || '');
      m_pubsub.trigger('router:' + mode, box, note, subdir || '');

      boxChanged && m_pubsub.trigger('router:change-box', box, note);
      noteChanged && m_pubsub.trigger('router:change-note', box, note);
    },

    index: function() {
      exports.show(srv.defaultBox);
    },

    showBox: function(box) {
      //console.log("Showing box: ", box);
      this.update('show-box', box, '', '');
      m_pubsub.trigger('router:show-box', box);
    },

    showNote: function(box, note) {
      //console.log("Showing note: %s -> %s", box, note);
      this.triggerEvents('show-note', box, note, '');
    },

    browseNote: function(box, note, subdir) {
      //console.log("Browsing note: %s -> %s -> %s", box, note,  subdir || '');
      this.triggerEvents('browse-note', box, note, subdir || '');
    }
  }));

  exports.wasInBrowseNoteMode = function () {
    return _router.prevMode === 'browse-note';
  };

  exports.isInBrowseNoteMode = function () {
    return _router.curMode === 'browse-note';
  };

  exports.getPreviousNoteUri = function () {
    return _router.prevNoteUri;
  };

  exports.getCurrentBoxUri = function () {
    return _router.curBox;
  };

  exports.getCurrentNoteUri = function () {
    if (!_router.curNote) return _router.curBox;
    return _router.curBox + '/' + _router.curNote;
  };

  exports.getCurrentUri = function () {
      if (!_router.curNote) return _router.curBox;
      if (!_router.curSubdir) return _router.curBox + '/' + _router.curNote;
      return _router.curBox + '/' + _router.curNote + '/' + _router.curSubdir;
  };

  exports.getShowAllUriPrefix = function () {
      return 'showall/';
  };

  exports.getShowUriPrefix = function () {
      return 'show/';
  };

  exports.getBrowseUriPrefix = function () {
      return 'browse/';
  };

  /**
   * Tells if show-box and show-note should display notes from all boxes.
   * 
   * @returns {bool}
   */
  exports.isInAnyBox = function () {
    var uri = Backbone.history.fragment;
    return uri.indexOf('showall/') === 0;
  };

  /**
   *
   * @param {String} uri
   * @param {bool} singleBox
   */
  exports.show = function (uri, singleBox) {
    var prefix = uri === srv.anyBox || (!singleBox && this.isInAnyBox()) ? 'showall/' : 'show/';
    Backbone.history.navigate(prefix + uri, true);
  };

  /**
   *
   * @param {String} uri
   */
  exports.browse = function (uri) {
    Backbone.history.navigate('browse/' + uri, true);
  };

  exports.init = function () {
    Backbone.history.start();
  };

  return exports;
})();

// ==========================================================================================

var m_keyboard = (function () {
  'use strict';

  var exports = {};

  var _bindingsUp = {};
  var _bindingsDown = {};
  var _bindingsPress = {};

  // TODO: Extract this to a separate config file
  _bindingsPress[_key('enter')]= { altKey: false, targets: [ ['edit-keywords', 'focus-editor'], ['edit-name', 'focus-keywords'] ] };

  _bindingsUp[_char('Q')]= { altKey: true, targets: [ ['*', 'focus-templates'] ] };
  _bindingsUp[_char('A')]= { altKey: true, targets: [ ['*', 'focus-boxes'] ] };
  _bindingsUp[_char('Z')]= { altKey: true, targets: [ ['*', 'focus-name'] ] };
  _bindingsUp[_char('X')]= { altKey: true, targets: [ ['*', 'focus-keywords'] ] };
  _bindingsUp[_char('C')]= { altKey: true, targets: [ ['*', 'focus-editor'] ] };
  _bindingsUp[_key('up')]= { altKey: true, targets: [ ['*', 'navigate-up'] ] };
  _bindingsUp[_key('down')]= { altKey: true, targets: [ ['*', 'open'] ] };
  _bindingsUp[_key('delete')]= { altKey: true, targets: [ ['*', 'trash'] ] };

  _bindingsUp[_key('escape')]= { altKey: false, targets: [
      ['*', 'focus-filters'],
      ['filter-phrase', 'focus-editor'],
      ['edit-keywords', 'focus-editor'],
      ['edit-name', 'focus-editor']
  ]};

  _bindingsDown[_key('left')]= { altKey: false, targets: [ ['breadcrumbs', 'focus-breadcrumbs-prev'] ] };
  _bindingsDown[_key('right')]= { altKey: false, targets: [ ['breadcrumbs', 'focus-breadcrumbs-next'] ] };

  _bindingsDown[_key('down')]= { altKey: false, targets: [ 
      ['*', 'focus-items-next'],
      ['boxes', 'focus-boxes-next'],
      ['templates', 'focus-templates-next'],
      ['filter-phrase', 'focus-items-first']
  ]};

  _bindingsDown[_key('up')]= { altKey: false, targets: [
      ['*', 'focus-items-prev'],
      ['boxes', 'focus-boxes-prev'],
      ['templates', 'focus-templates-prev']
  ]};

  function _fire(evt, bindings) {
    var binding = bindings[evt.keyCode];
    if (!binding) return;
    if (binding.altKey !== evt.altKey) return;

    var $target = $(evt.target);
    var t = binding.targets.length - 1, target = binding.targets[t];
    while (t >= 0) {
      target = binding.targets[t];
      if ((target[0] && $target.hasClass(target[0])) || target[0] === '*') break;
      if (--t < 0) target = [];
    }

    if (!target[0]) return;
    
    //console.log("FIRE keyboard:" + target[1]);
    m_pubsub.trigger('keyboard:' + target[1], evt);
  }
  
  function _key(key) {
    return $.ui.keyCode[key.toUpperCase()];
  }

  function _char(char) {
    return char.charCodeAt(0);
  }

  exports.init = function () {
    $('body').on('keyup keydown keypress', function (evt) {
        //console.log(evt.type + ': ' + (evt.altKey? '+alt' : '-alt'), ' ', evt.keyCode, ' -> ', evt);
        if (evt.type === 'keyup')     _fire(evt, _bindingsUp);
        if (evt.type === 'keydown')   _fire(evt, _bindingsDown);
        if (evt.type === 'keypress')  _fire(evt, _bindingsPress);
    });
  };

  return exports;
})();
