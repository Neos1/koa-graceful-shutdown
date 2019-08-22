/**
 * Gracefully shutdown the application when requested, rejecting any requests that come through.
 *
 * Based entirely from express-graceful-shutdown:
 * @link https://npm.im/express-graceful-shutdown
 * @param {net.Server|https.Server} server
 * @param {Object} opts
 * @param {Logger} opts.logger
 * @param {Number} opts.forceTimeout
 * @param {String} opts.responseBody Response body during shutdown
 * @param {String} opts.responseType Response type during shutdown
 * @param {String} opts.signals Space delimited process kill signals
 * @param {Function} opts.beforeShutdown Function which accepts shutdown callback
 */
module.exports = function createShutdownMiddleware(server, opts = {}) {
  const logger = opts.logger || console; // Defaults to console
  const forceTimeout = opts.forceTimeout || (30 * 1000); // Defaults to 30s
  const responseBody = opts.responseBody || 'Server is in the process of restarting';
  const responseType = opts.responseType || 'text/plain; charset=utf-8';
  const signals = opts.signals || 'SIGTERM';

  let shuttingDown = false;

  function gracefulExit(signal) {
    if (shuttingDown) {
      // We already know we're shutting down, don't continue this function
      return;
    } else {
      shuttingDown = true;
    }

    // Don't bother with graceful shutdown in development
    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
      return process.exit(0);
    }

    logger.warn(`Received kill signal (${signal}), shutting down...`);

    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, forceTimeout);

    server.close(() => {
      logger.info('Closed out remaining connections');
      if (typeof opts.beforeShutdown === 'function') {
        opts.beforeShutdown(() => process.exit(0));
      } else {
        process.exit(0);
      }
    });
  }

  signals.split(' ').forEach(signal => {
    if (signal && signal !== '') {
      process.on(signal, () => {
        gracefulExit(signal);
      });
    }
  });

  return function shutdownMiddleware(ctx, next) {
    if (shuttingDown) {
      ctx.status = 503;
      ctx.set('Connection', 'close');
      ctx.type = responseType;
      ctx.body = responseBody;
    } else {
      return next();
    }
  };
};
