import Exception from "./Exception.js";
export default class ComponentException extends Exception {
    constructor(message, options = {}) {
        super(message, {
            code: options.code || 'ERR_COMPONENT',
            severity: options.severity || 'error',
            context: options.context || {}
        });
    }
}