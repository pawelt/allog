// ==========================================================================================
// Base view with some added utilities
// ==========================================================================================

var Allog = Allog || {};

Allog.View = Backbone.View.extend({
  ajax: {
  },

  // Utility function to send AJAX POST requests.
  // The function uses mappings from this.ajax object to map
  // done and fail callbacks. For example:
  //
  //    ajax: {
  //      '/launch':  'Launch'
  //    },
  //
  //    onOpenClick: function (evt) {
  //      evt.preventDefault();
  //      var $this = $(evt.target);
  //      this.ajaxPost('/launch', { itemUri: $this.data('uri') });
  //    },
  //
  //    doneLaunch: function(res) {
  //    },
  //
  //    failLaunch: function(res) {
  //    },
  //
  ajaxPost: function (url, params) {
    params = params || {};
    var handlerName = this.ajax[url];
    if (!handlerName) {
      console.error('Error: handlers for ajax call ' + url + ' not found');
      return;
    }
    var doneName = 'done' + handlerName;
    var done = this[doneName];
    if (!done) {
      console.error('Error: handler "' + doneName + '" for ajax call ' + url + ' not defined');
      return;
    }
    var failName = 'fail' + handlerName;
    var fail = this[failName];
    if (!fail) {
      console.error('Error: handler "' + failName + '" for ajax call ' + url + ' not defined');
      return;
    }
    var self = this;
    m_ajax.postJSON(url, params).done(function (res) {
      console.log('AJAX DONE %s: ', url, res);
      _.bind(done, self)(res);
    }).fail(_.bind(function (res) {
      console.log('AJAX FAIL %s: ', url, res);
      var msg =  res.message || res.error;
      m_pubsub.trigger('msgbox:error',  msg.replace(/\n/g, '<br />'));
      _.bind(fail, self)(res);
    }, this));
  }

});

// ==========================================================================================

var BvEditor = Allog.View.extend({

  setText: function (text) {
    this.$editor.show();
    this.editor.swapDoc(CodeMirror.Doc(text, 'gfm'));
  },

  getText: function () {
    return this.editor.getDoc().getValue();
  },

  isClean: function () {
    return this.editor.getDoc().isClean();
  },

  markClean: function () {
    this.editor.getDoc().markClean();
  },

  setReadonly: function (flag) {
    this.editor.setOption('readOnly', !!flag);
  },

  isReadonly: function () {
    return this.editor.getOption('readOnly');
  },

  hide: function () {
    this.$editor.hide();
  },

  render: function() {
    this.editor.refresh();
    return this;
  },

  getLastActivityTime: function () {
    return this.lastActivity || new Date();
  },

  initialize: function() {

    this.editor = CodeMirror.fromTextArea(this.$el[0], {
      lineNumbers: false,
      lineWrapping: true,
      indentUnit: 4,
      tabSize: 4,
      indentWithTabs: false,
      theme: "allog",
      onKeyEvent: _.bind(function () { this.lastActivity = new Date(); }, this),
      extraKeys: {"Enter": "newlineAndIndentContinueMarkdownList"}
    });

    // replace tabs with spaces
    var _editor = this.editor;
    this.editor.addKeyMap({
      Tab: function(cm) {
        var spaces = Array(cm.getOption("indentUnit") + 1).join(" ");
        _editor.replaceSelection(spaces, "end", "+input");
      }
    });

    this.$editor = this.$el.parent().find('.CodeMirror-wrap');
    this.hide();

    // click and dblclick events don't work too well in CodeMirror, so use mouseup event instead.
    var prevMouseUp = new Date().getTime();
    this.$editor.on('mouseup', function (evt) {
      if (prevMouseUp + 400 > (new Date().getTime())) {
        var pos = _editor.getCursor();
        var token = _editor.getTokenAt(pos).string;
        var matches = token.match(/^(\(|<)?(http[^)>]+)(\)|>)?$/);
        var url = matches && matches.length >= 3 ? matches[2] : '';
        if (url) {
          console.log('Launching URL: ', url);
          window.open(url, '_blank');
        }
      }
      prevMouseUp = new Date().getTime();
    });

    this.listenTo(m_pubsub, 'keyboard:focus-editor', function () {
      _editor.focus();
    });
  }

});


var BvMeta = Allog.View.extend({

  events: {
    'click .contents-open':     'onOpenClick',
    'click .contents-trash':    'onTrashClick',
    'click .contents-save':     'onSaveClick',
    'click .contents-discard':  'onDiscardClick'
  },

  ajax: {
    '/launch':      'Launch'
  },

  onOpenClick: function (evt) {
    evt.preventDefault();
    var $this = $(evt.target);
    this.ajaxPost('/launch', { itemUri: $this.data('uri') });
  },

  doneLaunch: function(res) {
  },

  failLaunch: function(res) {
  },

  onTrashClick: function (evt) {
    evt.preventDefault();
    m_pubsub.trigger('index:trash');
  },

  onSaveClick: function (evt) {
    evt.preventDefault();
    m_pubsub.trigger('index:save');
  },

  onDiscardClick: function (evt) {
    evt.preventDefault();
    m_pubsub.trigger('index:discard');
  },

  isClean: function () {
    return this.modifiedKeywords === false && this.modifiedName === false && this.modifiedDate === false;
  },

  markClean: function () {
    this.modifiedKeywords = false;
    this.modifiedName = false;
    this.modifiedDate = false;
  },

  getModifiedKeywords: function () {
    return this.modifiedKeywords;
  },

  getModifiedName: function () {
    return this.modifiedName;
  },

  getModifiedDate: function () {
    return this.modifiedDate;
  },

  hide: function () {
    this.$el.empty();
  },

  render: function(index) {
    this.$el.html(this.tplMeta({uri: m_router.getCurrentNoteUri(), note: index}));

    $('.note-modified').html('Modified: ' + index.mdate);

    this.$editKeywords = this.$el.find('.contents-keywords-value');
    this.$editName = this.$el.find('.contents-name-value');
    this.$editDate = this.$el.find('.contents-date-time-value');

    function initAutocomplete($elem) {
      $elem.autocomplete({
        minLength: 0,
        source: function(request, response) {
          response($.ui.autocomplete.filter(m_cache.getKeywords(m_router.getCurrentBoxUri()), extractLast(request.term)));
        },
        focus: function() {
          return false;
        },
        search: function(evt, ui ) {
          //$('.ui-autocomplete').css('max-height', 50);
        },
        close: function(evt) {
          //$(this).autocomplete('disable');
        },
        select: function(evt, ui) {
          var terms = split(this.value);
          terms.pop();
          terms.push(ui.item.value);
          terms.push("");
          this.value = terms.join(", ");
          return false;
        }
      })
      //.autocomplete('disable')
      .on('keydown', function(evt) {
        if ((evt.keyCode === $.ui.keyCode.SPACE || evt.keyCode === $.ui.keyCode.DOWN) && evt.ctrlKey) {
          $(this).autocomplete('enable').autocomplete('search');
          return false;
        }
      });

      function split(val) {
        return val.split(/,\s*/);
      }

      function extractLast(term) {
        return split(term).pop();
      }
    }

    this.$editName.editable({
      mode:         'inline',
      onblur:       'ignore',
      type:         'text',
      placeholder:  'Note name',
      inputclass:   'input-medium' + ' edit-name'
    }).on('save', _.bind(function(e, params) {
      this.modifiedName = params.newValue;
      m_pubsub.trigger('index:move');
    }, this));

    this.$editKeywords.editable({
      mode:         'inline',
      onblur:       'ignore',
      type:         'text',
      placeholder:  'Keywords',
      inputclass:   'input-medium' + ' edit-keywords'
    }).on('save', _.bind(function(e, params) {
      this.modifiedKeywords = params.newValue;
      m_pubsub.trigger('index:save');
    }, this)).on('shown', _.bind(function() {
      initAutocomplete(this.$editKeywords.data('editable').input.$input);
    }, this));

    this.$editDate.editable({
      mode:         'popup',
      onblur:       'ignore',
      type:         'date',
      placeholder:  'Keywords',
      inputclass:   'input-medium' + ' edit-date'
    }).on('save', _.bind(function(e, params) {
      this.modifiedDate = DateUtil.toNormalizedDT(DateUtil.zeroTimezone(params.newValue + ''));
      m_pubsub.trigger('index:move');
    }, this));

    m_pubsub.trigger('index-meta:rendered');
    return this;
  },

  initialize: function() {
    this.tplMeta = _.template($('#tpl-note-meta').html());
    this.modifiedKeywords = false;
    this.modifiedName = false;
    this.modifiedDate = false;

    this.listenTo(m_pubsub, 'keyboard:focus-name', _.bind(function () { this.$editName && this.$editName.data('editable').show(); }, this));
    this.listenTo(m_pubsub, 'keyboard:focus-keywords', _.bind(function () { this.$editKeywords && this.$editKeywords.data('editable').show(); }, this));
    this.listenTo(m_pubsub, 'keyboard:open', _.bind(function () { this.$el.find('.contents-open').click(); }, this));
    this.listenTo(m_pubsub, 'keyboard:trash', _.bind(function () { this.$el.find('.contents-trash').click(); }, this));
  }

});

var BvIndex = Allog.View.extend({

  ajax: {
    '/trash-note':      'TrashNote',
    '/move-note':       'MoveNote',
    '/save-note-index': 'SaveNoteIndex',
    '/get-note-index':  'GetNoteIndex'
  },

  onSaveIndex: function () {
    if (this.isSaving) return;
    this.isSaving = true;

    var modifiedIndex = _.extend({}, this.index);
    modifiedIndex.text = this.vEditor.getText();

    var modifiedKeywords = this.vMeta.getModifiedKeywords();
    if (modifiedKeywords) {
      modifiedIndex.meta.keywords = modifiedKeywords.trim();
    }

    this.ajaxPost('/save-note-index', { itemUri: this.noteId, index: modifiedIndex });
  },

  doneSaveNoteIndex: function(res) {
    this.saveFailed = false;
    this.isSaving = false;

    m_cache.cacheNote(this.noteId, res.data);
    m_cache.reloadKeywords();

    this.index = res.data;
    this.vMeta.render(res.data);
    this.vEditor.markClean();
    this.vMeta.markClean();

    this.updateIndexStats();

    m_pubsub.trigger('index:saved', res.data);
  },

  failSaveNoteIndex: function(res) {
    this.saveFailed = true;
    this.isSaving = false;
    var msg = 'Allog couldn\'t save note changes.\n\nPlease save your note with copy & paste and then rebuild allog cache.';
    m_pubsub.trigger('msgbox:crit', msg);
  },

  updateIndexStats: function() {
    var text = this.vEditor.getText();
    var words = text.split(/\s+/gm);
    var wordCount = words.length - 1, charCount = text.length;

    $('.note-stats').html('Words: <strong>' + wordCount + '</strong> &nbsp;&nbsp;&nbsp; Letters: <strong>' + charCount + '</strong>');
  },

  onMove: function () {
    if (this.isSaving) return;
    this.isSaving = true;

    var modifiedIndex = _.extend({}, this.index);
    modifiedIndex.text = '';
    modifiedIndex.meta = {};

    var modifiedName = this.vMeta.getModifiedName();
    if (modifiedName) {
      modifiedIndex.name = modifiedName.trim();
    }

    var modifiedDate = this.vMeta.getModifiedDate();
    if (modifiedDate) {
      // use the old note time, and the modified date
      modifiedIndex.date = modifiedDate.substring(0, 11) + modifiedIndex.date.substring(11);
    }

    this.ajaxPost('/move-note', { itemUri: this.noteId, index: modifiedIndex });
  },

  doneMoveNote: function(res) {
    this.isSaving = false;

    var newNote = res.data.note;
    var newNoteId = res.data.noteId;

    m_cache.uncacheNote(this.noteId);
    m_cache.cacheNote(newNoteId, newNote);
    m_cache.reloadKeywords();

    this.index = newNote;
    this.noteId = newNoteId;
    m_router.browse(this.noteId);
  },

  failMoveNote: function(res) {
    this.isSaving = false;
  },

  onTrash: function () {
    if (!confirm('Are you sure you want to trash note:\n\n  ' + this.noteId + '\n\n' +
                 '  Note file count: '  + this.index.fileCount)) return;
    this.ajaxPost('/trash-note', { itemUri: this.noteId });
  },

  doneTrashNote: function (res) {
    m_pubsub.trigger('msgbox:info',  'Message "' + this.noteId + '" trashed');
    m_cache.uncacheNote(this.noteId);
    this.noteId = '';
    this.index = null;
    m_router.show(m_router.getCurrentBoxUri());
  },
      
  failTrashNote: function (res) {
  },

  onChangeNoteRoute: function () {
    // if save failed, don't clear the editor to prevent data loss
    if (this.saveFailed) return;

    // if editor is not clean, call onSaveIndex()
    // and schedule calling self once on index:saved event
    if (!this.vEditor.isClean()) {
      if (srv.autosave) {
        this.listenToOnce(m_pubsub, 'index:saved', _.bind(function () {
          if (this.vEditor.isClean()) {
            this.onChangeNoteRoute();
          }
        }, this));
        this.onSaveIndex();
      } else {
        alert('Please save or discard changes in the note');
      }
      return;
    }

    this.ajaxPost('/get-note-index', { itemUri: m_router.getCurrentNoteUri() });
  },

  doneGetNoteIndex: function (res) {
    var index = res.data;
    this.saveFailed = false;
    this.noteId = m_router.getCurrentNoteUri();
    this.index = index;
    this.vMeta.render(index);
    this.vEditor.setText(index.text);

    this.updateIndexStats();

    // for new notes, focus editor right away
    var noteDate = DateUtil.fromNormalizedString(index.date);
    var now = DateUtil.zeroTimezone(new Date());
    if (Math.abs(now - noteDate) < 3000) m_pubsub.trigger('keyboard:focus-editor');
  },


  failGetNoteIndex: function (res) {
  },

  onNoteUncached: function () {
    this.vMeta.hide();
    this.vEditor.hide();
  },

  onDiscard: function () {
    this.vMeta.render(this.index);
    this.vEditor.setText(this.index.text);
  },

  initialize: function() {
    this.vEditor = new BvEditor({el: '.contents-editor textarea'});
    this.vMeta = new BvMeta({el: '.contents-headers'});

    this.listenTo(m_pubsub, 'router:change-note', this.onChangeNoteRoute);
    this.listenTo(m_pubsub, 'cache:uncached', this.onNoteUncached);

    this.listenTo(m_pubsub, 'index:fetched', this.onIndexFetched);
    this.listenTo(m_pubsub, 'index:save', this.onSaveIndex);
    this.listenTo(m_pubsub, 'index:move', this.onMove);
    this.listenTo(m_pubsub, 'index:trash', this.onTrash);
    this.listenTo(m_pubsub, 'index:discard', this.onDiscard);

    if (srv.autosave) {
      setInterval(_.bind(function () {
        var now = new Date().getTime();
        var act = this.vEditor.getLastActivityTime().getTime();
        if (now < act + srv.autosave) return;
        if (!this.saveFailed && !this.vEditor.isClean()) this.onSaveIndex();
      }, this), srv.autosave);
    }
  }

});


// ==========================================================================================

/**
 * Represents a group of links in the actions region.
 * Links trigger group-specific event on click.
 */
var BvActionsGroup = Allog.View.extend({

  items: [],

  events: {
    'click [data-name]': 'onClick'
  },

  onClick: function(evt) {
    evt.preventDefault();
    var $this = $(evt.target);
    //console.log($this.data('action') + ': ' + $this.data('name'));
    m_pubsub.trigger($this.data('action'), $this.data('name'));
  },

  render: function() {
    this.$el.html(this.tplLi({ action: this.action, items: this.items, hrefPrefixes: this.hrefPrefixes }));
    return this;
  },

  initialize: function(opts) {
    this.items = opts.items;
    this.action = opts.action;
    this.hrefPrefixes = opts.hrefPrefixes;
    this.tplLi = _.template($('#tpl-actions-item').html());
  }

});

// ==========================================================================================

var BvActions = Allog.View.extend({

  ajax: {
    '/launch':              'Launch',
    '/clone-note-template': 'CloneNoteTemplate'
  },

  onOpenSpecial: function (special) {
    this.ajaxPost('/launch', { itemUri: special, itemType: 'special' });
  },

  doneLaunch: function(res) {
  },
      
  failLaunch: function(res) {
  },

  onSwitchBox: function (box) {
    m_router.show(box, true);
  },

  onNewNote: function (template) {
    var box = m_router.isInAnyBox() ? srv.defaultBox : m_router.getCurrentBoxUri();
    this.ajaxPost('/clone-note-template', {template: template, box: box });
  },

  doneCloneNoteTemplate: function(res) {
    m_cache.cacheNote(res.data.noteId, res.data.note);
    m_router.browse(res.data.noteId);
  },

  failCloneNoteTemplate: function(res) {
  },

  updateCurrentBox: function (box) {
    box = m_router.isInAnyBox() ? srv.anyBox : box;
    this.boxList.$el.find('.current').removeClass('current');
    this.boxList.$el.find('[data-name="' + box + '"]').parent().addClass('current');
  },

  children: [],
  boxList: null,

  render: function() {
    for (var i = 0, child; child = this.children[i++];) {
      child.render();
    }

    this.boxList.$el.find('[data-name="' + srv.defaultBox + '"]').addClass('default');
    return this;
  },

  initialize: function() {

    function initChild(el, action, items, hrefPrefixes) {
      return new BvActionsGroup({
        el:           el,
        action:       action,
        items:        items,
        hrefPrefixes: hrefPrefixes || []
      });
    }

    var hrefPrefixes = srv.boxes.map(function (box) {
      if (box === srv.anyBox) return m_router.getShowAllUriPrefix();
      return m_router.getShowUriPrefix();
    });
    this.boxList = initChild('.links-switch-box', 'boxes:switch-box', srv.boxes, hrefPrefixes);
    this.children.push(this.boxList);
    this.children.push(initChild('.links-new-note', 'templates:new-note', srv.templates));
    this.children.push(initChild('.links-open-special', 'specials:open-special', srv.specials));

    this.listenTo(m_pubsub, 'specials:open-special', this.onOpenSpecial);
    this.listenTo(m_pubsub, 'boxes:switch-box', this.onSwitchBox);
    this.listenTo(m_pubsub, 'templates:new-note', this.onNewNote);

    this.listenTo(m_pubsub, 'router:show-box router:change-box', this.updateCurrentBox);
    this.listenTo(m_pubsub, 'router:browse-note', this.updateCurrentBox);

    var focusNext = _.bind(function (evt, moveForward) {
      var $curBox = this.$el.find('a:focus').parent();
      var $nextBox = moveForward ? $curBox.next() : $curBox.prev();
      $nextBox.find('a').focus();
    }, this);

    this.listenTo(m_pubsub, 'keyboard:focus-boxes-next', function (evt) { focusNext(evt, true); });
    this.listenTo(m_pubsub, 'keyboard:focus-boxes-prev', function (evt) { focusNext(evt, false); });
    this.listenTo(m_pubsub, 'keyboard:focus-boxes', _.bind(function () { this.$el.find('.links-switch-box .current a').first().focus(); }, this));
    this.listenTo(m_pubsub, 'keyboard:focus-templates-next', function (evt) { focusNext(evt, true); });
    this.listenTo(m_pubsub, 'keyboard:focus-templates-prev', function (evt) { focusNext(evt, false); });
    this.listenTo(m_pubsub, 'keyboard:focus-templates', _.bind(function () { this.$el.find('.links-new-note a').first().focus(); }, this));

    this.render();
  }

});


// ==========================================================================================

var BvBreadcrumbs = Allog.View.extend({

  uris: [],

  events: {
    'click a': 'onClick'
  },

  onClick: function (evt) {
    evt.preventDefault();
    var $this = $(evt.target);
    var uri = $this.data('uri');
    if (uri.split('/').length === 1) {
      m_router.show(uri);
    } else {
      m_router.browse(uri);
    }
  },

  render: function() {
    var uris = this.uris.slice();
    var lastUri = uris.pop();
    this.$el.html(this.tplBc({uris: uris, lastUri: lastUri, isInAnyBox: m_router.isInAnyBox()}));
    m_pubsub.trigger('breadcrumbs:rendered');
    return this;
  },

  buildUris: function(box, note, subdir) {
    this.uris = [];
    if (!box) return;

    if (box !== srv.anyBox) {
      this.uris.push({name: srv.anyBox, uri: srv.anyBox, hrefPrefix: m_router.getShowAllUriPrefix()});
      if (!note && m_router.isInAnyBox()) return;
    }

    var segUri = box;
    this.uris.push({name: box, uri: segUri, hrefPrefix: m_router.getShowUriPrefix()});
    if (!note) return;
    
    segUri += '/' + note;
    this.uris.push({name: note, uri: segUri, hrefPrefix: m_router.getBrowseUriPrefix()});
    if (!subdir) return;

    var subdirs = subdir.split('/');
    var curSubdir = subdirs.pop();

    for (var i in subdirs) {
      var sd = subdirs[i];
      segUri += '/' + sd;
      this.uris.push({name: sd, uri: segUri, hrefPrefix: m_router.getBrowseUriPrefix()});
    }

    this.uris.push({name: curSubdir, uri: '/' + curSubdir });
  },

  initialize: function() {

    this.tplBc = _.template($('#tpl-breadcrumbs').html());

    function buildFull(box, note, subdir) {
      this.buildUris(box, note, subdir);
      this.render();
    }

    function buildBoxOnly(box) {
      this.buildUris(box);
      this.render();
    }

    this.listenTo(m_pubsub, 'router:show-box', buildBoxOnly);
    this.listenTo(m_pubsub, 'router:show-note', buildBoxOnly);
    this.listenTo(m_pubsub, 'router:browse-note', buildFull);

    var focusNext = _.bind(function (evt, moveForward) {
      var $curBreadcrumb = this.$el.find('a:focus');
      var $nextBreadcrumb = moveForward ? $curBreadcrumb.next() : $curBreadcrumb.prev();
      $nextBreadcrumb.focus();
    }, this);

    this.listenTo(m_pubsub, 'keyboard:focus-breadcrumbs-next', function (evt) { focusNext(evt, true); });
    this.listenTo(m_pubsub, 'keyboard:focus-breadcrumbs-prev', function (evt) { focusNext(evt, false); });
    this.listenTo(m_pubsub, 'keyboard:focus-breadcrumbs', _.bind(function () { this.$el.find('a').focus(); }, this));
  }

});

// ==========================================================================================

var BvItems = Allog.View.extend({

  events: {
    'click .items-item':      'onShowClick',
    'click .item-note-name':  'onBrowseClick',
    'click .item-dir-name':   'onBrowseClick',
    'click .item-file-name':  'onLaunchClick'
  },

  ajax: {
    '/launch':                'Launch',
    '/get-note-file-list':    'GetNoteFileList'
  },

  onLaunchClick: function (evt) {
    evt.preventDefault();
    var $this = $(evt.target);
    this.ajaxPost('/launch', { itemUri: $this.data('uri') });
    return false;
  },

  doneLaunch: function(res) {
  },

  failLaunch: function(res) {
  },

  onBrowseClick: function (evt) {
    evt.preventDefault();
    var $this = $(evt.target);
    m_router.show($this.data('uri')); // so the back button works better
    m_router.browse($this.data('uri'));
    return false;
  },

  onShowClick: function (evt) {
    evt.preventDefault();
    var $this = $(evt.target);
    var uri = $this.data('uri');
    // skip any note subdir routes
    if (uri.split('/').length > 2) return;
    m_router.show($this.data('uri'));
  },

  setItemsAndRender: function (items) {
    this.items = items;
    this.render();
    this.$el.find('li a').eq(0).focus();
    this.$el.find('li').first().addClass('current');
  },

  onBrowseNoteRoute: function (box, note, subdir) {
    this.setItemsAndRender([]); // should show some loading spinner here...
    this.ajaxPost('/get-note-file-list', { itemUri: m_router.getCurrentUri() });
  },

  doneGetNoteFileList: function (res) {
    this.setItemsAndRender(res.data);
  },

  failGetNoteFileList: function (res) {
  },

  onShowNoteRoute: function (box, note) {
    if (!this.items || m_router.wasInBrowseNoteMode()) {
      this.items = m_cache.getNotes(m_router.isInAnyBox() ? '' : box);
      this.render();
    }
    this.selectCurrentNote(m_router.getCurrentNoteUri());
  },

  onShowBoxRoute: function (box) {
    this.items = m_cache.getNotes(m_router.isInAnyBox() ? '' : box);
    this.render();
    this.selectCurrentNote(m_router.getPreviousNoteUri());
  },

  onNoteCached: function (noteId) {
    // prevent navigation when browsing files and after autosaves
    if (m_router.isInBrowseNoteMode()) return;
    if (noteId === m_router.getCurrentNoteUri()) return;
    this.items = null;
    this.onShowNoteRoute(m_router.getCurrentBoxUri());
  },

  onNoteUncached: function () {
  },

  selectCurrentNote: function (noteUri) {
//    var d1 = new Date();
    this.$el.find('li.current').removeClass('current');
    var $curNote = this.$el.find('li[data-uri="' + noteUri + '"]');
    if (!$curNote[0]) {
      $curNote = this.$el.find('li[data-uri]').eq(0);
      if ($curNote[0]) m_router.show($curNote.data('uri'));
      return;
    }
    $curNote.addClass('current');
    this.scrollToCurrent(true);
//    var d2 = new Date();
//    console.log("Select current note: ", d2-d1);
  },

  scrollToCurrent: function (focusAfterScroll) {
    var $curNote = this.$el.find('li.current[data-uri]');
    if (!$curNote[0]) return;
    //$curNote[0].scrollIntoView(false);
    var $notesContainer = this.$el.parent();
    var containerTop = $notesContainer.scrollTop();
    var containerHeight = $notesContainer.height();
    var containerBot = containerTop + containerHeight;
    var curNoteTop = $curNote.position().top + containerTop;
    var curNoteHeight = $curNote.height();
    var curNoteBot = curNoteTop + curNoteHeight;

    var _focusCurrent = function () { 
      if (focusAfterScroll) $curNote.find('a').eq(0).focus();
    };
    if (curNoteTop < containerTop || curNoteBot > containerBot) {
      var delta = curNoteTop - containerHeight + curNoteHeight*3 + 20;
      $notesContainer.stop(true, true).animate({scrollTop: delta + 'px'}, 300, _focusCurrent);
    } else {
      _focusCurrent();
    }
  },

  onFiltersChange: function(filters) {
//    var d1 = new Date();
    if (m_router.isInBrowseNoteMode()) return;

    var visibleCount = 0, totalCount = this.items.length;

    var filterParts = filters.toLowerCase().split(' ').map(function (part) { return part.trim(); });
    var filterPartsLen = filterParts.length;
    var $lis = this.$el.find('li'), $ulParent = this.$el.parent(), $ul = this.$el.detach();

    this.items.forEach(function(item, i) {
      var foundCount = 0, j = filterPartsLen, text = (item.note.meta.keywords + item.note.date + item.note.name).toLowerCase();
      while (j) {
        var fp = filterParts[--j];
        if (text.indexOf(fp) > -1 || !fp) foundCount++;
      }
      var wasVisible = item.visible, isVisible = foundCount === filterParts.length;
      visibleCount += isVisible ? 1 : 0;

      if (isVisible && wasVisible) return;
      if (!isVisible) $lis.eq(i).hide();
      else $lis.eq(i).show();
      item.visible = isVisible;
    });

    this.scrollToCurrent(true);
    $ulParent.append($ul);

    m_pubsub.trigger('items:stats', {visibleCount: visibleCount, totalCount: totalCount});

//    var d2 = new Date();
//    console.log("Filter change: ", d2-d1);
  },

  render: function() {
//    var d1 = new Date();

    m_pubsub.trigger('items:stats', {visibleCount: this.items.length, totalCount: this.items.length});

    if (m_router.isInBrowseNoteMode()) {
      this.$el.html(this.tplFiles({ files: this.items, parentUri: m_router.getCurrentUri(), hrefPrefix: m_router.getBrowseUriPrefix() }));
      console.log("File count: ", this.$el.children().length);
    } else {
      this.$el.html(this.tplNotes({ notes: this.items, hrefPrefix: m_router.getBrowseUriPrefix() }));
//      var d2 = new Date();
//      console.log("Render notes: ", d2-d1);
      console.log("Note count: ", this.$el.children().length);
    }

    return this;
  },

  initialize: function(evt) {
    this.tplNotes = _.template($('#tpl-note-items').html());
    this.tplFiles = _.template($('#tpl-file-items').html());
    this.listenTo(m_pubsub, 'router:browse-note', this.onBrowseNoteRoute);
    this.listenTo(m_pubsub, 'router:show-box', this.onShowBoxRoute);
    this.listenTo(m_pubsub, 'router:show-note', this.onShowNoteRoute);
    this.listenTo(m_pubsub, 'cache:cached', this.onNoteCached);
    this.listenTo(m_pubsub, 'cache:uncached', this.onNoteUncached);

    this.listenTo(m_pubsub, 'filters:change', this.onFiltersChange);

    var focusFirst = _.bind(function (evt) {
      evt.preventDefault();
      //var d1 = new Date();
      var $curNote = this.$el.find('li.current:visible');
      $curNote = $curNote[0] ? $curNote : this.$el.find('li:visible');
      if (!m_router.isInBrowseNoteMode()) m_router.show($curNote.data('uri'));
      $curNote.find('a').eq(0).focus();
      //var d2 = new Date();
      //console.log("Focus first: ", d2-d1);
    }, this);

    var _selectTimeout = null;

    var focusNext = _.bind(function (evt, moveForward) {
//      var d1 = new Date();
      var $focusedNoteLink = this.$el.find('a:focus').eq(0);
      if (!$focusedNoteLink[0]) return;
      evt.preventDefault();
      var $curNote = $focusedNoteLink.parent();
      var $nextNote = moveForward ? $curNote.nextAll(':visible').first() : $curNote.prevAll(':visible').first();
      if ($nextNote[0]) {
        if (m_router.isInBrowseNoteMode()) {
          this.$el.find('li.current').removeClass('current');
          $nextNote.addClass('current');
        } else {
          // timeout delays selected note rendering, so if user scrols the note list very fast,
          // we don't waste time requesting and rendering all notes selected in the process
          clearTimeout(_selectTimeout);
          _selectTimeout = setTimeout(function () { m_router.show($nextNote.data('uri')); }, 50);
        }
        $nextNote.find('a').eq(0).focus();
        $curNote.removeClass('current');
        $nextNote.addClass('current');
      }
//      var d2 = new Date();
//      console.log("Focus next: ", d2-d1);
    }, this);

    // this probably belongs to a dedicated footer/stats view...
    this.listenTo(m_pubsub, 'items:stats', function (stats) {
      $('.box-stats').html('Displaying <strong>' + stats.visibleCount + '</strong> of <strong>' + stats.totalCount + '</strong> notes');
    });

    this.listenTo(m_pubsub, 'keyboard:focus-items-first', function (evt) { focusFirst(evt); });
    this.listenTo(m_pubsub, 'keyboard:focus-items-next', function (evt) { focusNext(evt, true); });
    this.listenTo(m_pubsub, 'keyboard:focus-items-prev', function (evt) { focusNext(evt, false); });

    this.listenTo(m_pubsub, 'keyboard:navigate-up', _.bind(function () {
      if (m_router.isInAnyBox()) return;

      var segs = m_router.getCurrentUri().split('/');
      segs.pop();
      var newUri = segs.join('/');

      if (m_router.isInBrowseNoteMode()) {
        if (segs.length === 1)    m_router.show(newUri);
        else                      m_router.browse(newUri);
        return;
      }
      m_router.show(srv.anyBox);
    }, this));
  }

});


// ==========================================================================================

var BvMsgBox = Allog.View.extend({

  events: {
    'click a':      'onClick'
  },

  onClick: function (evt) {
    evt.preventDefault();
    var $this = $(evt.target);
    this.onExpired($this.parent().data('msgid'));
    return false;
  },

  render: function() {
    this.$el.empty();

    if (this.items.length === 0) {
      this.$el.hide();
      return this;
    }

    var html = '';
    for (var i = 0, item; item = this.items[i++];) {
      html += this.tplItem({ item: item });
    }
    this.$el.append('<ul>' + html + '</ul>');
    this.$el.fadeIn();
    return this;
  },

  // Message types: info, error, critical
  MsgItem: function(text, type) {
    this.type = type || 'info';
    this.text = '<strong>' + this.type + ':</strong> ' + text;
    this.closeLink = this.type !== 'critical' ? 'Okay' : '';
    this.id = parseInt(Math.random() * 100000);

    var self = this;
    if (type === 'info') {
      setTimeout(function () {
        $('li[data-msgid=' + self.id + ']').fadeOut(function () {
          m_pubsub.trigger('msgbox:expired', self.id);
        });
      }, 5000);
    }
  },

  onInfo: function(text) {
    this.items.push(new this.MsgItem(text, 'info'));
    this.render();
  },

  onError: function(text) {
    this.items.push(new this.MsgItem(text, 'error'));
    this.render();
  },

  onCrit: function(text) {
    this.items.push(new this.MsgItem(text, 'critical'));
    this.render();
  },

  onExpired: function(msgId) {
    console.log("EXP ", msgId);
    this.items = this.items.filter(function (item) { return item.id !== msgId; });
    this.render();
  },

  initialize: function() {
    this.items = [];
    this.tplItem = _.template($('#tpl-msgbox-item').html());

    this.listenTo(m_pubsub, 'msgbox:info', this.onInfo);
    this.listenTo(m_pubsub, 'msgbox:error', this.onError);
    this.listenTo(m_pubsub, 'msgbox:crit', this.onCrit);
    this.listenTo(m_pubsub, 'msgbox:expired', this.onExpired);
    this.render();
  }

});

// ==========================================================================================

var BvFilters = Allog.View.extend({

  events: {
    'click .filter-phrase-clear-x': 'onClearPhraseClick',
    'change .filter-saved':         'onSavedChange',
    'click .filter-phrase-save':    'onPhraseSaveClick',
    'click .filter-saved-delete':   'onSavedDeleteClick'
  },

  ajax: {
    '/save-filters':  'SaveFilters',
    '/fetch-filters': 'FetchFilters'
  },

  onClearPhraseClick: function (evt) {
    evt.preventDefault();
    var $this = $(evt.target);
    this.$filterPhrase.val('');
    m_pubsub.trigger('filters:change', this.$filterPhrase.val());
  },

  onSavedDeleteClick: function (evt) {
    evt.preventDefault();
    var $this = $(evt.target);
    var fs = this.$filterSaved[0];
    if (fs.selectedIndex > 0) this.$filterSaved.find('option').eq(fs.selectedIndex).remove();
    fs.selectedIndex = 0;
    this.saveFilters();
  },

  onPhraseSaveClick: function (evt) {
    evt.preventDefault();
    var $this = $(evt.target);

    var $fs = this.$filterSaved;
    var filters = this.$filterPhrase.val();

    var $alreadySaved = $fs.find('[value="' + filters + '"]');

    if ($alreadySaved[0]) {
      this.highlightSaved($alreadySaved.prop('value'));
      return;
    }

    var name = prompt('Name of the saved filer:');
    if (name) {
      $alreadySaved = null;
      this.$filterSaved.find('option').each(function () {
        var $opt = $(this);
        if ($opt.text() === name) $alreadySaved = $opt;
      });
      if ($alreadySaved) {
        this.highlightSaved($alreadySaved.prop('value'));
      } else {
        this.addSavedFilter(name, filters);
        this.saveFilters();
      }
    }

  },

  onSavedChange: function (evt) {
    evt.preventDefault();
    var $this = $(evt.target);
    this.$filterPhrase.val($this.val());
    m_pubsub.trigger('filters:change', this.$filterPhrase.val());
  },

  highlightSaved: function (selectedValue) {
    var $fs = this.$filterSaved, oldColor = $fs.css('background-color');
    $fs.animate( {backgroundColor: '#f00'}, 400 , function () { $fs.animate( {backgroundColor: oldColor}, 400 ); });
    $fs.val(selectedValue);
  },

  addSavedFilter: function (name, value) {
    var $fs = this.$filterSaved;
    $fs.append($('<option>' + name + '</option>').attr('value', value));
    $fs.val(value);
  },

  saveFilters: function() {
    var filters = {};
    this.$filterSaved.find('option').each(function () {
      var $opt = $(this);
      if ($opt.prop('value')) filters[$opt.text() + ''] = $opt.prop('value');
    });
    this.ajaxPost('/save-filters', { filters: JSON.stringify(filters) });
  },

  doneSaveFilters: function(res) {
  },

  failSaveFilters: function(res) {
  },

  doneFetchFilters: function(res) {
    Object.keys(res.data).forEach(_.bind(function (name) {
      var filters = res.data[name];
      this.addSavedFilter(name, filters);
      this.$filterSaved[0].selectedIndex = 0;
    }, this));
  },

  failFetchFilters: function(res) {
  },

  render: function() {
    return this;
  },

  initialize: function() {
    this.$filterPhrase = $('.filter-phrase');
    this.$filterSaved = $('.filter-saved');

    this.$filterSaved.append('<option value=""></option>');
    this.ajaxPost('/fetch-filters', { });

    var _applyFilters = _.bind(function () { m_pubsub.trigger('filters:change', this.$filterPhrase.val()); }, this);

    this.$filterPhrase.on('keyup', _applyFilters);
    this.listenTo(m_pubsub, 'router:show-box', _applyFilters);

    this.listenTo(m_pubsub, 'keyboard:focus-filters', _.bind(function () { this.$filterPhrase.select(); }, this));
    this.listenTo(m_pubsub, 'keyboard:focus-items', _.bind(function () { this.$filterPhrase.blur(); }, this));
  }

});

