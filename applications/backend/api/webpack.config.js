const path = require('path');

module.exports = (options) => ({
  ...options,
  output: {
    ...options.output,
    path: path.join(__dirname, 'dist'),
  },
});
