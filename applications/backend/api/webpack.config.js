const path = require('path');

module.exports = (options) => ({
  ...options,
  output: {
    ...options.output,
    path: path.join(__dirname, 'dist'),
    filename: options.output.filename.replace(/^api\//, ''),
    library: { type: 'commonjs2' },
  },
});
