// Global crypto.randomUUID polyfill - must run before React loads
(function() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return;
  if (typeof crypto === 'undefined') {
    // Node.js environment
    try {
      var nodeCrypto = require('crypto');
      crypto = { randomUUID: function() { return nodeCrypto.randomUUID(); } };
      return;
    } catch (e) {}
  } else if (typeof crypto === 'object' && !crypto.randomUUID) {
    crypto.randomUUID = function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };
  }
})();
