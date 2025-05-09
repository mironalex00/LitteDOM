import Exception from "./Exception.js";
export default class EffectException extends Exception {
    constructor(message, options = {}) {
        super(message, {
            code: options.code || 'ERR_EFFECT',
            severity: options.severity || 'error',
            context: options.context || {}
        });
    }
}