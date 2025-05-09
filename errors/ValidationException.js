import Exception from "./Exception.js";
export default class ValidationException extends Exception {
    constructor(message, options = {}) {
        super(message, {
            code: options.code || 'ERR_VALIDATION',
            severity: options.severity || 'warning',
            context: options.context || {}
        });
    }
}