var m_ajax = (function() {
  'use strict';

  var exports = {};

  exports.ERROR = {
    APP:      'AJAX_ERROR_APPLICATION',     // application logic (returned with 200)
    SERVER:   'AJAX_ERROR_SERVER',          // 500, server-side exceptions etc.
    CLIENT:   'AJAX_ERROR_CLIENT',          // 401, 404 etc.
    TYPE:     'AJAX_ERROR_RESPONSE_TYPE',   // status, message or data missing
    FORMAT:   'AJAX_ERROR_RESPONSE_FORMAT', // malformed JSON
    TIMEOUT:  'AJAX_ERROR_TIMEOUT',         // timeout
    dummy: 0
  };

  /**
   * Parameter jq_ajax_results is an array filled with jqXHR.always() arguments:
   *        data|jqXHR, textStatus, jqXHR|errorThrown
   *
   *    JsonRes = {
   *      status:     false,
   *      message:    false,
   *      data:       false,
   *      error:      false
   *    };
   *
   * @param {Array} jqXHRAlwaysArgs
   * @returns {JsonRes}
   */
  exports.parseResponse = function(jqXHRAlwaysArgs) {

    var textStatus = jqXHRAlwaysArgs[1],
        rawData = false,
        jqXHR = false,
        jqErrorType = false,
        res = {
          status: false,
          message: false,
          data: false,
          error: false
        };

    if (textStatus === "success" || textStatus === "notmodified") {
      jqXHR = jqXHRAlwaysArgs[2];
      rawData = jqXHRAlwaysArgs[0];

      // Even if the request succeeded, we may still want to fail it,
      // due to wrong json format or some app logic error.
      if (!rawData || rawData.status === undefined || rawData.message === undefined || rawData.data === undefined) {
        return $.Deferred().reject($.extend(res, {status: jqXHR.status, error: this.ERROR.TYPE}));
      }
      if (rawData.status !== 0) {
        return $.Deferred().reject($.extend(res, {data: rawData.data, status: rawData.status, message: rawData.message, error: this.ERROR.APP}));
      }

      return $.extend(res, {data: rawData.data, status: rawData.status, message: rawData.message});
    } else {
      jqXHR = jqXHRAlwaysArgs[0];
      jqErrorType = jqXHRAlwaysArgs[2];

      var error_type =
          jqErrorType === 'parsererror' ? this.ERROR.FORMAT
          : jqErrorType === 'timeout' ? this.ERROR.TIMEOUT
          : jqXHR.status >= 400 && jqXHR.status <= 499 ? this.ERROR.CLIENT
          : this.ERROR.SERVER;

      return $.extend(res, {status: jqXHR.status, error: error_type});
    }
  };

  exports.ajaxBackboneProxy = function(options) {
    var responseParser = $.proxy(function() { return this.parseResponse(arguments); }, this);

    // grab backbone response handlers to call them after the response was parsed
    var succ =  options.success;
    var error = options.error;

    delete options.success;
    delete options.error;

    return $.ajax(options)
        .then(responseParser, responseParser) // make sure we always get a response in the standard format
        .done(succ)                             // restore original backbone response handlers
        .fail(error);
  };

  exports.ajax = function(url, params, options) {
    var responseParser = $.proxy(function() { return this.parseResponse(arguments); }, this);
    var opts = $.extend({}, options);
    opts.method = opts.method || 'GET';
    opts.dataType = opts.dataType || 'json';
    opts.data = params;

    // make sure we always get a response in the standard format
    return $.ajax(url, opts).then(responseParser, responseParser);
  };

  exports.getJSON = function(url, params) {
    return this.ajax(url, params, {});
  };

  exports.postJSON = function(url, params) {
    return this.ajax(url, params, {method: 'POST'});
  };

  return exports;

})();
