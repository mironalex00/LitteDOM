'use strict';
/**
 * Base Exception class with enhanced error reporting
 * Improvements:
 * - Better stack trace parsing with more reliable method detection
 * - Optimized parsing with caching and early-exits
 * - Added severity levels for better error categorization
 * - Added error codes for systematic error handling
 */
export default class Exception extends Error {
    /**
     * @param {string} message - Error message
     * @param {Object} options - Additional error options
     * @param {string} options.code - Error code for systematic error handling
     * @param {string} options.severity - Error severity (info, warning, error, critical)
     * @param {Object} options.context - Additional context information
     */
    constructor(message, options = {}) {
        super(message);
        this.name = this.constructor.name;
        this.timestamp = new Date();
        this.code = options.code || 'ERR_UNKNOWN';
        this.severity = options.severity || 'error';
        this.context = options.context || {};
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
        const stackInfo = this.parseStack();
        this.method = stackInfo.method;
        this.class = stackInfo.class;
        this.location = stackInfo.location;
    }
    /**
     * Parse stack trace to extract useful debugging information
     * Optimized with early returns and regex caching
     * @returns {Object} Parsed stack information
     */
    parseStack() {
        const DEFAULT_INFO = {
            method: "unknown",
            class: "unknown",
            location: "unknown:0:0"
        };
        if (!this.stack) return DEFAULT_INFO;
        try {
            const stackLines = this.stack.split('\n');
            const relevantLine = stackLines.find(line => {
                return line.includes(' at ') &&
                    !line.includes(this.name) &&
                    !line.includes('new ' + this.name) &&
                    !line.includes('parseStack') &&
                    !line.includes('Exception');
            });
            if (!relevantLine) return DEFAULT_INFO;
            const stackRegex = /at (?:(?:async )?(?:new )?([\w.]+))? ?\(?([^:]+):(\d+):(\d+)\)?/;
            const match = relevantLine.match(stackRegex);
            if (!match) return DEFAULT_INFO;
            const [, context, file, line, column] = match;
            let className = null;
            let methodName = 'anonymous';
            if (context) {
                const parts = context.split('.');
                if (parts.length > 1) {
                    className = parts.slice(0, -1).join('.');
                    methodName = parts[parts.length - 1];
                } else {
                    methodName = context;
                }
            }
            return {
                method: methodName,
                class: className || 'global',
                location: `${file}:${line}:${column}`
            };
        } catch (err) {
            return DEFAULT_INFO;
        }
    }
    /**
     * Convert exception to string representation
     */
    toString() {
        return `${this.name} [${this.code}] (${this.severity}): ${this.message} 
        at ${this.class}::${this.method} (${this.location})
        timestamp: ${this.timestamp.toISOString()}`;
    }
    /**
     * Convert exception to object for logging or serialization
     */
    toObject() {
        return {
            name: this.name,
            code: this.code,
            severity: this.severity,
            message: this.message,
            class: this.class,
            method: this.method,
            location: this.location,
            timestamp: this.timestamp,
            context: this.context
        };
    }
    /**
     * Create a formatted HTML representation for browser display
     */
    toHTML() {
        const severityColors = {
            info: '#4A90E2',
            warning: '#F5A623',
            error: '#D0021B',
            critical: '#8B0000'
        };
        const color = severityColors[this.severity] || severityColors.error;
        return `
        <div style="font-family: monospace; border-left: 4px solid ${color}; padding: 10px; margin: 10px 0; background-color: #f8f8f8;">
            <h3 style="color: ${color}; margin-top: 0;">${this.name}: ${this.message}</h3>
            <p><strong>Code:</strong> ${this.code}</p>
            <p><strong>Severity:</strong> ${this.severity}</p>
            <p><strong>Location:</strong> ${this.class}::${this.method} in ${this.location}</p>
            <p><strong>Time:</strong> ${this.timestamp.toLocaleString()}</p>
            ${this.context && Object.keys(this.context).length
                ? `<details>
                    <summary>Additional Context</summary>
                    <pre>${JSON.stringify(this.context, null, 2)}</pre>
                   </details>`
                : ''}
        </div>
        `;
    }
}