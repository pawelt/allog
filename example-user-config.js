
var userConfig = module.exports = {};

userConfig.exec = {
  launchers: {
    /*
     * If you had env variable EDITOR defined, you could use it to have
     * all index.txt files open in your favorite editor, instead of system's
     * default editor for .txt files.
     */

    //'index\\.txt$': '%EDITOR% "%1"'
    '\\.js$': '%EDITOR% "%1"'
  }
};


userConfig.names = {
    defaultBox: 'quick notes',
    anyBox:     'All boxes'
};
