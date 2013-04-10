//
// WARNING !!!
//    Do NOT modify this file manually.
//    To customize settings, use ../user-config.js file.
//


// ----------------------------------------------------------------------------
// Exports
// ----------------------------------------------------------------------------

var mainConfig = module.exports = {};

// ----------------------------------------------------------------------------
// Imports
// ----------------------------------------------------------------------------

var r_path =  require('path');
var r_fs =    require('fs');
var r_pkg =   require('../package.json');

// ----------------------------------------------------------------------------
// Private
// ----------------------------------------------------------------------------

var notes_root = process.env.ALLOG_PATH.replace(/"/g, '');

// ----------------------------------------------------------------------------
// Public
// ----------------------------------------------------------------------------

mainConfig.app = {
  name:             r_pkg.name,
  version:          r_pkg.version,
  port:             process.env.ALLOG_PORT,
  ajaxTimeout:      1000,
  autosave:         500
};

mainConfig.names = {
  defaultBox:       'default',
  anyBox:           'any'
};

mainConfig.web = {
  views:            r_path.join(__dirname, 'views'),
  statics:          r_path.join(__dirname, 'public')
};

mainConfig.specials = [ 'boxes', 'templates', 'trash' ];

mainConfig.paths = {
  root:             r_path.join(notes_root),
  boxes:            r_path.join(notes_root, 'boxes'),
  templates:        r_path.join(notes_root, 'templates'),
  trash:            r_path.join(notes_root, 'trash')
};

mainConfig.exec = {
  win32: function(cmd) {
    var parsedCmd = false;
    var launchers = mainConfig.exec.launchers;
    Object.keys(launchers).forEach(function(reText) {
      var re = new RegExp(reText);
      if (!parsedCmd && re.test(cmd)) {
        parsedCmd = launchers[reText].replace('%1', cmd);
      }
    });
    parsedCmd = parsedCmd || 'start file:///' + encodeURIComponent(cmd).replace('%3A', ':');
    return parsedCmd;
  },
  darwin: function(cmd) {
    var parsedCmd = false;
    parsedCmd = 'open "' + cmd + '"';
    return parsedCmd;
  },
  linux: function(cmd) {
    var parsedCmd = false;
    parsedCmd = 'xdg-open "' + cmd + '"';
    return parsedCmd;
  },
  prepare: function(cmd) {
    var pl = this[process.platform];
    if (!pl) {
      console.log('ERROR: Launcher for "%s" platform not defined. See app/config.js for more details', process.platform);
      return cmd;
    }
    return pl(cmd);
  },
  launchers: {
  }
};

mainConfig.verifyPaths = function () {
  for (var name in mainConfig.paths) {
    try {
      var path = mainConfig.paths[name];
      var stat = r_fs.statSync(path);
      if (!stat.isDirectory()) throw new Error(path + ' is not a directory');
    } catch (e) {
      console.error('Critical error: invalid path "%s": %s', name, e);
      return false;
    }
  }
  return true;
};

mainConfig.merge = function (dst, src) {
  for (var p in src) {
    try {
      dst[p] = src[p].constructor === Object
          ? mainConfig.merge(dst[p], src[p])
          : dst[p] = src[p];
    } catch (e) {
      dst[p] = src[p];
    }
  }
  return dst;
};


try { mainConfig.merge(mainConfig, require('../user-config')); } catch (e) {}


