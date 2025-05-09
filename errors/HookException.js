import Exception from "./Exception.js";
export default class HookException extends Exception {
    constructor(message, options = {}) {
        super(message, {
            code: options.code || 'ERR_HOOK',
            severity: options.severity || 'error',
            context: options.context || {}
        });
    }
}