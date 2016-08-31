// Log to sumo logic directly

function safeToString(obj) {
  try {
    return JSON.stringify(obj);
  } catch (err) {
    try {
      return JSON.stringify(String(obj));
    } catch (err) {
      return JSON.stringify('error serializing log line');
    }
  }
}

module.exports = function SumoLogger(collectorCode, opts) {
  var me = this;

  opts = opts || {};
  var endpoint = opts.endpoint || "https://collectors.au.sumologic.com/receiver/v1/http/";
  var request = opts.request || require('request');
  var collectorEndpoint = endpoint + collectorCode;
  var syncInterval = opts.syncInterval || 1000;

  // Cache of entries we are yet to sync
  var unsynced = [];

  function append(logData) {
    unsynced.push(safeToString(logData));
  }

  me.log = function(logData) { append(logData); };

  var numBeingSent = 0;
  var maxLines = 100;

  // explicit decision to *not* use debounce/throttle so the syncing code is
  // explicit, and it's possible for a human to prove it's correctness
  var syncer = setInterval(function() {
    // Only one active sync at any given interval
    if (numBeingSent > 0) {
      return;
    }

    // Short-circuit if there is nothing to send
    if (unsynced.length == 0) {
      return;
    }

    var logLines = unsynced.slice(0, maxLines);
    var body = logLines.join('\n')
    numBeingSent = logLines.length;

    // Sync logs to sumo-logic, and clear all synced data. On failure we'll retry the sync
    request({
      method: 'POST',
      url: collectorEndpoint,
      body: body,
    }, function(error, response) {
      var failed = !!error ||
        response.status < 200 ||
        response.status >= 400;

      if (!failed) {
        unsynced.splice(0, numBeingSent);
      }

      numBeingSent = 0;
    })
  }, syncInterval);
}
