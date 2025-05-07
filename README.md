# LitteDOM

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)]

A lightweight, optimized object-oriented implementation of a virtual DOM for building user interfaces with a React-like API.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Basic Example](#basic-example)
  - [Components](#components)
  - [Hooks](#hooks)
  - [Server-Side Rendering](#server-side-rendering)
- [API Reference](#api-reference)
- [Performance](#performance)
- [Browser Support](#browser-support)
- [Testing](#testing-with-littest)
- [License](#license)

## Overview

LitteDOM is a compact virtual DOM implementation that follows React's component model and API, but with a significantly smaller footprint. It's perfect for projects where you want React-like development experience without the full size of React.

## Features

- **Lightweight**: Minimal implementation focused on core functionality
- **React-like API**: Familiar API for React developers
- **Virtual DOM**: Efficient rendering through virtual DOM diffing
- **Component Model**: Both class and functional components supported
- **Hooks**: Support for useState, useEffect, useReducer, useRef, useMemo, and useCallback
- **Event System**: Synthetic event system similar to React
- **Fragments & Portals**: Support for fragments and portals
- **SSR Support**: Server-side rendering capabilities (This feature is still in development, but it will be added soon)
- **Testing Framework**: Integración con LitTest para pruebas unitarias y de componentes

## Installation

```bash
git clone https://github.com/mironalex00/LitteDOM.git littedom
cp littedom **your_project_name/lib/littedom**
cd **your_project_name**
```

## Usage

### Basic Example

```javascript
import LitteDOM, { createElement } from "./lib/littedom/littedom.js";
// Create a simple element
const element = createElement(
  "div",
  { className: "container" },
  createElement("h1", null, "Hello, LitteDOM!"),
  createElement("p", null, "A lightweight virtual DOM implementation")
);
//  Render to the DOM
```

### Components

#### Functional Components

```javascript
import LitteDOM, { createElement } from "./lib/littedom/littedom.js";
// Functional component
function Welcome(props) {
  return createElement("h1", null, `Hello, ${props.name}!`);
}
// Render to the DOM
```

#### Class Components

```javascript
import LitteDOM, { createElement, Component } from "./lib/littedom/littedom.js";
// Class component
class Counter extends Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
  }
  increment = () => {
    this.setState((prevState) => ({ count: prevState.count + 1 }));
  };
  render() {
    return createElement(
      "div",
      null,
      createElement("h2", null, `Count: ${this.state.count}`),
      createElement("button", { onClick: this.increment }, "Increment")
    );
  }
}
// Render to the DOM
```

### Hooks

```javascript
import LitteDOM, {
  createElement,
  useState,
  useEffect,
} from "./lib/littedom/littedom.js";
function HookExample() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    document.title = `Count: ${count}`;
    // Cleanup function (optional)
    return () => {
      document.title = "LitteDOM App";
    };
  }, [count]);
  return createElement(
    "div",
    null,
    createElement("h2", null, `Count: ${count}`),
    createElement("button", { onClick: () => setCount(count + 1) }, "Increment")
  );
}
// Render to the DOM
```

### Server-Side Rendering (SSR)

```javascript
import { renderToString } from "LitteDOM/server";
import { createElement } from "LitteDOM";
function App() {
  return createElement(
    "div",
    { className: "app" },
    createElement("h1", null, "Server-Rendered Content"),
    createElement("p", null, "This was rendered on the server!")
  );
}
const html = renderToString(createElement(App));
console.log(html); // Output: <div class="app"><h1>Server-Rendered Content</h1><p>This was rendered on the server!</p></div>
```

### DOM Rendering

You can do two ways to render to the DOM:

1. Provide a container element to render the component.
2. Provide a container element id to render the component. If the container element doesn't exist, it will be created.

```javascript
//  ... Code ...
LitteDOM.render(element, document.getElementById("root"));
```

or

```javascript
//  ... Code ...
LitteDOM.createRoot("<your-id>").render(element);
```

## API Reference

### Core API

- `createElement(type, props, ...children)`: Create a virtual DOM element
- `LittleDOM.render(element, container)`: Render an element to a DOM container
- `LittleDOM.unmountComponentAtNode(container)`: Remove a mounted component
- `LittleDOM.findDOMNode(component)`: Get the DOM node for a component
- `LittleDOM.createRoot(container)`: Create a root for concurrent mode (similar to React 18)
- `LittleDOM.createPortal(children, container)`: Create a portal

### Component API

- `Component`: Base class for creating components
  - `this.props`: Component properties
  - `this.state`: Component state
  - `this.setState(partialState, callback)`: Update state
  - `this.forceUpdate(callback)`: Force a re-render

### Hooks

- `useState(initialState)`: State management hook
- `useEffect(effect, deps)`: Side-effects hook
- `useReducer(reducer, initialState, init)`: State management with a reducer
- `useRef(initialValue)`: Create a mutable reference
- `useMemo(factory, deps)`: Memoized value
- `useCallback(callback, deps)`: Memoized callback

### Server Rendering (Upcoming)

- `renderToString(element)`: Render to an HTML string
- `renderToStaticMarkup(element)`: Render to an HTML string without data attributes

## Performance

LittleDOM is optimized for performance with a focused implementation that prioritizes:

- Minimal memory usage
- Fast diffing algorithm
- Batched updates
- Event delegation

## Browser Support

LittleDOM supports all modern browsers including:

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Testing with LitTest

LittleDOM integrates seamlessly with [LitTest](./lib/littest/), a lightweight testing framework designed specifically for LittleDOM components. This feature is still in development but will be added soon. Any feedback or suggestions are welcome!

### LitTest Features

- **Synchronous and asynchronous tests**: Support for both testing paradigms
- **Visual reporter**: Graphical interface to visualize test results
- **Isolated containers**: Each test runs in an isolated environment
- **Testing utilities**: Tools to simulate events and wait for updates

For more information on how to use LitTest, check the [LitTest documentation](./lib/littest/README.md).

## License

This project is licensed under a proprietary license. All rights reserved. Redistribution, modification, or use without the express permission of the author is prohibited.