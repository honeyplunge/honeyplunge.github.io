// Logger utility for WebAudio Sync
export class Logger {
    constructor(config = {}, prefix = 'WebAudioSync') {
        this.config = config;
        this.prefix = prefix;
    }
    shouldLog(level) {
        const logLevel = this.config.logLevel ?? 'info';
        const levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
            none: 4,
        };
        return levels[level] >= levels[logLevel];
    }
    formatMessage(level, message, data) {
        const timestamp = new Date().toISOString();
        let formatted = `[${timestamp}] [${this.prefix}] [${level.toUpperCase()}] ${message}`;
        if (data !== undefined) {
            formatted += ` ${JSON.stringify(data)}`;
        }
        return formatted;
    }
    debug(message, data) {
        if (this.shouldLog('debug')) {
            console.debug(this.formatMessage('debug', message, data));
        }
    }
    info(message, data) {
        if (this.shouldLog('info')) {
            console.info(this.formatMessage('info', message, data));
        }
    }
    warn(message, data) {
        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage('warn', message, data));
        }
    }
    error(message, data) {
        if (this.shouldLog('error')) {
            console.error(this.formatMessage('error', message, data));
        }
    }
    static getInstance(config = {}, prefix = 'WebAudioSync') {
        if (Logger.instance?.config !== config) {
            Logger.instance = new Logger(config, prefix);
        }
        return Logger.instance;
    }
    static debug(message, data) {
        Logger.getInstance().debug(message, data);
    }
    static info(message, data) {
        Logger.getInstance().info(message, data);
    }
    static warn(message, data) {
        Logger.getInstance().warn(message, data);
    }
    static error(message, data) {
        Logger.getInstance().error(message, data);
    }
    static configure(config) {
        Logger.instance = new Logger(config, 'WebAudioSync');
    }
}
// Static instance for convenience
Logger.instance = null;
export default Logger;
