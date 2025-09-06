/**
 * MCP-Safe Logger
 * Logs to stderr to avoid breaking the MCP protocol on stdout
 */

class MCPSafeLogger {
  constructor(enabled = true) {
    this.enabled = enabled && process.env.DEVASSIST_DEBUG === 'true';
  }

  log(...args) {
    if (this.enabled) {
      process.stderr.write('[DevAssist] ' + args.join(' ') + '\n');
    }
  }

  error(...args) {
    process.stderr.write('[DevAssist ERROR] ' + args.join(' ') + '\n');
  }

  debug(...args) {
    if (this.enabled) {
      process.stderr.write('[DevAssist DEBUG] ' + args.join(' ') + '\n');
    }
  }
}

module.exports = new MCPSafeLogger();
