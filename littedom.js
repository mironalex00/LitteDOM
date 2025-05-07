'use strict';
/**
 * LitteDOMJs - Una reimplementación optimizada orientada a objetos
 */

// ==================== CLASES EXPORTADAS ====================
export class Component {
    constructor(props) {
        this.props = props || {};
        this.state = {};
        this._pendingState = null;
        this._isMounted = false;
        this._currentDOMNode = null;
        this._renderInProgress = false;
        this._pendingCallbacks = [];
        this.isComponent = {};
    }
    setState(partialState, callback) {
        if (typeof callback === 'function') this._pendingCallbacks.push(callback);
        this._pendingState = {
            ...this._pendingState,
            ...(typeof partialState === 'function' ? partialState(this.state, this.props) : partialState)
        };
        if (this._isMounted && !this._renderInProgress) ReconciliationManager.scheduleUpdate(this);
    }
    _commitState() {
        if (this._pendingState) {
            const prevState = { ...this.state };
            this.state = { ...this.state, ...this._pendingState };
            this._pendingState = null;
            if (this._isMounted && typeof this.componentDidUpdate === 'function')
                this.componentDidUpdate(this.props, prevState);
            while (this._pendingCallbacks.length > 0) this._pendingCallbacks.shift()();
        }
    }
    render() { throw new Error('El método render() debe ser implementado por las subclases'); }
    forceUpdate(callback) {
        if (typeof callback === 'function') this._pendingCallbacks.push(callback);
        if (this._isMounted && !this._renderInProgress) ReconciliationManager.scheduleUpdate(this);
    }
}

// ==================== CLASES INTERNAS ====================
class VirtualElement {
    constructor(type, props = {}, ...children) {
        this.type = type;
        this.props = props || {};
        this.key = props?.key !== undefined ? props.key : null;
        this.children = children.flat().filter(child => child != null)
            .map(child => this.normalizeChild(child));
    }
    normalizeChild(child) { return typeof child === 'object' ? child : new TextElement(String(child)); }
    render(parentComponent = null) {
        if (this.type === Symbol.for('littedom.fragment')) return this.renderFragment(parentComponent);
        else if (this.type === Symbol.for('littedom.portal')) return this.renderPortal(parentComponent);
        else if (typeof this.type === 'function') return this.renderComponent(parentComponent);
        else return this.renderDOMElement(parentComponent);
    }
    renderFragment(parentComponent) {
        const fragment = document.createDocumentFragment();
        for (const child of this.children) fragment.appendChild(child.render(parentComponent));
        return fragment;
    }
    renderPortal(parentComponent) {
        for (const child of this.children) this.containerInfo.appendChild(child.render(parentComponent));
        return document.createComment('portal');
    }
    renderComponent(parentComponent) {
        const ComponentClass = this.type;
        const isClassComponent = ComponentClass.prototype && ComponentClass.prototype.isComponent ||
            ComponentClass.prototype instanceof Component;
        if (isClassComponent) {
            const componentInstance = new ComponentClass(this.props);
            componentInstance.props = { ...this.props, children: this.children };
            const renderedVNode = componentInstance.render();
            if (!renderedVNode) {
                const emptyNode = document.createComment('empty component');
                componentInstance._currentDOMNode = emptyNode;
                componentInstance._isMounted = true;
                emptyNode._componentInstance = componentInstance;
                return emptyNode;
            }
            const domNode = renderedVNode.render(componentInstance);
            componentInstance._currentDOMNode = domNode;
            componentInstance._isMounted = true;
            domNode._componentInstance = componentInstance;
            domNode._vnode = renderedVNode;
            domNode._ownerComponent = componentInstance;
            return domNode;
        } else {
            try {
                const hooksComponent = {
                    _hooks: [],
                    _isMounted: false,
                    _currentVNode: this,
                    _renderInProgress: false,
                    _pendingEffects: [],
                    render: () => {
                        HooksContext.setCurrentComponent(hooksComponent);
                        return ComponentClass(hooksComponent.props || this.props);
                    },
                    props: this.props
                };
                HooksContext.setCurrentComponent(hooksComponent);
                const renderedElement = ComponentClass(this.props);
                HooksContext.setCurrentComponent(null);
                if (!renderedElement) return document.createComment('empty functional component');
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
                console.error('Error rendering functional component:', error);
                return document.createComment(`error: ${error.message}`);
            }
        }
    }
    renderDOMElement(parentComponent) {
        const element = document.createElement(this.type);
        element._vnode = this;
        this.applyProps(element);
        for (const child of this.children) {
            if (child) {
                const renderedChild = child.render(parentComponent);
                if (renderedChild) element.appendChild(renderedChild);
            }
        }
        if (this.props.ref) {
            if (typeof this.props.ref === 'function') this.props.ref(element);
            else if (this.props.ref && typeof this.props.ref === 'object') this.props.ref.current = element;
        }
        return element;
    }
    applyProps(element) {
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
            if (key !== 'children' && key !== 'key' && key !== 'ref') element.setAttribute(key, value);
        }
    }
    isSameType(otherVNode) {
        return otherVNode && this.type === otherVNode.type && this.key === otherVNode.key;
    }
}
class TextElement extends VirtualElement {
    constructor(value) {
        super("#text");
        this.value = value;
    }
    render() { return document.createTextNode(this.value); }
}
class SyntheticEvent {
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
    preventDefault() {
        this._isDefaultPrevented = true;
        if (this.nativeEvent.preventDefault) this.nativeEvent.preventDefault();
    }
    stopPropagation() {
        this._isPropagationStopped = true;
        if (this.nativeEvent.stopPropagation) this.nativeEvent.stopPropagation();
    }
    isDefaultPrevented() { return this._isDefaultPrevented; }
    isPropagationStopped() { return this._isPropagationStopped; }
}

// ==================== SINGLETONS Y GESTORES ====================
class EventManager {
    constructor() {
        this._eventHandlers = new WeakMap();
        this._supportedEvents = [
            'click', 'dblclick', 'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout',
            'keydown', 'keyup', 'keypress', 'submit', 'change', 'focus', 'blur', 'input',
            'touchstart', 'touchmove', 'touchend', 'touchcancel'
        ];
        this._initialized = false;
    }
    init() {
        this._supportedEvents.forEach(eventType => {
            document.addEventListener(eventType, this._handleEvent.bind(this), true);
        });
        this._initialized = true;
    }
    registerEvent(domNode, eventType, propName, handler) {
        if (!this._eventHandlers.has(domNode)) this._eventHandlers.set(domNode, {});
        const nodeHandlers = this._eventHandlers.get(domNode);
        if (!nodeHandlers[eventType]) nodeHandlers[eventType] = {};
        nodeHandlers[eventType][propName] = handler;
    }
    removeAllHandlers(domNode) {
        if (this._eventHandlers.has(domNode)) this._eventHandlers.delete(domNode);
    }
    _handleEvent(nativeEvent) {
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
        if (syntheticEvent.isDefaultPrevented() && nativeEvent.preventDefault) nativeEvent.preventDefault();
    }
    _executeHandlersForNode(node, eventType, syntheticEvent, phase = '') {
        if (!this._eventHandlers.has(node)) return;
        const nodeHandlers = this._eventHandlers.get(node);
        if (!nodeHandlers[eventType]) return;
        const handlerName = `on${eventType.charAt(0).toUpperCase() + eventType.slice(1)}${phase}`;
        const handler = nodeHandlers[eventType][handlerName];
        if (typeof handler === 'function') {
            syntheticEvent.currentTarget = node;
            handler(syntheticEvent);
        }
    }
}
class VirtualDOMReconciliation {
    constructor() {
        this._updateQueue = [];
        this._effectQueue = [];
        this._isBatchingUpdates = false;
        this._batchTimeout = null;
        this._isProcessingUpdates = false;
    }
    scheduleUpdate(component) {
        if (!this._updateQueue.includes(component)) this._updateQueue.push(component);
        if (!this._isBatchingUpdates) {
            this._isBatchingUpdates = true;
            this._batchTimeout = setTimeout(() => this._processBatchedUpdates(), 0);
        }
    }
    _processBatchedUpdates() {
        if (this._isProcessingUpdates) return;
        this._isProcessingUpdates = true;
        this._isBatchingUpdates = false;
        clearTimeout(this._batchTimeout);
        try {
            const components = [...this._updateQueue];
            this._updateQueue = [];
            for (const component of components) this._updateComponent(component);
            this._flushEffects();
        } finally {
            this._isProcessingUpdates = false;
            if (this._updateQueue.length > 0) {
                this._isBatchingUpdates = true;
                this._batchTimeout = setTimeout(() => this._processBatchedUpdates(), 0);
            }
        }
    }
    _flushEffects() {
        const effectsToRun = [...this._effectQueue];
        this._effectQueue = [];

        for (const effect of effectsToRun) {
            if (effect.effect && typeof effect.effect === 'function') {
                try {
                    effect.effect();
                } catch (error) {
                    console.error('Error en efecto:', error);
                }
            }
        }
    }
    scheduleEffect(effect) {
        this._effectQueue.push({ effect });
    }
    _updateComponent(component) {
        if (!component._isMounted) return;
        component._renderInProgress = true;
        try {
            let newVNode;
            if (component instanceof Component) {
                component._commitState();
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
            throw new Error('Error updating component:', error);
        } finally {
            component._renderInProgress = false;
        }
    }
    mount(vnode, container) {
        try {
            container.innerHTML = '';
            const domNode = vnode.render();
            if (domNode) {
                container.appendChild(domNode);
                this._executeComponentDidMount(vnode);
                this._flushEffects();
            }
            return domNode;
        } catch (error) {
            console.error('Mount error:', error);
            container.innerHTML = `<div style="color: red; padding: 10px; border: 1px solid red;">
                Error al montar componente: ${error.message}</div>`;
            return null;
        }
    }
    _executeComponentDidMount(vnode) {
        if (typeof vnode.type === 'function' &&
            (vnode.type.prototype instanceof Component ||
                (vnode.type.prototype && vnode.type.prototype.isComponent))) {
            const element = document.querySelector(`[data-component-id="${vnode.props.key || ''}"]`);
            if (element && element._componentInstance) {
                const instance = element._componentInstance;
                if (typeof instance.componentDidMount === 'function') instance.componentDidMount();
            }
        }
        for (const child of vnode.children || []) this._executeComponentDidMount(child);
    }
    _reconcile(parent, domNode, newVNode, ownerComponent) {
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
        if (typeof newVNode.type === 'function') return this._reconcileComponent(parent, domNode, newVNode, ownerComponent);
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
    }
    _reconcileComponent(parent, domNode, newVNode, parentComponent) {
        const ComponentClass = newVNode.type;
        if (domNode._ownerComponent &&
            ((domNode._ownerComponent instanceof Component &&
                domNode._ownerComponent.constructor === ComponentClass) ||
                (domNode._ownerComponent._currentVNode &&
                    domNode._ownerComponent._currentVNode.type === ComponentClass))) {
            const instance = domNode._ownerComponent;
            const oldProps = { ...instance.props };
            instance.props = { ...newVNode.props, children: newVNode.children };
            try {
                let renderedVNode;
                if (instance instanceof Component) {
                    renderedVNode = instance.render();
                } else {
                    instance._currentVNode = newVNode;
                    HooksContext.setCurrentComponent(instance);
                    renderedVNode = instance.render();
                    HooksContext.setCurrentComponent(null);
                }
                if (!renderedVNode) return domNode;
                const updatedNode = this._reconcile(parent, domNode, renderedVNode, instance);
                if (instance instanceof Component && typeof instance.componentDidUpdate === 'function') {
                    instance.componentDidUpdate(oldProps, instance._prevState || {});
                }
                return updatedNode;
            } catch (error) {
                console.error('Component reconciliation error:', error);
                return domNode;
            }
        } else {
            try {
                this._unmountComponentAtNode(domNode);
                const newNode = newVNode.render(parentComponent);
                if (parent && newNode) parent.replaceChild(newNode, domNode);
                return newNode;
            } catch (error) {
                console.error('Component replacement error:', error);
                return domNode;
            }
        }
    }
    _reconcileChildren(domNode, oldChildren = [], newChildren = []) {
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
                if (existingChild &&
                    (existingChild.vnode && newChild && existingChild.vnode.type === newChild.type)) {
                    const updatedNode = this._reconcile(domNode, existingChild.domNode, newChild);
                    if (existingChild.index < lastIndex) domNode.appendChild(updatedNode);
                    else lastIndex = existingChild.index;
                    newDomNodes[i] = updatedNode;
                    delete existingChildren[key];
                } else {
                    const newNode = newChild.render();
                    newDomNodes[i] = newNode;
                    if (i >= domChildNodes.length) domNode.appendChild(newNode);
                    else domNode.insertBefore(newNode, domChildNodes[i]);
                }
            }
            for (const key in existingChildren) {
                const childToRemove = existingChildren[key];
                this._unmountComponentAtNode(childToRemove.domNode);
                domNode.removeChild(childToRemove.domNode);
            }
        } catch (error) {
            throw new Error('Error reconciling children:', error);
        }
    }
    _updateProps(domNode, oldProps = {}, newProps = {}) {
        try {
            for (const key in oldProps) {
                if (!(key in newProps) && key !== 'children') {
                    if (key.startsWith('on')) EventSystem.registerEvent(domNode, key.slice(2).toLowerCase(), key, null);
                    else if (key === 'style') domNode.style = '';
                    else if (key === 'className') domNode.removeAttribute('class');
                    else domNode.removeAttribute(key);
                }
            }
            for (const key in newProps) {
                if (key !== 'children' && key !== 'key' && oldProps[key] !== newProps[key]) {
                    if (key.startsWith('on') && typeof newProps[key] === 'function')
                        EventSystem.registerEvent(domNode, key.slice(2).toLowerCase(), key, newProps[key]);
                    else if (key === 'style' && typeof newProps[key] === 'object')
                        this._updateStyles(domNode.style, oldProps.style || {}, newProps.style);
                    else if (key === 'className') domNode.setAttribute('class', newProps[key]);
                    else if (typeof newProps[key] === 'boolean') {
                        if (newProps[key]) domNode.setAttribute(key, '');
                        else domNode.removeAttribute(key);
                    } else if (key !== 'ref') domNode.setAttribute(key, newProps[key]);
                }
            }
            this._updateRefs(domNode, oldProps.ref, newProps.ref);
        } catch (error) {
            throw new Error('Error updating props:', error);
        }
    }
    _updateStyles(domStyle, oldStyles = {}, newStyles = {}) {
        for (const key in oldStyles) if (!(key in newStyles)) domStyle[key] = '';
        for (const key in newStyles) if (oldStyles[key] !== newStyles[key]) domStyle[key] = newStyles[key];
    }
    _updateRefs(domNode, oldRef, newRef) {
        if (oldRef && oldRef !== newRef) {
            if (typeof oldRef === 'function') oldRef(null);
            else if (oldRef.current) oldRef.current = null;
        }
        if (newRef && oldRef !== newRef) {
            if (typeof newRef === 'function') newRef(domNode);
            else newRef.current = domNode;
        }
    }
    _unmountComponentAtNode(domNode) {
        try {
            if (!domNode) return;
            if (domNode._ownerComponent) {
                const instance = domNode._ownerComponent;
                if (instance instanceof Component && typeof instance.componentWillUnmount === 'function')
                    instance.componentWillUnmount();
                instance._isMounted = false;
            }
            EventSystem.removeAllHandlers(domNode);
            for (let i = 0; i < domNode.childNodes.length; i++) this._unmountComponentAtNode(domNode.childNodes[i]);
        } catch (error) {
            throw new Error('Error unmounting component:', error);
        }
    }
}
class HooksManager {
    constructor() {
        this.currentComponent = null;
        this.hookIndex = 0;
    }
    setCurrentComponent(component) {
        this.currentComponent = component;
        this.hookIndex = 0;
    }
}
class Hooks {
    static useState(initialState) {
        const component = HooksContext.currentComponent;
        if (!component) throw new Error('Hooks solo pueden ser llamados dentro de componentes funcionales');
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
            const nextState = typeof newState === 'function' ? newState(hook.state) : newState;
            if (nextState !== hook.state) {
                hook.state = nextState;
                if (component._isMounted) ReconciliationManager.scheduleUpdate(component);
            }
        };
        return [hook.state, setState];
    }
    static useEffect(effect, deps) {
        const component = HooksContext.currentComponent;
        if (!component) throw new Error('Hooks solo pueden ser llamados dentro de componentes funcionales');
        const hookIndex = HooksContext.hookIndex++;
        if (!component._hooks) component._hooks = [];
        let shouldRun = false;
        let hook;
        if (hookIndex >= component._hooks.length) {
            // First time this hook is called
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
                if (typeof hook.cleanup === 'function') {
                    hook.cleanup();
                }
                const cleanup = effect();
                hook.cleanup = typeof cleanup === 'function' ? cleanup : null;
            };
            // Always schedule effects
            ReconciliationManager.scheduleEffect(effectFunction);
        }
    }
    static useReducer(reducer, initialState, init) {
        const component = HooksContext.currentComponent;
        if (!component) throw new Error('Hooks solo pueden ser llamados dentro de componentes funcionales');
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
            const nextState = hook.reducer(hook.state, action);
            if (nextState !== hook.state) {
                hook.state = nextState;
                if (component._isMounted) ReconciliationManager.scheduleUpdate(component);
            }
        };
        return [hook.state, dispatch];
    }
    static useRef(initialValue) {
        const component = HooksContext.currentComponent;
        if (!component) throw new Error('Hooks solo pueden ser llamados dentro de componentes funcionales');
        const hookIndex = HooksContext.hookIndex++;
        if (!component._hooks) component._hooks = [];
        if (hookIndex >= component._hooks.length) component._hooks[hookIndex] = { type: 'ref', current: initialValue };
        return component._hooks[hookIndex];
    }
    static useMemo(factory, deps) {
        const component = HooksContext.currentComponent;
        if (!component) throw new Error('Hooks solo pueden ser llamados dentro de componentes funcionales');
        const hookIndex = HooksContext.hookIndex++;
        if (!component._hooks) component._hooks = [];
        let hook;
        if (hookIndex >= component._hooks.length) {
            hook = { type: 'memo', value: factory(), deps: deps || null, factory: factory };
            component._hooks[hookIndex] = hook;
        } else {
            hook = component._hooks[hookIndex];
            const depsChanged = !deps || !hook.deps || deps.length !== hook.deps.length ||
                deps.some((dep, i) => dep !== hook.deps[i]);
            if (depsChanged) {
                hook.deps = deps || null;
                hook.value = factory();
                hook.factory = factory;
            }
        }
        return hook.value;
    }
    static useCallback(callback, deps) { return this.useMemo(() => callback, deps); }
}

class ElementFactory {
    createElement(type, props = {}, ...children) { return new VirtualElement(type, props, ...children); }
    createTextElement(text) { return new TextElement(text); }
    createFragment(children) { return new VirtualElement(Symbol.for('littedom.fragment'), {}, ...children); }
    createPortal(children, container) {
        const portalElement = new VirtualElement(Symbol.for('littedom.portal'), {});
        portalElement.children = Array.isArray(children) ? children : [children];
        portalElement.containerInfo = container;
        return portalElement;
    }
}

class LitteDOMAPI {
    constructor() { this.factory = new ElementFactory(); }
    createElement(type, props = {}, ...children) { return this.factory.createElement(type, props, ...children); }
    render(element, container) {
        console.log(element)
        if (!EventSystem._initialized) EventSystem.init();
        try {
            if (!(element instanceof VirtualElement)) {
                element = this.factory.createElement(element, {}, []);
            }
            const domNode = ReconciliationManager.mount(element, container);
            container._rootDOMNode = domNode;
            return domNode;
        } catch (error) {
            console.error('Render error:', error);
            container.innerHTML = `<div style="color: red; padding: 10px; border: 1px solid red;">
                Error al renderizar: ${error.message}</div>`;
            return null;
        }
    }
    unmountComponentAtNode(container) {
        if (container._rootDOMNode) {
            ReconciliationManager._unmountComponentAtNode(container._rootDOMNode);
            container.innerHTML = '';
            container._rootDOMNode = null;
            return true;
        }
        return false;
    }
    findDOMNode(component) { return component._currentDOMNode || null; }
    createPortal(children, container) {
        const portalElement = this.factory.createPortal(children, container);
        ReconciliationManager.mount(children, container);
        return portalElement;
    }
    createRoot(container = 'root') {
        if (!(container instanceof HTMLElement)) {
            const containerId = container?.id || container;
            container = document.getElementById(containerId) || document.createElement('div');
            if (!container.id) container.id = containerId;
        }
        return {
            render: (element) => {
                this.render(element, container);
                document.body.appendChild(container);
            },
            unmount: () => this.unmountComponentAtNode(container)
        };
    }
}

// ==================== SINGLETONS ====================
const EventSystem = new EventManager();
const ReconciliationManager = new VirtualDOMReconciliation();
const HooksContext = new HooksManager();
const LitteDOM = new LitteDOMAPI();

// ==================== EXPORTS ====================
// Hooks
export const useState = Hooks.useState;
export const useEffect = Hooks.useEffect;
export const useReducer = Hooks.useReducer;
export const useRef = Hooks.useRef;
export const useMemo = Hooks.useMemo;
export const useCallback = Hooks.useCallback;

// DOM
export function createElement(type, props = {}, ...children) {
    return LitteDOM.createElement(type, props, ...children);
}

//  Default export
export default LitteDOM;