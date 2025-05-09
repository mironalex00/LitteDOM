/**
 * @fileoverview LitteDOM - A lightweight, optimized object-oriented implementation of a virtual DOM
 * for building user interfaces with a React-like API.
 * 
 * @author Alejandro Miron
 * @version 1.0.0
 * @license Proprietary - All rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * This source code is proprietary and confidential.
 * 
 * Copyright (C) 2025 Alejandro Miron. All rights reserved.
 */
'use strict';

// ==================== IMPORTACIONES ====================
import ErrorSystemManager from './handlers/ErrorSystem.js';
// ==================== EXCEPCIONES ====================
/** @type {ComponentException, DOMException, EventException, NetworkException, RenderException, StateException, ValidationException} */
import Exception from './errors/Exception.js';
import ComponentException from './errors/ComponentException.js';
import DOMException from './errors/DOMException.js';
import EventException from './errors/EventException.js';
import EffectException from './errors/EffectException.js';
import HookException from './errors/HookException.js';
import RenderException from './errors/RenderException.js';
import ValidationException from './errors/ValidationException.js';

/**
 * Base Component class for creating class components.
 * Similar to React.Component, provides state management, lifecycle methods, and rendering.
 * 
 * @class
 */
export class Component {
    /**
     * Creates a new Component instance.
     * 
     * @param {Object} props - Properties passed to the component
     */
    constructor(props) {
        this.props = props || {};
        this.state = {};
        this._pendingState = null;
        this._isMounted = false;
        this._currentDOMNode = null;
        this._renderInProgress = false;
        this._pendingCallbacks = [];
        this.isComponent = {};
        this._hasError = false;
        this._errorInfo = null;
    }
    /**
     * Updates the component's state. Triggers a re-render unless shouldComponentUpdate returns false.
     * 
     * @param {Object|Function} partialState - Object to merge with current state or function that returns an object
     * @param {Function} [callback] - Function to call after state is updated and component is re-rendered
     */
    setState(partialState, callback) {
        if (typeof callback === 'function') this._pendingCallbacks.push(callback);
        this._pendingState = {
            ...this._pendingState,
            ...(typeof partialState === 'function' ? partialState(this.state, this.props) : partialState)
        };
        if (this._isMounted && !this._renderInProgress) ReconciliationManager.scheduleUpdate(this);
    }
    /**
     * Determines if the component should update when receiving new props or state.
     * Override this method to optimize re-rendering.
     * 
     * @param {Object} nextProps - The next props that the component will receive
     * @param {Object} nextState - The next state that the component will have
     * @returns {boolean} True if the component should update (default)
     */
    shouldComponentUpdate(nextProps, nextState) {
        return true;
    }
    /**
     * Lifecycle method that is called after the component updates.
     * Not called for the initial render.
     * 
     * @param {Object} prevProps - The previous props
     * @param {Object} prevState - The previous state
     */
    componentDidUpdate(prevProps, prevState) { }
    /**
     * Lifecycle method that is called after a component is mounted to the DOM.
     * Good place to initialize third-party libraries or request data.
     */
    componentDidMount() { }
    /**
     * Lifecycle method that is called immediately before a component is unmounted and destroyed.
     * Good place to clean up resources, event handlers, timers, etc.
     */
    componentWillUnmount() { }
    /**
     * Internal method to apply pending state changes and trigger lifecycle methods.
     * 
     * @returns {boolean} True if the state was updated and component should re-render
     * @private
     */
    _commitState() {
        if (this._pendingState) {
            const prevState = { ...this.state };
            const nextState = { ...this.state, ...this._pendingState };
            if (this._isMounted &&
                typeof this.shouldComponentUpdate === 'function' &&
                this.shouldComponentUpdate !== Component.prototype.shouldComponentUpdate) {
                if (!this.shouldComponentUpdate(this.props, nextState)) {
                    this._pendingState = null;
                    while (this._pendingCallbacks.length > 0) this._pendingCallbacks.shift()();
                    return false;
                }
            }
            this.state = nextState;
            this._pendingState = null;
            if (this._isMounted && typeof this.componentDidUpdate === 'function')
                this.componentDidUpdate(this.props, prevState);
            while (this._pendingCallbacks.length > 0) this._pendingCallbacks.shift()();
            return true;
        }
        return false;
    }
    /**
     * The render method that each component must implement.
     * Should return a VirtualElement representing the component's UI.
     * 
     * @returns {VirtualElement} The virtual DOM representation of the component
     * @throws {ComponentException} If not implemented by subclass
     */
    render() { throw new ComponentException('El método render() no está implementado'); }
    /**
     * Forces a component to re-render even if state or props haven't changed.
     * 
     * @param {Function} [callback] - Function to call after component is re-rendered
     */
    forceUpdate(callback) {
        if (typeof callback === 'function') this._pendingCallbacks.push(callback);
        if (this._isMounted && !this._renderInProgress) ReconciliationManager.scheduleUpdate(this);
    }
    /**
     * Error boundary lifecycle method - called when a child component throws.
     * Override this method to create error boundaries.
     * 
     * @param {Error} error - The error that was thrown
     * @param {Object} errorInfo - Information about the error
     * @returns {boolean} True if the error was handled, false otherwise
     */
    componentDidCatch(error, errorInfo) { return false; }
    /**
     * Renders fallback UI when an error has been caught by an error boundary.
     * Override this to customize error UI.
     * 
     * @returns {VirtualElement} The fallback UI
     */
    renderError() {
        const errorInfo = this._errorInfo || {};
        return new VirtualElement('div', {
            style: { color: 'red', padding: '10px', margin: '10px 0', border: '1px solid red' }
        }, [
            new VirtualElement('h3', {}, ["Error in component: " + (errorInfo.componentName || 'Unknown')]),
            new VirtualElement('p', {}, [this._hasError ? this._hasError.message : 'Unknown error']),
            new VirtualElement('button', { onClick: () => this.setState({ _reset: true }) }, ["Try again"])
        ]);
    }
    /**
     * Checks if this component is an error boundary.
     * 
     * @returns {boolean} True if this component can catch errors
     */
    isErrorBoundary() {
        return typeof this.componentDidCatch === 'function' &&
            this.componentDidCatch !== Component.prototype.componentDidCatch;
    }
}
/**
 * ErrorBoundary component for catching and handling errors in child components.
 * Used to prevent entire app from crashing when errors occur.
 * 
 * @class
 * @extends Component
 */
export class ErrorBoundary extends Component {
    /**
     * Creates a new ErrorBoundary component.
     * 
     * @param {Object} props - Component props including fallback UI and error handlers
     */
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    /**
     * Catches errors in children and updates state to trigger rendering of fallback UI.
     * 
     * @param {Error} error - The error that was thrown
     * @param {Object} errorInfo - Information about the error
     * @returns {boolean} Always returns true as error is handled
     */
    componentDidCatch(error, errorInfo) {
        this.setState({ hasError: true, error: error });
        ErrorSystem.handleError(
            new ComponentException(error.message, {
                context: {
                    componentStack: errorInfo.componentStack,
                    componentName: errorInfo.componentName
                }
            })
        );
        if (typeof this.props.onError === 'function') {
            this.props.onError(error, errorInfo);
        }
        return true;
    }
    /**
     * Renders either the fallback UI when an error occurs or the children if no error.
     * 
     * @returns {VirtualElement} The fallback UI or children
     */
    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return new VirtualElement('div', {
                style: {
                    color: 'red', padding: '15px', margin: '10px 0',
                    border: '1px solid red', borderRadius: '4px', backgroundColor: '#fff8f8'
                }
            }, [
                new VirtualElement('h3', { style: { margin: '0 0 10px 0' } }, ["Error in component"]),
                new VirtualElement('p', {}, [
                    this.state.error ? this.state.error.message : 'Unknown error occurred'
                ]),
                new VirtualElement('button', {
                    onClick: () => this.setState({ hasError: false, error: null }),
                    style: {
                        padding: '5px 10px', marginTop: '10px', backgroundColor: '#f44336',
                        color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
                    }
                }, ["Try again"])
            ]);
        }
        return this.props.children;
    }
}
/**
 * VirtualElement represents a node in the virtual DOM tree.
 * Can represent DOM elements, components, fragments, or portals.
 * 
 * @class
 * @private
 */
class VirtualElement {
    /**
     * Creates a new VirtualElement.
     * 
     * @param {string|Function|Symbol} type - Element type (tag name, component, or special symbol)
     * @param {Object} [props] - Element properties
     * @param {...*} children - Child elements
     */
    constructor(type, props = {}, ...children) {
        this.type = type;
        this.props = props || {};
        this.key = props?.key !== undefined ? props.key : null;
        this.children = (Array.isArray(children) ? children : [children])
            .flat().filter(child => child != null)
            .map(child => this.normalizeChild(child));
    }
    /**
     * Converts primitive child values to TextElements.
     * 
     * @param {*} child - The child to normalize
     * @returns {VirtualElement|TextElement} The normalized child
     * @private
     */
    normalizeChild(child) {
        return typeof child === 'object' ? child : new TextElement(String(child));
    }
    /**
     * Renders the virtual element to a real DOM node.
     * 
     * @param {Component} [parentComponent] - Parent component for context
     * @returns {Node} The rendered DOM node
     */
    render(parentComponent = null) {
        try {
            if (this.type === Symbol.for('littedom.fragment')) return this.renderFragment(parentComponent);
            else if (this.type === Symbol.for('littedom.portal')) return this.renderPortal(parentComponent);
            else if (typeof this.type === 'function') return this.renderComponent(parentComponent);
            else return this.renderDOMElement(parentComponent);
        } catch (error) {
            let boundary = parentComponent;
            let errorInfo = {
                componentName: this.type?.name || (typeof this.type === 'string' ? this.type : 'Unknown')
            };
            while (boundary) {
                if (boundary.isErrorBoundary && boundary.isErrorBoundary()) {
                    boundary._hasError = error;
                    boundary._errorInfo = errorInfo;
                    if (boundary.componentDidCatch(error, errorInfo))
                        return boundary.renderError().render(boundary);
                }
                boundary = boundary._parentComponent;
            }
            ErrorSystem.handleError(new RenderException(`Error rendering ${errorInfo.componentName}: ${error.message}`, {
                context: { component: errorInfo.componentName, error, props: this.props }
            }));
            const errorNode = document.createElement('div');
            errorNode.setAttribute('data-error', 'true');
            errorNode.style.color = 'red';
            errorNode.style.padding = '10px';
            errorNode.style.border = '1px solid red';
            errorNode.innerHTML = `<h4>Error rendering component</h4><p>${error.message}</p>`;
            return errorNode;
        }
    }
    /**
     * Renders a fragment (group of children without a container).
     * 
     * @param {Component} parentComponent - Parent component for context
     * @returns {DocumentFragment} The rendered document fragment
     * @private
     */
    renderFragment(parentComponent) {
        const fragment = document.createDocumentFragment();
        for (const child of this.children) {
            try {
                const renderedChild = child.render(parentComponent);
                if (renderedChild) fragment.appendChild(renderedChild);
            } catch (error) {
                ErrorSystem.handleError(new RenderException(`Error rendering fragment child: ${error.message}`, {
                    context: { child, error }
                }));
            }
        }
        return fragment;
    }
    /**
     * Renders a portal (children rendered to a different part of the DOM).
     * 
     * @param {Component} parentComponent - Parent component for context
     * @returns {Comment} A comment node placeholder
     * @private
     */
    renderPortal(parentComponent) {
        for (const child of this.children) {
            try {
                this.containerInfo.appendChild(child.render(parentComponent));
            } catch (error) {
                ErrorSystem.handleError(
                    new RenderException(`Error rendering portal child: ${error.message}`, { context: { child, error } })
                );
            }
        }
        return document.createComment('portal');
    }
    /**
     * Renders a component (class or functional).
     * 
     * @param {Component} parentComponent - Parent component for context
     * @returns {Node} The rendered DOM node
     * @private
     */
    renderComponent(parentComponent) {
        const ComponentClass = this.type;
        const isClassComponent = ComponentClass.prototype &&
            (ComponentClass.prototype.isComponent ||
                ComponentClass.prototype instanceof Component);
        if (isClassComponent) {
            try {
                const componentInstance = new ComponentClass(this.props);
                componentInstance.props = { ...this.props, children: this.children };
                componentInstance._parentComponent = parentComponent;
                if (typeof componentInstance.render !== 'function') {
                    throw new Error(`El componente ${ComponentClass.name || 'sin nombre'} no tiene un método render válido`);
                }
                let renderedVNode = null;
                try {
                    renderedVNode = componentInstance.render();
                } catch (renderError) {
                    throw new Error(`Error al ejecutar render() en ${ComponentClass.name || 'sin nombre'}: ${renderError.message}`);
                }
                if (!renderedVNode) {
                    const emptyNode = document.createComment('empty component');
                    componentInstance._currentDOMNode = emptyNode;
                    componentInstance._isMounted = true;
                    emptyNode._componentInstance = componentInstance;
                    return emptyNode;
                }
                if (typeof renderedVNode.render !== 'function') {
                    if (typeof renderedVNode === 'string' || typeof renderedVNode === 'number') {
                        renderedVNode = new TextElement(String(renderedVNode));
                    } else if (Array.isArray(renderedVNode)) {
                        renderedVNode = new VirtualElement(Symbol.for('littedom.fragment'), {}, ...renderedVNode);
                    } else if (renderedVNode && typeof renderedVNode === 'object') {
                        if (renderedVNode.nodeType) {
                            componentInstance._currentDOMNode = renderedVNode;
                            componentInstance._isMounted = true;
                            renderedVNode._componentInstance = componentInstance;
                            return renderedVNode;
                        } else {
                            throw new Error(`El componente ${ComponentClass.name || 'sin nombre'} devolvió un objeto que no es un VirtualElement válido`);
                        }
                    } else {
                        throw new Error(`El componente ${ComponentClass.name || 'sin nombre'} devolvió un valor que no puede ser renderizado: ${typeof renderedVNode}`);
                    }
                }
                const domNode = renderedVNode.render(componentInstance);
                componentInstance._currentDOMNode = domNode;
                componentInstance._isMounted = true;
                domNode._componentInstance = componentInstance;
                domNode._vnode = renderedVNode;
                domNode._ownerComponent = componentInstance;
                if (typeof componentInstance.componentDidMount === 'function') {
                    setTimeout(() => componentInstance.componentDidMount(), 0);
                }
                return domNode;
            } catch (error) {
                let boundary = parentComponent;
                let errorHandled = false;
                const errorInfo = {
                    componentName: ComponentClass.name || 'UnnamedComponent',
                    componentStack: error.stack
                };
                while (boundary && !errorHandled) {
                    if (boundary.isErrorBoundary && boundary.isErrorBoundary()) {
                        boundary._hasError = error;
                        boundary._errorInfo = errorInfo;
                        if (boundary.componentDidCatch(error, errorInfo)) {
                            errorHandled = true;
                            return boundary.renderError().render(boundary);
                        }
                    }
                    boundary = boundary._parentComponent;
                }
                ErrorSystem.handleError(
                    new ComponentException(
                        `Error in component ${ComponentClass.name || 'UnnamedComponent'}: ${error.message}`,
                        { context: { error, props: this.props } }
                    )
                );
                const errorNode = document.createElement('div');
                errorNode.setAttribute('data-error', 'true');
                errorNode.style.color = 'red';
                errorNode.style.padding = '10px';
                errorNode.style.border = '1px solid red';
                errorNode.innerHTML = `<h4>Error in component ${ComponentClass.name || 'UnnamedComponent'}</h4><p>${error.message}</p>`;
                return errorNode;
            }
        } else {
            try {
                const hooksComponent = {
                    _hooks: [],
                    _isMounted: false,
                    _currentVNode: this,
                    _renderInProgress: false,
                    _pendingEffects: [],
                    _parentComponent: parentComponent,
                    render: () => {
                        HooksContext.setCurrentComponent(hooksComponent);
                        return ComponentClass(hooksComponent.props || this.props);
                    },
                    props: this.props
                };
                HooksContext.setCurrentComponent(hooksComponent);
                const renderedElement = ComponentClass(this.props);
                HooksContext.setCurrentComponent(null);
                if (!renderedElement)
                    return document.createComment('empty functional component');
                if (typeof renderedElement !== 'object')
                    return new TextElement(String(renderedElement)).render(parentComponent);
                const domNode = renderedElement.render(hooksComponent);
                if (domNode) {
                    domNode._vnode = renderedElement;
                    domNode._ownerComponent = hooksComponent;
                    hooksComponent._currentDOMNode = domNode;
                    hooksComponent._isMounted = true;
                    if (hooksComponent._pendingEffects.length > 0) {
                        for (const effect of hooksComponent._pendingEffects) {
                            ReconciliationManager.scheduleEffect(effect);
                        }
                        hooksComponent._pendingEffects = [];
                    }
                }
                return domNode;
            } catch (error) {
                let boundary = parentComponent;
                let errorHandled = false;
                const errorInfo = {
                    componentName: ComponentClass.name || 'UnnamedFunctionalComponent',
                    componentStack: error.stack
                };
                while (boundary && !errorHandled) {
                    if (boundary.isErrorBoundary && boundary.isErrorBoundary()) {
                        boundary._hasError = error;
                        boundary._errorInfo = errorInfo;
                        if (boundary.componentDidCatch(error, errorInfo)) {
                            errorHandled = true;
                            return boundary.renderError().render(boundary);
                        }
                    }
                    boundary = boundary._parentComponent;
                }
                ErrorSystem.handleError(new ComponentException(
                    `Error in functional component ${ComponentClass.name || 'UnnamedFunctionalComponent'}: ${error.message}`,
                    { context: { error, props: this.props } }
                ));
                const errorNode = document.createElement('div');
                errorNode.setAttribute('data-error', 'true');
                errorNode.style.color = 'red';
                errorNode.style.padding = '10px';
                errorNode.style.border = '1px solid red';
                errorNode.innerHTML = `<h4>Error in functional component ${ComponentClass.name || 'UnnamedFunctionalComponent'}</h4><p>${error.message}</p>`;
                return errorNode;
            }
        }
    }
    /**
     * Renders a DOM element.
     * 
     * @param {Component} parentComponent - Parent component for context
     * @returns {Element} The rendered DOM element
     * @private
     */
    renderDOMElement(parentComponent) {
        try {
            const element = document.createElement(this.type);
            element._vnode = this;
            this.applyProps(element);
            for (const child of this.children) {
                if (child) {
                    try {
                        const renderedChild = child.render(parentComponent);
                        if (renderedChild) element.appendChild(renderedChild);
                    } catch (error) {
                        ErrorSystem.handleError(new RenderException(
                            `Error rendering child of ${this.type}: ${error.message}`,
                            { context: { element: this.type, child, error } }
                        ));
                        const errorNode = document.createElement('div');
                        errorNode.style.color = 'red';
                        errorNode.style.padding = '5px';
                        errorNode.style.margin = '5px';
                        errorNode.style.border = '1px dashed red';
                        errorNode.textContent = `Child render error: ${error.message}`;
                        element.appendChild(errorNode);
                    }
                }
            }
            if (this.props.ref) {
                if (typeof this.props.ref === 'function') this.props.ref(element);
                else if (this.props.ref && typeof this.props.ref === 'object') this.props.ref.current = element;
            }
            return element;
        } catch (error) {
            ErrorSystem.handleError(new RenderException(
                `Error creating DOM element ${this.type}: ${error.message}`,
                { context: { element: this.type, props: this.props, error } }
            ));
            const errorNode = document.createElement('div');
            errorNode.style.color = 'red';
            errorNode.style.padding = '5px';
            errorNode.style.border = '1px solid red';
            errorNode.textContent = `Error creating ${this.type}: ${error.message}`;
            return errorNode;
        }
    }
    /**
     * Applies props to a DOM element.
     * 
     * @param {Element} element - The DOM element to apply props to
     * @throws {RenderException} If there's an error applying props
     * @private
     */
    applyProps(element) {
        try {
            for (const [key, value] of Object.entries(this.props)) {
                if (key.startsWith('on') && typeof value === 'function') {
                    EventSystem.registerEvent(element, key.slice(2).toLowerCase(), key, value);
                    continue;
                }
                if (key === 'style' && typeof value === 'object') {
                    Object.assign(element.style, value);
                    continue;
                }
                if (key === 'className') {
                    element.setAttribute('class', value);
                    continue;
                }
                if (typeof value === 'boolean') {
                    if (value) element.setAttribute(key, '');
                    else element.removeAttribute(key);
                    continue;
                }
                if (key !== 'children' && key !== 'key' && key !== 'ref') {
                    const safeValue = typeof value === 'string'
                        ? value.replace(/[<>"&]/g, char => {
                            switch (char) {
                                case '<': return '&lt;';
                                case '>': return '&gt;';
                                case '"': return '&quot;';
                                case '&': return '&amp;';
                                default: return char;
                            }
                        })
                        : value;
                    element.setAttribute(key, safeValue);
                }
            }
        } catch (error) {
            throw new RenderException(`Error applying props: ${error.message}`, {
                context: { props: this.props, element, error }
            });
        }
    }
    /**
     * Checks if this element is the same type as another element.
     * 
     * @param {VirtualElement} otherVNode - The other element to compare with
     * @returns {boolean} True if elements are the same type and key
     */
    isSameType(otherVNode) {
        return otherVNode && this.type === otherVNode.type && this.key === otherVNode.key;
    }
}
/**
 * TextElement represents a text node in the virtual DOM.
 * 
 * @class
 * @extends VirtualElement
 * @private
 */
class TextElement extends VirtualElement {
    /**
     * Creates a new TextElement.
     * 
     * @param {string} value - The text content
     */
    constructor(value) {
        super("#text");
        this.value = value;
    }
    /**
     * Renders the text element to a DOM text node.
     * 
     * @returns {Text} The text node
     */
    render() {
        try {
            return document.createTextNode(this.value);
        } catch (error) {
            ErrorSystem.handleError(new RenderException(
                `Error creating text node: ${error.message}`,
                { context: { text: this.value, error } }
            ));
            return document.createTextNode('Error: Failed to render text');
        }
    }
}
/**
 * SyntheticEvent wraps native DOM events to provide a consistent interface.
 * Similar to React's SyntheticEvent.
 * 
 * @class
 * @private
 */
class SyntheticEvent {
    /**
     * Creates a new SyntheticEvent wrapping a native event.
     * 
     * @param {Event} nativeEvent - The native DOM event
     */
    constructor(nativeEvent) {
        this.nativeEvent = nativeEvent;
        this.target = nativeEvent.target;
        this.currentTarget = nativeEvent.currentTarget;
        this.type = nativeEvent.type;
        this.bubbles = nativeEvent.bubbles;
        this.cancelable = nativeEvent.cancelable;
        this.defaultPrevented = nativeEvent.defaultPrevented;
        this.timeStamp = nativeEvent.timeStamp;
        this.isTrusted = nativeEvent.isTrusted;
        this._isPropagationStopped = false;
        this._isDefaultPrevented = false;
    }
    /**
     * Prevents the default action of the event.
     */
    preventDefault() {
        this._isDefaultPrevented = true;
        if (this.nativeEvent.preventDefault) this.nativeEvent.preventDefault();
    }
    /**
     * Stops the propagation of the event.
     */
    stopPropagation() {
        this._isPropagationStopped = true;
        if (this.nativeEvent.stopPropagation) this.nativeEvent.stopPropagation();
    }
    /**
     * Checks if preventDefault() was called on this event.
     * 
     * @returns {boolean} True if preventDefault() was called
     */
    isDefaultPrevented() { return this._isDefaultPrevented; }
    /**
     * Checks if stopPropagation() was called on this event.
     * 
     * @returns {boolean} True if stopPropagation() was called
     */
    isPropagationStopped() { return this._isPropagationStopped; }
}
/**
 * Context provides a way to share values between components without passing props.
 * Similar to React.createContext().
 * 
 * @class
 * @private
 */
class Context {
    /**
     * Creates a new Context with the given default value.
     * 
     * @param {*} defaultValue - The default value for consumers when no provider is found
     */
    constructor(defaultValue) {
        this._defaultValue = defaultValue;
        this.Provider = function ContextProvider(props) {
            const contextValue = props.value !== undefined ? props.value : defaultValue;
            const currentComponent = HooksContext.currentComponent;
            if (currentComponent) {
                if (!currentComponent._contextValues) currentComponent._contextValues = new Map();
                currentComponent._contextValues.set(this, contextValue);
            }
            return props.children;
        };
        this.Consumer = function ContextConsumer(props) {
            const currentComponent = HooksContext.currentComponent;
            const value = currentComponent && currentComponent._contextValues &&
                currentComponent._contextValues.get(this) || defaultValue;
            return typeof props.children === 'function' ? props.children(value) : null;
        };
    }
}
/**
 * EventManager handles event delegation for better performance.
 * Similar to React's event system.
 * 
 * @class
 * @private
 */
class EventManager {
    /**
     * Creates a new EventManager.
     */
    constructor() {
        this._eventHandlers = new WeakMap();
        this._supportedEvents = [
            'click', 'dblclick', 'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout',
            'keydown', 'keyup', 'keypress', 'submit', 'change', 'focus', 'blur', 'input',
            'touchstart', 'touchmove', 'touchend', 'touchcancel'
        ];
        this._initialized = false;
    }
    /**
     * Initializes the event system.
     */
    init() {
        if (this._initialized) return;
        try {
            this._supportedEvents.forEach(eventType => {
                document.addEventListener(eventType, this._handleEvent.bind(this), true);
            });
            this._initialized = true;
        } catch (error) {
            ErrorSystem.handleError(
                new EventException(`Failed to initialize event system: ${error.message}`, { context: { error } })
            );
        }
    }
    /**
     * Registers an event handler for a DOM node.
     * 
     * @param {Node} domNode - The DOM node to attach the handler to
     * @param {string} eventType - The event type (e.g., 'click')
     * @param {string} propName - The prop name (e.g., 'onClick')
     * @param {Function} handler - The event handler function
     */
    registerEvent(domNode, eventType, propName, handler) {
        try {
            if (!this._eventHandlers.has(domNode)) this._eventHandlers.set(domNode, {});
            const nodeHandlers = this._eventHandlers.get(domNode);
            if (!nodeHandlers[eventType]) nodeHandlers[eventType] = {};
            nodeHandlers[eventType][propName] = handler;
        } catch (error) {
            ErrorSystem.handleError(
                new EventException(`Failed to register event handler: ${error.message}`,
                    { context: { domNode, eventType, propName, error } })
            );
        }
    }
    /**
     * Removes all event handlers for a DOM node.
     * 
     * @param {Node} domNode - The DOM node to remove handlers from
     */
    removeAllHandlers(domNode) {
        try {
            if (this._eventHandlers.has(domNode)) this._eventHandlers.delete(domNode);
        } catch (error) {
            ErrorSystem.handleError(
                new EventException(`Failed to remove event handlers: ${error.message}`,
                    { context: { domNode, error } })
            );
        }
    }
    /**
     * Handles a native DOM event and dispatches it to registered handlers.
     * 
     * @param {Event} nativeEvent - The native DOM event
     * @private
     */
    _handleEvent(nativeEvent) {
        try {
            const syntheticEvent = new SyntheticEvent(nativeEvent);
            let target = nativeEvent.target;
            const eventType = nativeEvent.type;
            const targetPath = [];
            while (target && target !== document) {
                targetPath.unshift(target);
                target = target.parentNode;
            }
            for (const node of targetPath) {
                this._executeHandlersForNode(node, eventType, syntheticEvent, 'Capture');
                if (syntheticEvent.isPropagationStopped()) break;
            }
            if (!syntheticEvent.isPropagationStopped()) {
                for (let i = targetPath.length - 1; i >= 0; i--) {
                    this._executeHandlersForNode(targetPath[i], eventType, syntheticEvent);
                    if (syntheticEvent.isPropagationStopped()) break;
                }
            }
            if (syntheticEvent.isDefaultPrevented() && nativeEvent.preventDefault)
                nativeEvent.preventDefault();
        } catch (error) {
            ErrorSystem.handleError(
                new EventException(`Error handling event: ${error.message}`,
                    { context: { eventType: nativeEvent.type, error } })
            );
        }
    }
    /**
     * Executes event handlers registered for a node.
     * 
     * @param {Node} node - The DOM node
     * @param {string} eventType - The event type
     * @param {SyntheticEvent} syntheticEvent - The synthetic event
     * @param {string} [phase=''] - The event phase ('Capture' or '')
     * @private
     */
    _executeHandlersForNode(node, eventType, syntheticEvent, phase = '') {
        try {
            if (!this._eventHandlers.has(node)) return;
            const nodeHandlers = this._eventHandlers.get(node);
            if (!nodeHandlers[eventType]) return;
            const handlerName = `on${eventType.charAt(0).toUpperCase() + eventType.slice(1)}${phase}`;
            const handler = nodeHandlers[eventType][handlerName];
            if (typeof handler === 'function') {
                syntheticEvent.currentTarget = node;
                handler(syntheticEvent);
            }
        } catch (error) {
            ErrorSystem.handleError(
                new EventException(`Error executing event handler: ${error.message}`, {
                    context: {
                        node, eventType,
                        handlerName: `on${eventType.charAt(0).toUpperCase() + eventType.slice(1)}${phase}`,
                        error
                    }
                })
            );
        }
    }
}
/**
 * VirtualDOMReconciliation handles the process of updating the DOM efficiently.
 * Similar to React's reconciliation algorithm.
 * 
 * @class
 * @private
 */
class VirtualDOMReconciliation {
    /**
     * Creates a new VirtualDOMReconciliation instance.
     */
    constructor() {
        this._updateQueue = [];
        this._effectQueue = [];
        this._isBatchingUpdates = false;
        this._batchTimeout = null;
        this._isProcessingUpdates = false;
        this._renderErrorHandlers = [];
    }
    /**
     * Registers a handler for render errors.
     * 
     * @param {Function} handler - Error handler function
     */
    registerRenderErrorHandler(handler) {
        if (typeof handler === 'function' && !this._renderErrorHandlers.includes(handler)) {
            this._renderErrorHandlers.push(handler);
        }
    }
    /**
     * Schedules a component for update.
     * 
     * @param {Component} component - The component to update
     */
    scheduleUpdate(component) {
        if (!this._updateQueue.includes(component)) this._updateQueue.push(component);
        if (!this._isBatchingUpdates) {
            this._isBatchingUpdates = true;
            this._batchTimeout = setTimeout(() => this._processBatchedUpdates(), 0);
        }
    }
    /**
     * Processes all batched updates.
     * 
     * @private
     */
    _processBatchedUpdates() {
        if (this._isProcessingUpdates) return;
        this._isProcessingUpdates = true;
        this._isBatchingUpdates = false;
        clearTimeout(this._batchTimeout);
        try {
            const components = [...this._updateQueue];
            this._updateQueue = [];
            for (const component of components) {
                try {
                    this._updateComponent(component);
                } catch (error) {
                    ErrorSystem.handleError(
                        new ComponentException(`Error updating component: ${error.message}`,
                            { context: { component, error } })
                    );
                }
            }
            this._flushEffects();
        } catch (error) {
            ErrorSystem.handleError(
                new ValidationException(`Error processing batched updates: ${error.message}`,
                    { context: { error } })
            );
        } finally {
            this._isProcessingUpdates = false;
            if (this._updateQueue.length > 0) {
                this._isBatchingUpdates = true;
                this._batchTimeout = setTimeout(() => this._processBatchedUpdates(), 0);
            }
        }
    }
    /**
     * Executes all pending effect functions.
     * 
     * @private
     */
    _flushEffects() {
        try {
            const effectsToRun = [...this._effectQueue];
            this._effectQueue = [];
            for (const effect of effectsToRun) {
                if (effect.effect && typeof effect.effect === 'function') {
                    try {
                        effect.effect();
                    } catch (error) {
                        ErrorSystem.handleError(
                            new EffectException(`Error in effect: ${error.message}`,
                                { context: { effect, error } })
                        );
                    }
                }
            }
        } catch (error) {
            ErrorSystem.handleError(
                new EffectException(`Error flushing effects: ${error.message}`,
                    { context: { error } })
            );
        }
    }
    /**
     * Schedules an effect function to run after render.
     * 
     * @param {Function} effect - The effect function to run
     */
    scheduleEffect(effect) {
        this._effectQueue.push({ effect });
    }
    /**
     * Updates a specific component.
     * 
     * @param {Component} component - The component to update
     * @private
     */
    _updateComponent(component) {
        if (!component._isMounted) return;
        component._renderInProgress = true;
        try {
            let newVNode;
            if (component instanceof Component) {
                component._commitState();
                if (component._hasError && component.state._reset) {
                    component._hasError = null;
                    component._errorInfo = null;
                    delete component.state._reset;
                }
                newVNode = component.render();
            } else {
                HooksContext.setCurrentComponent(component);
                newVNode = component.render();
                HooksContext.setCurrentComponent(null);
            }
            if (!newVNode) {
                component._renderInProgress = false;
                return;
            }
            const domNode = component._currentDOMNode;
            if (!domNode || !domNode.parentNode) {
                component._renderInProgress = false;
                return;
            }
            this._reconcile(domNode.parentNode, domNode, newVNode, component);
        } catch (error) {
            if (component instanceof Component && component.isErrorBoundary()) {
                component._hasError = error;
                component._errorInfo = { componentName: component.constructor.name };
                component.componentDidCatch(error, component._errorInfo);
                try {
                    const errorUI = component.renderError();
                    const domNode = component._currentDOMNode;
                    if (domNode && domNode.parentNode) {
                        this._reconcile(domNode.parentNode, domNode, errorUI, component);
                    }
                } catch (errorUIError) {
                    ErrorSystem.handleError(new ComponentException(
                        `Error rendering error UI: ${errorUIError.message}`,
                        { context: { component, originalError: error, errorUIError } }
                    ));
                }
            } else {
                let parent = component._parentComponent;
                let handled = false;
                while (parent && !handled) {
                    if (parent instanceof Component && parent.isErrorBoundary()) {
                        parent._hasError = error;
                        parent._errorInfo = {
                            componentName: component.constructor ? component.constructor.name : 'Unknown'
                        };
                        if (parent.componentDidCatch(error, parent._errorInfo)) {
                            handled = true;
                            this.scheduleUpdate(parent);
                        }
                    }
                    parent = parent._parentComponent;
                }
                if (!handled) {
                    ErrorSystem.handleError(new ComponentException(
                        `Error updating component: ${error.message}`,
                        { context: { component, error } }
                    ));
                }
            }
        } finally {
            component._renderInProgress = false;
        }
    }
    /**
     * Mounts a virtual element to a container.
     * 
     * @param {VirtualElement} vnode - The virtual element to mount
     * @param {Element} container - The container element
     * @returns {Node} The mounted DOM node
     */
    mount(vnode, container) {
        try {
            if (container && typeof container.innerHTML === 'string') container.innerHTML = '';
            const domNode = vnode.render();
            if (domNode) {
                container.appendChild(domNode);
                this._executeComponentDidMount(vnode);
                this._flushEffects();
            }
            return domNode;
        } catch (error) {
            ErrorSystem.handleError(
                new RenderException(`Error mounting component: ${error.message}`,
                    { context: { vnode, container, error } })
            );
            if (container) {
                const errorHTML = new DOMException(
                    `Error al montar componente: ${error.message}`,
                    { severity: 'critical' }
                ).toHTML();
                container.innerHTML = '';
                const errorContainer = document.createElement('div');
                errorContainer.innerHTML = errorHTML;
                container.appendChild(errorContainer);
            }
            return null;
        }
    }
    /**
     * Executes componentDidMount for all components in a virtual element tree.
     * 
     * @param {VirtualElement} vnode - The virtual element
     * @private
     */
    _executeComponentDidMount(vnode) {
        try {
            if (
                typeof vnode.type === 'function' &&
                (
                    vnode.type.prototype instanceof Component ||
                    (vnode.type.prototype && vnode.type.prototype.isComponent)
                )
            ) {
                const element = document.querySelector(`[data-component-id="${vnode.props.key || ''}"]`);
                if (element && element._componentInstance) {
                    const instance = element._componentInstance;
                    if (typeof instance.componentDidMount === 'function') {
                        instance.componentDidMount();
                    }
                }
            }
            for (const child of vnode.children || []) {
                this._executeComponentDidMount(child);
            }
        } catch (error) {
            ErrorSystem.handleError(new ComponentException(
                `Error in componentDidMount: ${error.message}`,
                { context: { component: vnode.type?.name || 'Unknown', error } }
            ));
        }
    }
    /**
     * Reconciles a DOM node with a new virtual element.
     * 
     * @param {Node} parent - The parent DOM node
     * @param {Node} domNode - The current DOM node
     * @param {VirtualElement} newVNode - The new virtual element
     * @param {Component} ownerComponent - The owner component
     * @returns {Node} The updated DOM node
     * @private
     */
    _reconcile(parent, domNode, newVNode, ownerComponent) {
        try {
            if (!domNode) {
                const newNode = newVNode.render(ownerComponent);
                if (newNode && parent) parent.appendChild(newNode);
                return newNode;
            }
            if (!newVNode) {
                this._unmountComponentAtNode(domNode);
                if (parent) parent.removeChild(domNode);
                return null;
            }
            const oldVNode = domNode._vnode;
            if (newVNode instanceof TextElement) {
                if (domNode.nodeType === Node.TEXT_NODE) {
                    if (domNode.nodeValue !== newVNode.value) domNode.nodeValue = newVNode.value;
                    domNode._vnode = newVNode;
                    return domNode;
                } else {
                    const newTextNode = document.createTextNode(newVNode.value);
                    newTextNode._vnode = newVNode;
                    this._unmountComponentAtNode(domNode);
                    if (parent) parent.replaceChild(newTextNode, domNode);
                    return newTextNode;
                }
            }
            if (typeof newVNode.type === 'function') {
                return this._reconcileComponent(parent, domNode, newVNode, ownerComponent);
            }
            if (!oldVNode || oldVNode.type !== newVNode.type || oldVNode.key !== newVNode.key) {
                const newNode = newVNode.render(ownerComponent);
                this._unmountComponentAtNode(domNode);
                if (parent && newNode) parent.replaceChild(newNode, domNode);
                return newNode;
            }
            this._updateProps(domNode, oldVNode.props, newVNode.props);
            this._reconcileChildren(domNode, oldVNode.children, newVNode.children);
            domNode._vnode = newVNode;
            return domNode;
        } catch (error) {
            ErrorSystem.handleError(
                new RenderException(`Error in reconciliation: ${error.message}`,
                    { context: { parent, domNode, newVNode, error } })
            );
            try {
                const fallbackNode = document.createElement('div');
                fallbackNode.setAttribute('data-error', 'reconciliation-error');
                fallbackNode.style.color = 'red';
                fallbackNode.style.padding = '5px';
                fallbackNode.style.border = '1px solid red';
                fallbackNode.textContent = `Rendering error: ${error.message}`;
                if (parent && domNode) parent.replaceChild(fallbackNode, domNode);
                return fallbackNode;
            } catch (fallbackError) {
                console.error('Error creating fallback UI:', fallbackError);
                return null;
            }
        }
    }
    /**
     * Reconciles a component instance.
     * 
     * @param {Node} parent - The parent DOM node
     * @param {Node} domNode - The current DOM node
     * @param {VirtualElement} newVNode - The new virtual element
     * @param {Component} parentComponent - The parent component
     * @returns {Node} The updated DOM node
     * @private
     */
    _reconcileComponent(parent, domNode, newVNode, parentComponent) {
        try {
            const ComponentClass = newVNode.type;
            if (domNode._ownerComponent &&
                (
                    (
                        domNode._ownerComponent instanceof Component &&
                        domNode._ownerComponent.constructor === ComponentClass
                    ) ||
                    (
                        domNode._ownerComponent._currentVNode &&
                        domNode._ownerComponent._currentVNode.type === ComponentClass
                    )
                )
            ) {
                const instance = domNode._ownerComponent;
                const oldProps = { ...instance.props };
                instance.props = { ...newVNode.props, children: newVNode.children };
                try {
                    let renderedVNode;
                    if (instance instanceof Component) {
                        if (instance._hasError && !instance.state._reset) renderedVNode = instance.renderError();
                        else renderedVNode = instance.render();
                    } else {
                        instance._currentVNode = newVNode;
                        HooksContext.setCurrentComponent(instance);
                        renderedVNode = instance.render();
                        HooksContext.setCurrentComponent(null);
                    }
                    if (!renderedVNode) return domNode;
                    const updatedNode = this._reconcile(parent, domNode, renderedVNode, instance);
                    if (instance instanceof Component && typeof instance.componentDidUpdate === 'function' && !instance._hasError) {
                        instance.componentDidUpdate(oldProps, instance._prevState || {});
                    }
                    return updatedNode;
                } catch (error) {
                    if (instance instanceof Component && instance.isErrorBoundary()) {
                        instance._hasError = error;
                        instance._errorInfo = {
                            componentName: ComponentClass.name || 'UnnamedComponent'
                        };
                        instance.componentDidCatch(error, instance._errorInfo);
                        try {
                            const errorUI = instance.renderError();
                            return this._reconcile(parent, domNode, errorUI, instance);
                        } catch (errorUIError) {
                            throw new ComponentException(
                                `Error rendering error UI: ${errorUIError.message}`,
                                { context: { component: instance, originalError: error } }
                            );
                        }
                    } else {
                        let boundary = parentComponent;
                        let handled = false;
                        while (boundary && !handled) {
                            if (boundary instanceof Component && boundary.isErrorBoundary()) {
                                boundary._hasError = error;
                                boundary._errorInfo = {
                                    componentName: ComponentClass.name || 'UnnamedComponent'
                                };
                                if (boundary.componentDidCatch(error, boundary._errorInfo)) {
                                    handled = true;
                                    this.scheduleUpdate(boundary);
                                    return domNode;
                                }
                            }
                            boundary = boundary._parentComponent;
                        }
                        throw new ComponentException(
                            `Error updating component ${ComponentClass.name || 'Component'}: ${error.message}`,
                            { context: { component: instance, error } }
                        );
                    }
                }
            } else {
                try {
                    this._unmountComponentAtNode(domNode);
                    const newNode = newVNode.render(parentComponent);
                    if (parent && newNode) parent.replaceChild(newNode, domNode);
                    return newNode;
                } catch (error) {
                    throw new ComponentException(
                        `Error replacing component: ${error.message}`,
                        { context: { component: ComponentClass.name || 'Component', error } }
                    );
                }
            }
        } catch (error) {
            ErrorSystem.handleError(
                error instanceof Exception ? error : new ComponentException(
                    `Component reconciliation error: ${error.message}`,
                    { context: { component: newVNode.type?.name || 'UnnamedComponent', error } }
                )
            );
            const errorNode = document.createElement('div');
            errorNode.setAttribute('data-error', 'component-error');
            errorNode.style.color = 'red';
            errorNode.style.padding = '10px';
            errorNode.style.border = '1px solid red';
            errorNode.innerHTML = `<h4>Component Error</h4><p>${error.message}</p>`;
            if (parent) {
                try {
                    parent.replaceChild(errorNode, domNode);
                } catch (replaceError) {
                    console.error('Error replacing node with error UI:', replaceError);
                }
            }
            return errorNode;
        }
    }
    /**
     * Reconciles children of a DOM node.
     * 
     * @param {Node} domNode - The parent DOM node
     * @param {Array<VirtualElement>} oldChildren - The old virtual children
     * @param {Array<VirtualElement>} newChildren - The new virtual children
     * @param {Component} [parentComponent] - The parent component
     * @private
     */
    _reconcileChildren(domNode, oldChildren = [], newChildren = [], parentComponent) {
        try {
            const existingChildren = {};
            const domChildNodes = Array.from(domNode.childNodes);
            for (let i = 0; i < domChildNodes.length; i++) {
                const childNode = domChildNodes[i];
                const oldVNode = oldChildren[i] || childNode._vnode;
                if (oldVNode && oldVNode.key != null) {
                    existingChildren[oldVNode.key] = { domNode: childNode, vnode: oldVNode, index: i };
                } else {
                    existingChildren[`__index_${i}`] = { domNode: childNode, vnode: oldVNode, index: i };
                }
            }
            let lastIndex = 0;
            const newDomNodes = [];
            for (let i = 0; i < newChildren.length; i++) {
                const newChild = newChildren[i];
                if (!newChild) continue;
                const key = newChild.key != null ? newChild.key : `__index_${i}`;
                const existingChild = existingChildren[key];
                try {
                    if (existingChild &&
                        (existingChild.vnode && newChild && existingChild.vnode.type === newChild.type)) {
                        const updatedNode = this._reconcile(domNode, existingChild.domNode, newChild, parentComponent);
                        if (existingChild.index < lastIndex) {
                            domNode.appendChild(updatedNode);
                        } else {
                            lastIndex = existingChild.index;
                        }
                        newDomNodes[i] = updatedNode;
                        delete existingChildren[key];
                    } else {
                        const newNode = newChild.render(parentComponent);
                        newDomNodes[i] = newNode;
                        if (i >= domChildNodes.length) {
                            domNode.appendChild(newNode);
                        } else {
                            domNode.insertBefore(newNode, domChildNodes[i]);
                        }
                    }
                } catch (error) {
                    ErrorSystem.handleError(
                        new RenderException(`Error reconciling child: ${error.message}`, {
                            severity: 'warning',
                            context: { childIndex: i, child: newChild, error }
                        })
                    );
                    const errorNode = document.createElement('div');
                    errorNode.setAttribute('data-error', 'child-reconciliation-error');
                    errorNode.style.color = 'red';
                    errorNode.style.padding = '5px';
                    errorNode.style.border = '1px dashed red';
                    errorNode.textContent = `Child render error: ${error.message}`;
                    if (i >= domChildNodes.length) {
                        domNode.appendChild(errorNode);
                    } else {
                        domNode.insertBefore(errorNode, domChildNodes[i]);
                    }
                    newDomNodes[i] = errorNode;
                }
            }
            for (const key in existingChildren) {
                const childToRemove = existingChildren[key];
                this._unmountComponentAtNode(childToRemove.domNode);
                domNode.removeChild(childToRemove.domNode);
            }
        } catch (error) {
            throw new RenderException(`Error reconciling children: ${error.message}`,
                { context: { parentNode: domNode, error } }
            );
        }
    }
    /**
     * Updates the props of a DOM node.
     * 
     * @param {Element} domNode - The DOM node to update
     * @param {Object} oldProps - The old props
     * @param {Object} newProps - The new props
     * @private
     */
    _updateProps(domNode, oldProps = {}, newProps = {}) {
        try {
            for (const key in oldProps) {
                if (!(key in newProps) && key !== 'children') {
                    if (key.startsWith('on')) {
                        EventSystem.registerEvent(domNode, key.slice(2).toLowerCase(), key, null);
                    } else if (key === 'style') {
                        domNode.style = '';
                    } else if (key === 'className') {
                        domNode.removeAttribute('class');
                    } else {
                        domNode.removeAttribute(key);
                    }
                }
            }
            for (const key in newProps) {
                if (key !== 'children' && key !== 'key' && oldProps[key] !== newProps[key]) {
                    if (key.startsWith('on') && typeof newProps[key] === 'function') {
                        EventSystem.registerEvent(domNode, key.slice(2).toLowerCase(), key, newProps[key]);
                    } else if (key === 'style' && typeof newProps[key] === 'object') {
                        this._updateStyles(domNode.style, oldProps.style || {}, newProps.style);
                    } else if (key === 'className') {
                        domNode.setAttribute('class', newProps[key]);
                    } else if (typeof newProps[key] === 'boolean') {
                        if (newProps[key]) domNode.setAttribute(key, '');
                        else domNode.removeAttribute(key);
                    } else if (key !== 'ref') {
                        const safeValue = typeof newProps[key] === 'string'
                            ? newProps[key].replace(/[<>"&]/g, char => {
                                switch (char) {
                                    case '<': return '&lt;';
                                    case '>': return '&gt;';
                                    case '"': return '&quot;';
                                    case '&': return '&amp;';
                                    default: return char;
                                }
                            })
                            : newProps[key];
                        domNode.setAttribute(key, safeValue);
                    }
                }
            }
            this._updateRefs(domNode, oldProps.ref, newProps.ref);
        } catch (error) {
            throw new RenderException(`Error updating props: ${error.message}`,
                { context: { domNode, oldProps, newProps, error } }
            );
        }
    }
    /**
     * Updates the styles of a DOM node.
     * 
     * @param {CSSStyleDeclaration} domStyle - The DOM style object
     * @param {Object} oldStyles - The old styles
     * @param {Object} newStyles - The new styles
     * @private
     */
    _updateStyles(domStyle, oldStyles = {}, newStyles = {}) {
        try {
            for (const key in oldStyles) {
                if (!(key in newStyles)) domStyle[key] = '';
            }
            for (const key in newStyles) {
                if (oldStyles[key] !== newStyles[key]) {
                    const value = String(newStyles[key]).trim();
                    if (!/javascript:|expression\(|[<>]/i.test(value)) {
                        domStyle[key] = value;
                    } else {
                        ErrorSystem.handleError(new Exception(
                            `Potentially unsafe style value rejected: ${key}`,
                            { severity: 'warning', context: { style: key, value } }
                        ));
                    }
                }
            }
        } catch (error) {
            throw new RenderException(`Error updating styles: ${error.message}`,
                { context: { oldStyles, newStyles, error } }
            );
        }
    }
    /**
     * Updates the refs of a DOM node.
     * 
     * @param {Node} domNode - The DOM node
     * @param {Function|Object} oldRef - The old ref
     * @param {Function|Object} newRef - The new ref
     * @private
     */
    _updateRefs(domNode, oldRef, newRef) {
        try {
            if (oldRef && oldRef !== newRef) {
                if (typeof oldRef === 'function') {
                    oldRef(null);
                } else if (oldRef.current) {
                    oldRef.current = null;
                }
            }
            if (newRef && oldRef !== newRef) {
                if (typeof newRef === 'function') {
                    newRef(domNode);
                } else {
                    newRef.current = domNode;
                }
            }
        } catch (error) {
            throw new RenderException(`Error updating refs: ${error.message}`,
                { context: { domNode, error } }
            );
        }
    }
    /**
     * Unmounts a component from a DOM node.
     * 
     * @param {Node} domNode - The DOM node to unmount
     * @private
     */
    _unmountComponentAtNode(domNode) {
        try {
            if (!domNode) return;
            if (domNode._ownerComponent) {
                const instance = domNode._ownerComponent;
                if (instance instanceof Component && typeof instance.componentWillUnmount === 'function') {
                    instance.componentWillUnmount();
                }
                instance._isMounted = false;
            }
            EventSystem.removeAllHandlers(domNode);
            for (let i = 0; i < domNode.childNodes.length; i++) {
                this._unmountComponentAtNode(domNode.childNodes[i]);
            }
        } catch (error) {
            ErrorSystem.handleError(new ComponentException(
                `Error unmounting component: ${error.message}`,
                { context: { domNode, error } }
            ));
        }
    }
}
/**
 * HooksManager manages the current component and hook state for functional components.
 * 
 * @class
 * @private
 */
class HooksManager {
    /**
     * Creates a new HooksManager.
     */
    constructor() {
        this.currentComponent = null;
        this.hookIndex = 0;
    }
    /**
     * Sets the current component for hook context.
     * 
     * @param {Object} component - The component context for hooks
     */
    setCurrentComponent(component) {
        this.currentComponent = component;
        this.hookIndex = 0;
    }
}
/**
 * Hooks provides React-like hooks for functional components.
 * 
 * @class
 * @private
 */
class Hooks {
    /**
     * Creates a state hook for functional components.
     * 
     * @param {*} initialState - The initial state value or function
     * @returns {Array} An array with current state and setState function
     * @throws {HookException} If called outside a functional component
     */
    static useState(initialState) {
        if (!HooksContext.currentComponent) {
            throw new HookException('Hooks solo pueden ser llamados dentro de componentes funcionales');
        }
        const component = HooksContext.currentComponent;
        const hookIndex = HooksContext.hookIndex++;
        if (!component._hooks) component._hooks = [];
        if (hookIndex >= component._hooks.length) {
            component._hooks[hookIndex] = {
                type: 'state',
                state: typeof initialState === 'function' ? initialState() : initialState,
                queue: []
            };
        }
        const hook = component._hooks[hookIndex];
        const setState = (newState) => {
            try {
                const nextState = typeof newState === 'function' ? newState(hook.state) : newState;
                if (nextState !== hook.state) {
                    hook.state = nextState;
                    if (component._isMounted) ReconciliationManager.scheduleUpdate(component);
                }
            } catch (error) {
                ErrorSystem.handleError(
                    new Exception(`Error in setState for hooks: ${error.message}`,
                        { context: { component, error } })
                );
            }
        };
        return [hook.state, setState];
    }
    /**
     * Creates an effect hook for side effects in functional components.
     * 
     * @param {Function} effect - The effect function
     * @param {Array} [deps] - Dependency array to control when the effect runs
     * @throws {HookException} If called outside a functional component
     */
    static useEffect(effect, deps) {
        try {
            if (!HooksContext.currentComponent) {
                throw new HookException('Hooks solo pueden ser llamados dentro de componentes funcionales');
            }
            const component = HooksContext.currentComponent;
            const hookIndex = HooksContext.hookIndex++;
            if (!component._hooks) component._hooks = [];
            let shouldRun = false;
            let hook;
            if (hookIndex >= component._hooks.length) {
                hook = { type: 'effect', deps: deps, cleanup: null, effect: effect };
                component._hooks[hookIndex] = hook;
                shouldRun = true;
            } else {
                hook = component._hooks[hookIndex];
                if (!deps) {
                    shouldRun = true;
                } else if (!hook.deps) {
                    shouldRun = true;
                } else if (deps.length !== hook.deps.length) {
                    shouldRun = true;
                } else {
                    for (let i = 0; i < deps.length; i++) {
                        if (deps[i] !== hook.deps[i]) {
                            shouldRun = true;
                            break;
                        }
                    }
                }
                hook.deps = deps;
            }
            if (shouldRun) {
                const effectFunction = () => {
                    try {
                        if (typeof hook.cleanup === 'function') {
                            hook.cleanup();
                        }
                        const cleanup = effect();
                        hook.cleanup = typeof cleanup === 'function' ? cleanup : null;
                    } catch (error) {
                        ErrorSystem.handleError(
                            new HookException(`Error in effect function: ${error.message}`,
                                { context: { component, error } })
                        );
                    }
                };
                ReconciliationManager.scheduleEffect(effectFunction);
            }
        } catch (error) {
            ErrorSystem.handleError(
                new HookException(`Error setting up effect: ${error.message}`,
                    { context: { error } })
            );
        }
    }
    /**
     * Creates a reducer hook for more complex state logic.
     * 
     * @param {Function} reducer - The reducer function (state, action) => newState
     * @param {*} initialState - The initial state
     * @param {Function} [init] - Optional initializer function
     * @returns {Array} An array with current state and dispatch function
     * @throws {HookException} If called outside a functional component
     */
    static useReducer(reducer, initialState, init) {
        try {
            if (!HooksContext.currentComponent) {
                throw new HookException('Hooks solo pueden ser llamados dentro de componentes funcionales');
            }
            const component = HooksContext.currentComponent;
            const hookIndex = HooksContext.hookIndex++;
            if (!component._hooks) component._hooks = [];
            if (hookIndex >= component._hooks.length) {
                component._hooks[hookIndex] = {
                    type: 'reducer',
                    state: init ? init(initialState) : initialState,
                    reducer: reducer
                };
            }
            const hook = component._hooks[hookIndex];
            const dispatch = (action) => {
                try {
                    const nextState = hook.reducer(hook.state, action);
                    if (nextState !== hook.state) {
                        hook.state = nextState;
                        if (component._isMounted) ReconciliationManager.scheduleUpdate(component);
                    }
                } catch (error) {
                    ErrorSystem.handleError(
                        new HookException(`Error in reducer: ${error.message}`,
                            { context: { component, action, currentState: hook.state, error } })
                    );
                }
            };
            return [hook.state, dispatch];
        } catch (error) {
            ErrorSystem.handleError(
                new HookException(`Error setting up reducer: ${error.message}`,
                    { context: { error } })
            );
            return [{}, () => { }];
        }
    }
    /**
     * Creates a ref hook for persisting mutable values.
     * 
     * @param {*} initialValue - The initial value for the ref
     * @returns {Object} A ref object with a 'current' property
     * @throws {HookException} If called outside a functional component
     */
    static useRef(initialValue) {
        try {
            const component = HooksContext.currentComponent;
            if (!component) throw new HookException('Hooks solo pueden ser llamados dentro de componentes funcionales');
            const hookIndex = HooksContext.hookIndex++;
            if (!component._hooks) component._hooks = [];
            if (hookIndex >= component._hooks.length) component._hooks[hookIndex] = { type: 'ref', current: initialValue };
            return component._hooks[hookIndex];
        } catch (error) {
            ErrorSystem.handleError(new Exception(`Error in useRef: ${error.message}`, { context: { error } }));
            return { current: initialValue };
        }
    }
    /**
     * Creates a memo hook for memoizing expensive calculations.
     * 
     * @param {Function} factory - Function that returns the value to memoize
     * @param {Array} [deps] - Dependency array to control when to recalculate
     * @returns {*} The memoized value
     * @throws {HookException} If called outside a functional component
     */
    static useMemo(factory, deps) {
        try {
            if (!HooksContext.currentComponent) {
                throw new HookException('Hooks solo pueden ser llamados dentro de componentes funcionales');
            }
            const component = HooksContext.currentComponent;
            const hookIndex = HooksContext.hookIndex++;
            if (!component._hooks) component._hooks = [];
            let hook;
            if (hookIndex >= component._hooks.length) {
                try {
                    const value = factory();
                    hook = { type: 'memo', value, deps: deps || null, factory };
                    component._hooks[hookIndex] = hook;
                } catch (error) {
                    ErrorSystem.handleError(
                        new HookException(`Error computing initial memo value: ${error.message}`,
                            { context: { component, error } })
                    );
                    hook = { type: 'memo', value: null, deps: deps || null, factory, error };
                    component._hooks[hookIndex] = hook;
                }
            } else {
                hook = component._hooks[hookIndex];
                const depsChanged = !deps || !hook.deps || deps.length !== hook.deps.length ||
                    deps.some((dep, i) => dep !== hook.deps[i]);
                if (depsChanged) {
                    try {
                        hook.deps = deps || null;
                        hook.value = factory();
                        hook.factory = factory;
                    } catch (error) {
                        ErrorSystem.handleError(
                            new HookException(`Error recomputing memo value: ${error.message}`,
                                { context: { component, error } })
                        );
                        hook.error = error;
                    }
                }
            }
            return hook.value;
        } catch (error) {
            ErrorSystem.handleError(new Exception(`Error in useMemo: ${error.message}`, { context: { error } }));
            return null;
        }
    }
    /**
     * Creates a callback hook for memoizing callbacks.
     * 
     * @param {Function} callback - The callback function to memoize
     * @param {Array} [deps] - Dependency array to control when to recreate the callback
     * @returns {Function} The memoized callback
     */
    static useCallback(callback, deps) {
        return this.useMemo(() => callback, deps);
    }
    /**
     * Creates a context hook for accessing context values.
     * 
     * @param {Context} context - The context object created with createContext
     * @returns {*} The current context value
     * @throws {HookException} If called outside a functional component
     */
    static useContext(context) {
        const component = HooksContext.currentComponent;
        if (!component) {
            throw new HookException('useContext debe ser llamado dentro de un componente funcional');
        }
        if (component._contextValues && component._contextValues.has(context)) {
            return component._contextValues.get(context);
        }
        return context._defaultValue;
    }
    /**
     * Creates an error boundary hook for functional components.
     * 
     * @returns {Array} An array with error state and reset function
     * @throws {Exception} If called outside a functional component
     */
    static useErrorBoundary() {
        if (!HooksContext.currentComponent) {
            throw new Exception('Hooks solo pueden ser llamados dentro de componentes funcionales');
        }
        const component = HooksContext.currentComponent;
        const [error, setError] = Hooks.useState(null);
        Hooks.useEffect(() => {
            component._isErrorBoundary = true;
            component.componentDidCatch = (caughtError, errorInfo) => {
                setError({ error: caughtError, info: errorInfo });
                return true;
            };
            return () => {
                component._isErrorBoundary = false;
                component.componentDidCatch = null;
            };
        }, []);
        return [error, () => setError(null)];
    }
}
/**
 * ElementFactory creates different types of virtual elements.
 * 
 * @class
 * @private
 */
class ElementFactory {
    /**
     * Creates a virtual element.
     * 
     * @param {string|Function|Symbol} type - Element type (tag name, component, or special symbol)
     * @param {Object} [props] - Element properties
     * @param {...*} children - Child elements
     * @returns {VirtualElement} The created virtual element
     */
    createElement(type, props = {}, ...children) {
        try {
            return new VirtualElement(type, props, ...children);
        } catch (error) {
            ErrorSystem.handleError(
                new RenderException(`Error creating element of type ${typeof type === 'string' ? type : type?.name || 'Unknown'}: ${error.message}`,
                    { context: { type, props, children, error } })
            );
            return new VirtualElement('div', { 'data-error': true, style: { color: 'red' } }, [
                `Error creating ${typeof type === 'string' ? type : type?.name || 'Unknown'}`
            ]);
        }
    }
    /**
     * Creates a text element.
     * 
     * @param {string} text - The text content
     * @returns {TextElement} The created text element
     */
    createTextElement(text) {
        try {
            return new TextElement(String(text));
        } catch (error) {
            ErrorSystem.handleError(
                new RenderException(`Error creating text element: ${error.message}`,
                    { context: { text, error } })
            );
            return new TextElement('Error rendering text');
        }
    }
    /**
     * Creates a fragment element (group of children without a container).
     * 
     * @param {Array} children - Child elements
     * @returns {VirtualElement} The created fragment element
     */
    createFragment(children) {
        try {
            return new VirtualElement(Symbol.for('littedom.fragment'), {}, ...children);
        } catch (error) {
            ErrorSystem.handleError(
                new RenderException(`Error creating fragment: ${error.message}`,
                    { context: { children, error } })
            );
            return new VirtualElement(Symbol.for('littedom.fragment'), {}, []);
        }
    }
    /**
     * Creates a portal element (children rendered to a different part of the DOM).
     * 
     * @param {Array} children - Child elements
     * @param {Element} container - The container element to render to
     * @returns {VirtualElement} The created portal element
     */
    createPortal(children, container) {
        try {
            const portalElement = new VirtualElement(Symbol.for('littedom.portal'), {});
            portalElement.children = Array.isArray(children) ? children : [children];
            portalElement.containerInfo = container;
            return portalElement;
        } catch (error) {
            ErrorSystem.handleError(
                new RenderException(`Error creating portal: ${error.message}`,
                    { context: { children, container, error } })
            );
            return new VirtualElement(Symbol.for('littedom.fragment'), {}, []);
        }
    }
}
/**
 * SuspenseComponent handles suspended rendering for asynchronous operations.
 * Similar to React.Suspense.
 * 
 * @class
 * @extends Component
 * @private
 */
class SuspenseComponent extends Component {
    /**
     * Creates a new SuspenseComponent.
     * 
     * @param {Object} props - Component props
     */
    constructor(props) {
        super(props);
        this.state = { suspended: false, promise: null };
    }
    /**
     * Static method to derive state from an error.
     * 
     * @param {Error|Promise} error - The error or promise that was thrown
     * @returns {Object|null} New state if the error is a Promise, otherwise null
     */
    static getDerivedStateFromError(error) {
        if (error instanceof Promise) {
            return { suspended: true, promise: error };
        }
        throw error;
    }
    /**
     * Catches promises and resumes rendering when they resolve.
     * 
     * @param {Error|Promise} error - The error or promise that was thrown
     * @param {Object} errorInfo - Information about the error
     * @returns {boolean} True if the error was handled (is a Promise)
     */
    componentDidCatch(error, errorInfo) {
        if (error instanceof Promise) {
            error.then(() => {
                this.setState({ suspended: false, promise: null });
            }).catch(error => {
                ErrorSystem.handleError(
                    new Exception(`Error in suspended component: ${error.message}`,
                        { context: { error, errorInfo } })
                );
            });
            return true;
        }
        return false;
    }
    /**
     * Renders either the fallback UI or children depending on suspension state.
     * 
     * @returns {VirtualElement} The rendered UI
     */
    render() {
        if (this.state.suspended) {
            return this.props.fallback || createElement('div', {}, ['Loading...']);
        }
        return this.props.children;
    }
}
/**
 * LitteDOMAPI is the main public API for LitteDOM.
 * 
 * @class
 */
class LitteDOMAPI {
    /**
     * Creates a new LitteDOMAPI instance.
     */
    constructor() {
        this.factory = new ElementFactory();
        this._errorSystem = new ErrorSystemManager();
        this._errorSystem.initialize();
    }
    /**
     * Creates a virtual element.
     * 
     * @param {string|Function|Symbol} type - Element type (tag name, component, or special symbol)
     * @param {Object} [props] - Element properties
     * @param {...*} children - Child elements
     * @returns {VirtualElement} The created virtual element
     */
    createElement(type, props = {}, ...children) {
        try {
            return this.factory.createElement(type, props, ...children);
        } catch (error) {
            this._errorSystem.handleError(
                new RenderException(`Error creating element: ${error.message}`,
                    { context: { type, props, children, error } })
            );
            return this.factory.createElement('div', { 'data-error': true }, ['Error creating element']);
        }
    }
    /**
     * Clones and returns a new virtual element with new props and children.
     * 
     * @param {VirtualElement} element - The element to clone
     * @param {Object} [props] - New props to merge with existing props
     * @param {...*} children - New children (or uses existing if none provided)
     * @returns {VirtualElement} The cloned element
     */
    cloneElement(element, props, ...children) {
        if (!element) return null;
        const newProps = { ...element.props, ...props };
        const newChildren = children.length > 0 ? children : element.children;
        return this.createElement(element.type, newProps, ...newChildren);
    }
    /**
     * Renders a virtual element to a DOM container.
     * 
     * @param {VirtualElement} element - The element to render
     * @param {Element} container - The container element
     * @returns {Node} The rendered DOM node
     */
    render(element, container) {
        if (!EventSystem._initialized) EventSystem.init();
        try {
            if (!(element instanceof VirtualElement)) {
                element = this.factory.createElement(element, {}, []);
            }
            const domNode = ReconciliationManager.mount(element, container);
            container._rootDOMNode = domNode;
            return domNode;
        } catch (error) {
            this._errorSystem.handleError(
                new RenderException(`Error rendering: ${error.message}`, {
                    severity: 'critical',
                    context: {
                        element: element?.type?.name || (typeof element?.type === 'string' ? element.type : 'Unknown'),
                        container: container?.id || 'Unknown',
                        error
                    }
                })
            );
            if (container) {
                container.textContent = '';
                const errorDiv = document.createElement('div');
                errorDiv.style.color = 'red';
                errorDiv.style.padding = '10px';
                errorDiv.style.border = '1px solid red';
                errorDiv.style.backgroundColor = '#fff8f8';
                errorDiv.textContent = `Error at rendering: ${error.message}`;
                container.appendChild(errorDiv);
            }
            return null;
        }
    }
    /**
     * Unmounts a component from a container.
     * 
     * @param {Element} container - The container element
     * @returns {boolean} True if a component was unmounted
     */
    unmountComponentAtNode(container) {
        try {
            if (container._rootDOMNode) {
                ReconciliationManager._unmountComponentAtNode(container._rootDOMNode);
                container.innerHTML = '';
                container._rootDOMNode = null;
                return true;
            }
            return false;
        } catch (error) {
            this._errorSystem.handleError(
                new ComponentException(`Error unmounting component: ${error.message}`,
                    { context: { container, error } })
            );
            return false;
        }
    }
    /**
     * Finds the DOM node for a component.
     * 
     * @param {Component} component - The component instance
     * @returns {Node|null} The DOM node or null if not found
     */
    findDOMNode(component) {
        try {
            return component._currentDOMNode || null;
        } catch (error) {
            this._errorSystem.handleError(
                new DOMException(`Error finding DOM node: ${error.message}`,
                    { context: { component, error } })
            );
            return null;
        }
    }
    /**
     * Creates a portal (children rendered to a different part of the DOM).
     * 
     * @param {VirtualElement|Array} children - Child elements
     * @param {Element} container - The container element to render to
     * @returns {VirtualElement} The portal element
     */
    createPortal(children, container) {
        try {
            const portalElement = this.factory.createPortal(children, container);
            ReconciliationManager.mount(children, container);
            return portalElement;
        } catch (error) {
            this._errorSystem.handleError(new RenderException(
                `Error creating portal: ${error.message}`,
                { context: { container, error } }
            ));
            return this.factory.createFragment([]);
        }
    }
    /**
     * Creates a root for concurrent mode rendering.
     * 
     * @param {string|Element} container - Container element or ID
     * @returns {Object} Object with render and unmount methods
     */
    createRoot(container = 'root') {
        try {
            if (typeof container === 'string') {
                const id = container.id || container;
                container = document.getElementById(id) || document.createElement('div');
                if (!container.id) container.id = id;
                if (!container.parentNode) document.body.appendChild(container);
            }
            return {
                render: (element) => this.render(element, container),
                unmount: () => this.unmountComponentAtNode(container)
            };
        } catch (error) {
            this._errorSystem.handleError(
                new Exception(`Error creating root: ${error.message}`,
                    { context: { container, error } })
            );
            return { render: () => { }, unmount: () => false };
        }
    }
    /**
     * StrictMode component for highlighting potential problems in development.
     * In this implementation, it simply renders its children.
     * 
     * @param {Object} props - Component props
     * @returns {VirtualElement} The rendered children
     */
    StrictMode(props) {
        return this.createElement(Fragment, null, props.children);
    }
    /**
     * Creates a memoized version of a component.
     * 
     * @param {Function} Component - The component to memoize
     * @param {Function} [areEqual] - Custom props comparison function
     * @returns {Function} The memoized component
     */
    memo(Component, areEqual) {
        function MemoComponent(props) {
            const ref = Hooks.useRef({ props: null, result: null });
            if (!ref.current.props || !arePropsEqual(ref.current.props, props, areEqual)) {
                ref.current.props = { ...props };
                ref.current.result = createElement(Component, props);
            }
            return ref.current.result;
        }
        MemoComponent.displayName = `Memo(${Component.displayName || Component.name || 'Component'})`;
        return MemoComponent;
    }
}
/**
 * Compares props for the memo component.
 * 
 * @param {Object} prevProps - Previous props
 * @param {Object} nextProps - Next props
 * @param {Function} [areEqual] - Custom comparison function
 * @returns {boolean} True if props are equal
 * @private
 */
function arePropsEqual(prevProps, nextProps, areEqual) {
    if (areEqual) return areEqual(prevProps, nextProps);
    const prevKeys = Object.keys(prevProps);
    const nextKeys = Object.keys(nextProps);
    if (prevKeys.length !== nextKeys.length) return false;
    return prevKeys.every(key =>
        Object.hasOwnProperty.call(nextProps, key) &&
        prevProps[key] === nextProps[key]
    );
}
/**
 * Suspends rendering until a promise resolves.
 * Used with React.Suspense and React.lazy.
 * 
 * @param {Promise} promise - The promise to suspend on
 * @returns {*} The resolved value or throws the promise
 */
export function suspendUntil(promise) {
    if (promise && promise.then) {
        if (!suspendUntil._cache) suspendUntil._cache = new WeakMap();
        if (suspendUntil._cache.has(promise)) {
            return suspendUntil._cache.get(promise);
        } else if (promise._status === 'fulfilled') {
            return promise._result;
        } else if (promise._status === 'rejected') {
            throw promise._error;
        } else {
            throw promise.then(
                result => {
                    promise._status = 'fulfilled';
                    promise._result = result;
                    return result;
                },
                error => {
                    promise._status = 'rejected';
                    promise._error = error;
                    throw error;
                }
            );
        }
    }
    return promise;
}
/**
 * Creates a lazily-loaded component.
 * 
 * @param {Function} factory - A function that returns a promise that resolves to a component
 * @returns {Function} A component that renders the loaded component
 */
export function lazy(factory) {
    let Component = null;
    let loadingPromise = null;
    return function LazyComponent(props) {
        if (Component !== null) {
            return createElement(Component, props);
        }
        if (loadingPromise === null) {
            loadingPromise = factory().then(module => {
                Component = module.default || module;
                return Component;
            });
        }
        suspendUntil(loadingPromise);
        return createElement(Component, props);
    };
}

// Initialize singletons
const EventSystem = new EventManager();
const ReconciliationManager = new VirtualDOMReconciliation();
const HooksContext = new HooksManager();
const ErrorSystem = new ErrorSystemManager();

// Initialize error handling
ErrorSystem.initialize();
ErrorSystem.registerErrorHandler((error) => {
    if (error.severity === 'critical' || error.severity === 'error') {
        ErrorSystem.showGlobalError(error);
    }
});

// Create singleton instance
const LitteDOM = new LitteDOMAPI();
ReconciliationManager.registerRenderErrorHandler((error, info) => {
    ErrorSystem.handleError(error);
});

// Export hooks
export const useState = Hooks.useState;
export const useEffect = Hooks.useEffect;
export const useReducer = Hooks.useReducer;
export const useRef = Hooks.useRef;
export const useMemo = Hooks.useMemo;
export const useCallback = Hooks.useCallback;
export const useContext = Hooks.useContext;
export const useErrorBoundary = Hooks.useErrorBoundary;
export const Fragment = Symbol.for('littedom.fragment');

/**
 * Creates a virtual element.
 * 
 * @param {string|Function|Symbol} type - Element type (tag name, component, or special symbol)
 * @param {Object} [props] - Element properties
 * @param {...*} children - Child elements
 * @returns {VirtualElement} The created virtual element
 */
export function createElement(type, props = {}, ...children) {
    return LitteDOM.createElement(type, props, ...children);
}
/**
 * Clones and returns a new virtual element with new props and children.
 * 
 * @param {VirtualElement} element - The element to clone
 * @param {Object} [props] - New props to merge with existing props
 * @param {...*} children - New children (or uses existing if none provided)
 * @returns {VirtualElement} The cloned element
 */
export function cloneElement(element, props, ...children) {
    return LitteDOM.cloneElement(element, props, ...children);
}
/**
 * Creates a context object for sharing data without prop drilling.
 * 
 * @param {*} defaultValue - The default value when no Provider is found
 * @returns {Context} The created context object with Provider and Consumer
 */
export function createContext(defaultValue) {
    return new Context(defaultValue);
}
/**
 * Forwards refs to child components.
 * 
 * @param {Function} render - Render function that receives props and ref
 * @returns {Function} A component that forwards refs
 */
export function forwardRef(render) {
    function ForwardRefComponent(props) {
        const { forwardedRef, ...restProps } = props;
        return render(restProps, forwardedRef);
    }
    ForwardRefComponent.displayName = `ForwardRef(${render.name || 'Component'})`;
    return ForwardRefComponent;
}
/**
 * Creates a pre-configured error boundary component.
 * 
 * @param {VirtualElement} [fallback] - Fallback UI to show when an error occurs
 * @param {Function} [onError] - Function to call when an error is caught
 * @returns {ErrorBoundary} The error boundary component
 */
export function createErrorBoundary(fallback, onError) {
    return new ErrorBoundary({ fallback, onError });
}
/**
 * Higher-order component that wraps a component with an error boundary.
 * 
 * @param {Function} Component - The component to wrap
 * @param {Object} options - Options for the error boundary
 * @param {VirtualElement} [options.fallback] - Fallback UI to show when an error occurs
 * @param {Function} [options.onError] - Function to call when an error is caught
 * @returns {Function} The wrapped component
 */
export function withErrorBoundary(Component, { fallback, onError } = {}) {
    return function WithErrorBoundary(props) {
        return createElement(
            ErrorBoundary,
            { fallback: fallback || null, onError: onError || null },
            [createElement(Component, props)]
        );
    };
}
/**
 * Creates a memoized version of a component.
 * 
 * @param {Function} Component - The component to memoize
 * @param {Function} [areEqual] - Custom props comparison function
 * @returns {Function} The memoized component
 */
export function memo(Component, areEqual) {
    return LitteDOM.memo(Component, areEqual);
}
/**
 * StrictMode highlights potential problems in an application.
 * Currently, it just renders its children.
 * 
 * @param {Object} props - Component props
 * @returns {VirtualElement} The rendered children
 */
export function StrictMode(props) {
    return createElement(Fragment, null, props.children);
}
/**
 * Renders Suspense component for code-splitting with React.lazy.
 * 
 * @param {Object} props - Component props including children and fallback UI
 * @returns {VirtualElement} Suspense component instance
 */
export const Suspense = (props) => createElement(SuspenseComponent, props);
/**
 * Renders a virtual element to a string. Useful for server-side rendering.
 * 
 * @param {VirtualElement} element - The element to render
 * @returns {string} The rendered HTML string
 */
export function renderToString(element) {
    try {
        if (typeof element === 'string' || typeof element === 'number') {
            return String(element);
        }
        if (!element || !element.type) {
            return '';
        }
        if (typeof element.type === 'function') {
            const Component = element.type;
            const props = element.props || {};
            if (Component.prototype && (Component.prototype.isComponent || Component.prototype instanceof Component)) {
                const instance = new Component(props);
                const renderedElement = instance.render();
                return renderToString(renderedElement);
            } else {
                const renderedElement = Component(props);
                return renderToString(renderedElement);
            }
        }
        if (element.type === Symbol.for('littedom.fragment')) {
            return (element.children || []).map(renderToString).join('');
        }
        const attributes = [];
        for (const [key, value] of Object.entries(element.props || {})) {
            if (key === 'children' || key === 'key' || key === 'ref') continue;
            if (key === 'className') {
                attributes.push(`class="${value}"`);
            } else if (key === 'style' && typeof value === 'object') {
                const styles = Object.entries(value).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}:${v}`).join(';');
                attributes.push(`style="${styles}"`);
            } else if (typeof value === 'boolean') {
                if (value) attributes.push(key);
            } else {
                attributes.push(`${key}="${value}"`);
            }
        }
        const attributeString = attributes.length ? ' ' + attributes.join(' ') : '';
        if (element.type === 'img' || element.type === 'input' || element.type === 'br' || element.type === 'hr') {
            return `<${element.type}${attributeString}/>`;
        }
        const children = (element.children || []).map(renderToString).join('');
        return `<${element.type}${attributeString}>${children}</${element.type}>`;
    } catch (error) {
        ErrorSystem.handleError(new RenderException(`SSR Error: ${error.message}`, { context: { element, error } }));
        return '<!-- Error rendering component -->';
    }
}

// Default export for the main LitteDOM API
export default LitteDOM;