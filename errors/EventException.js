import Exception from "./Exception.js";
export default class EventException extends Exception {
    constructor(message, options = {}) {
        super(message, {
            code: options.code || 'ERR_EVENT',
            severity: options.severity || 'error',
            context: options.context || {}
        });
    }
}