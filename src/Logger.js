module.exports = class Logger {
    constructor({ config } = {}) {
        config = config || { log: true };
        this.config = config;
    }

    log(...args) {
        if (this.config.log) {
            console.log(...args);
        }
    }

    error(...args) {
        if (this.config.log) {
            console.error(...args);
        }
    }
};