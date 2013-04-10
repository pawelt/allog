;(function() {

  var dtReNoteName = /(\d\d).(\d\d).(\d\d).(\d\d).(\d\d).(\d\d)/;
  var dtReTimeZone = /\+(\d\d\d\d)/;
  var dtReIsoSepReplace = /\-|\:/g;
  var dtZERO = '2000-01-01 00:00:00Z';

  // TODO: Ditch timezoneless date handling...

  var DateUtil = {};

  /**
   * Creates a Date object from the Zero date: 2000-01-01 00:00:00
   *
   * @returns {Date}
   */
  DateUtil.getDateZero = function() {
    return new Date(dtZERO);
  };

  /**
   * Converts a Date object to normalized datetime string: 13-03-23 @ 00:46:57
   *
   * @param {Date} date
   * @returns {String} normalized datetime string
   */
  DateUtil.toNormalizedDT = function(date) {
    return date.toISOString().substring(2, 19).replace('T', ' @ ');
  };

  /**
   * Converts a Date object to note name format: 13.01.01-14.23.36
   *
   * @param {Date} date
   * @returns {String} normalized datetime string
   */
  DateUtil.toNoteName = function(date) {
    return date.toISOString().substring(2, 19).replace(dtReIsoSepReplace, '.').replace('T', '-');
  };

  /**
   * Creates a Date object from note name: 13.01.01-14.23.36-xyz
   *
   * @param {String} noteName
   * @returns {Date}
   */
  DateUtil.fromNoteName = function(noteName) {
    if (noteName.length < 17)
      return new Date(dtZERO);

    var dp = noteName.match(dtReNoteName);
    if (!dp || dp.length < 7)
      return new Date(dtZERO);

    var date = '20' + dp[1] + '-' + dp[2] + '-' + dp[3];
    date += ' ';
    date += dp[4] + ':' + dp[5] + ':' + dp[6];
    date += 'Z';

    var d = new Date(date);
    return d + '' === 'Invalid Date' ? new Date(dtZERO) : d;
  };


  /**
   * Resets timezone from the date
   *
   * @param {Date|String} date or string containing date as returned by Date.toLocaleString()
   * @returns {Date}
   */
  DateUtil.zeroTimezone = function(date) {
    try {
      var d = new Date((date + '').replace(dtReTimeZone, '+0000'));
      return d + '' === 'Invalid Date' ? new Date(dtZERO) : d;
    } catch (e) {
      return new Date(dtZERO);
    }
  };


  /**
   * Converts normalized date string to a Date object.
   *
   * @param {String} date a date in normalized format, like 13-03-23 @ 00:46:57
   * @returns {Date}
   */
  DateUtil.fromNormalizedString = function(date) {
    try {
      var d = new Date('20' + date.replace(' @', '') + 'Z');
      return d + '' === 'Invalid Date' ? new Date(dtZERO) : d;
    } catch (e) {
      return new Date(dtZERO);
    }
  };


  /**
   * Check if given date is the special ZERO date: 2000-01-01 00:00:00Z
   *
   * @param {Date}
   * @returns {bool}
   */
  DateUtil.isZero = function(date) {
    return new Date(dtZERO).getTime() === date.getTime();
  };


  // browser/nodejs export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DateUtil;
  } else if (typeof window !== 'undefined') {
    window.DateUtil = DateUtil;
  }
})();

