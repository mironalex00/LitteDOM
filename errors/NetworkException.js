import Exception from "../lib/extensions/Exception.js";
export default class NetworkException extends Exception {
    constructor(message, options = {}) {
        super(message, {
            code: options.code || 'ERR_NETWORK',
            severity: options.severity || 'error',
            context: options.context || {}
        });
    }
}