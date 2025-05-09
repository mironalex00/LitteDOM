import Exception from "../errors/Exception.js";
/**
 * Global error system for application-wide error handling
 */
export default class ErrorSystem {
    constructor() {
        this._errorHandlers = [];
        this._initialized = false;
    }
    initialize() {
        if (this._initialized) return;
        if (typeof window !== 'undefined') {
            window.addEventListener('error', (event) => {
                const error = new Exception(event.message, {
                    severity: 'critical',
                    context: {
                        filename: event.filename,
                        lineno: event.lineno,
                        colno: event.colno
                    }
                });
                this.handleError(error);
                // Don't prevent default to allow browser error handling: event.preventDefault();
            });
            // Handle unhandled promise rejections
            window.addEventListener('unhandledrejection', (event) => {
                let message = 'Unhandled Promise rejection';
                if (event.reason instanceof Error) message = event.reason.message;
                else if (typeof event.reason === 'string') message = event.reason;
                const error = new Exception(message, {
                    code: 'ERR_UNHANDLED_REJECTION',
                    severity: 'critical',
                    context: { reason: event.reason }
                });
                this.handleError(error);
            });
        }

        this._initialized = true;
    }
    registerErrorHandler(handler) {
        if (typeof handler === 'function' && !this._errorHandlers.includes(handler))
            this._errorHandlers.push(handler);
        return this;
    }
    removeErrorHandler(handler) {
        const index = this._errorHandlers.indexOf(handler);
        if (index !== -1)
            this._errorHandlers.splice(index, 1);
        return this;
    }
    handleError(error, containerId = null) {
        if (!(error instanceof Exception)) {
            error = new Exception(error.message, {
                context: { originalError: error.toString() }
            });
        }
        console.error(error.toString(), error.toObject());
        this._errorHandlers.forEach(handler => {
            try {
                handler(error);
            } catch (handlerError) {
                console.error('Error in error handler:', handlerError);
            }
        });
        if (containerId && typeof document !== 'undefined') {
            const container = typeof containerId === 'string'
                ? (document.getElementById(containerId) || document.body)
                : containerId;
            if (container) container.innerHTML = error.toHTML();
        }
        return error;
    }
    showGlobalError(error) {
        if (typeof document === 'undefined') return;
        let container = document.getElementById('littedom-error-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'littedom-error-container';
            container.style.position = 'fixed';
            container.style.bottom = '20px';
            container.style.right = '20px';
            container.style.zIndex = '9999';
            container.style.maxWidth = '500px';
            container.style.maxHeight = '80%';
            container.style.overflow = 'auto';
            document.body.appendChild(container);
        }
        const errorElement = document.createElement('div');
        errorElement.innerHTML = error.toHTML();
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '5px';
        closeButton.style.right = '5px';
        closeButton.style.background = 'none';
        closeButton.style.border = 'none';
        closeButton.style.fontSize = '20px';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = () => errorElement.remove();
        errorElement.style.position = 'relative';
        errorElement.appendChild(closeButton);
        container.appendChild(errorElement);
        if (error.severity !== 'critical') {
            setTimeout(() => {
                errorElement?.remove();
            }, 10000);
        }
    }
}