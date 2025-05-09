import Exception from "./Exception.js";
export default class DOMException extends Exception {
    constructor(message, options = {}) {
        super(message, {
            code: options.code || 'ERR_DOM',
            severity: options.severity || 'error',
            context: options.context || {}
        });
    }
}