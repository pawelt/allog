// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// Imports
// ----------------------------------------------------------------------------

var r_http =    require('http');
var r_express = require('express');
var r_cfg =     require('./config');
var r_routes =  require('./routes');
/** @returns {cache} */
var r_cache =   require('./lib/cache');

// ----------------------------------------------------------------------------
// Private
// ----------------------------------------------------------------------------

console.log(
    '\n============================  allog config  =============================' +
    '\n\n', r_cfg,  '\n'+
    '\n============================ /allog config  =============================' +
    '\n'
);

// ------------------------------------------------
// express
// ------------------------------------------------

var app = r_express();

app.configure(function() {
  app.set('port', r_cfg.app.port);
  app.set('views', r_cfg.web.views);
  app.set('view engine', 'jade');
  app.use(r_express.logger('dev'));
  app.use(r_express.static(r_cfg.web.statics));
  app.use(function(req, res, next) {
    if (req.url.indexOf('/favicon.ico') >= 0) {
      res.writeHead(200, {'Content-Type': 'image/x-icon'});
      res.end();
      console.log('empty favicon sent');
    } else {
      next();
    }
  });
  app.use(r_express.bodyParser());
  app.use(r_express.methodOverride());
  app.use(app.router);
});

app.configure('development', function() {
  app.use(r_express.errorHandler({dumpExceptions: true, showStack: true}));
});

app.configure('production', function() {
  app.use(r_express.errorHandler());
});


// ------------------------------------------------
// routes
// ------------------------------------------------
app.get('/*',                     r_routes.index);
app.post('/rebuild-cache',        r_routes.rebuildCache);
app.post('/trash-note',           r_routes.trashNote);
app.post('/move-note',            r_routes.moveNote);
app.post('/clone-note-template',  r_routes.cloneNoteTemplate);
app.post('/launch',               r_routes.launch);
app.post('/get-cached-keywords',  r_routes.getCachedKeywords);
app.post('/get-cached-notes',     r_routes.getCachedNotes);
app.post('/get-note-file-list',   r_routes.getNoteSubdir);
app.post('/get-note-index',       r_routes.getNoteIndex);
app.post('/save-note-index',      r_routes.saveNoteIndex);
app.post('/save-filters',         r_routes.saveFilters);
app.post('/fetch-filters',        r_routes.fetchFilters);


// ------------------------------------------------
// initialize note cache
// ------------------------------------------------
if (r_cfg.verifyPaths()) r_cache.init();


//r_http.createServer(app).listen(app.get('port'), 'localhost', function() {
r_http.createServer(app).listen(app.get('port'), function() {
  console.log('\n  allog server ready:  ' + 'http://127.0.0.1:' + app.get('port'));
  console.log('\n=========================================================================\n');
});

// ----------------------------------------------------------------------------
// Public
// ----------------------------------------------------------------------------

