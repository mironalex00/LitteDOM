import Exception from "./Exception.js";
export default class RenderException extends Exception {
    constructor(message, options = {}) {
        super(message, {
            code: options.code || 'ERR_RENDER',
            severity: options.severity || 'error',
            context: options.context || {}
        });
    }
}