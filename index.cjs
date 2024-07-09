if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/jinge.prod.js');
} else {
  module.exports = require('./dist/jinge.dev.js');
}
