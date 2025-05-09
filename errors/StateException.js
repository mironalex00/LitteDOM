import Exception from "../lib/extensions/Exception.js";
export default class StateException extends Exception {
    constructor(message, options = {}) {
        super(message, {
            code: options.code || 'ERR_STATE',
            severity: options.severity || 'error',
            context: options.context || {}
        });
    }
}