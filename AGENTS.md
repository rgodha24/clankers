# clanker

so basically this is a terminal tui application to multiplex a bunch of clankers (e.g. claude code and codex. starting with claude code)

the architecture is a react+opentui thing to actually run the tui on the 'frontend'. this communicates with the 'backend' via the capnweb RPC protocol. the backend is a bun server that is communicating with the frontend thru JSONL. we're using this decoupling because the clankers (e.g. the claude codes) can maybe be running on a different computer, and the communication method might be happening over ssh.

here is the functionality:
Clanker is a local-first TUI that orchestrates many parallel coding tasks on a remote or local machine via a simple JSON-over-stdio protocol (wrapped over SSH when remote). The daemon on the host clones the project into ~/.clanker/projects/{name}/repo, creates one git worktree per task (branch refs/heads/clanker/task-{id}), and updates an advertised read-only ref refs/clanker/tasks/{id} on every commit or auto-commit. The TUI shows a Kanban of tasks (Not Started, Running, Done, Failed), streams structured events/logs from the daemon, and focuses first on integrating Claude Code using its JSON event output (not embedding external TUIs). For code review on the Mac, the client performs on-demand git fetch directly from a URL without adding a remote, e.g., git fetch ssh://user@host/abs/path '+refs/clanker/tasks/:refs/remotes/clanker/tasks/', and then checks out a task in detached mode for viewing. Local mode uses the same protocol over stdio and fetches via file:///abs/path to avoid SSH, keeping the user’s repo and config untouched. No GitHub push/pull is required; synchronization is point-to-point from the daemon’s repo using Git’s native protocol, with optional bundle fallback only for demos. The scope stays lean: one remote, minimal events (Started, LogLine, TaskUpdated), simple presets, hard reset for review checkouts, and no extra directories unless the user wants a local worktree.

# OpenTUI React: Complete Developer Guide

OpenTUI's React bindings provide a powerful terminal UI framework that leverages React's component model for building sophisticated CLI applications. Here's a comprehensive overview:

## Architecture & Core Concepts

### Rendering System

OpenTUI uses a custom React reconciler that translates React components into terminal renderables. The system operates through:

```tsx
import { render } from "@opentui/react";

// Entry point - renders your app to the terminal
render(<App />);
```

### State Management

State lives in standard React components using hooks like `useState` and `useEffect`. The renderer automatically updates the terminal when state changes:

```tsx
const [count, setCount] = useState(0);

useEffect(() => {
  const timer = setInterval(() => setCount((c) => c + 1), 1000);
  return () => clearInterval(timer);
}, []);

return <text content={`Counter: ${count}`} />;
```

### Context System

OpenTUI provides an `AppContext` that gives access to the renderer and keyboard handler:

```tsx
// Access renderer and keyboard handler globally
const { renderer, keyHandler } = useAppContext();

// Or use the convenience hooks
const renderer = useRenderer();
useKeyboard((key) => {
  if (key.name === "q") process.exit();
});
```

## Built-in Components

### 1. Text Component

The foundation for all text display with rich formatting support:

```tsx
// Basic text
<text content="Hello World" />

// Styled text with colors and attributes
<text
  content="Styled Text"
  style={{
    fg: "#FF0000",
    bg: "#000000",
    attributes: TextAttributes.BOLD | TextAttributes.ITALIC
  }}
/>

// Rich text with nested formatting
<text>
  Welcome to <b fg="yellow">OpenTUI</b>!
  <br />
  <i fg="cyan">Build amazing terminal apps</i>
</text>
```

**Text Modifiers:**

- `<span>` - Generic text span with styling
- `<b>`, `<strong>` - Bold text
- `<i>`, `<em>` - Italic text
- `<u>` - Underlined text
- `<br />` - Line break

### 2. Box Component

Container component with flexbox-style layout and borders:

```tsx
<box
  title="My Container"
  style={{
    border: true,
    borderColor: "#FFFFFF",
    backgroundColor: "#1a1a1a",
    padding: 2,
    margin: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 10,
  }}
>
  <text content="Centered content" />
</box>
```

**Layout Properties:**

- `flexDirection`: "row" | "column" | "row-reverse" | "column-reverse"
- `alignItems`: "stretch" | "flex-start" | "flex-end" | "center"
- `justifyContent`: "flex-start" | "flex-end" | "center" | "space-between" | "space-around"
- `padding`, `margin`: number or object with top/right/bottom/left
- `width`, `height`: number or percentage string
- `border`: boolean or specific sides array
- `gap`, `rowGap`, `columnGap`: spacing between children

### 3. Input Component

Interactive text input with event handling:

```tsx
const [value, setValue] = useState("")
const [focused, setFocused] = useState(false)

<input
  placeholder="Enter text..."
  value={value}
  focused={focused}
  onInput={setValue}
  onSubmit={(val) => console.log('Submitted:', val)}
  onChange={(val) => console.log('Changed:', val)}
  style={{
    focusedBackgroundColor: "#000000",
    focusedForegroundColor: "#FFFFFF"
  }}
/>
```

### 4. Select Component

Dropdown/list selection component:

```tsx
const options = [
  { value: 'opt1', label: 'Option 1' },
  { value: 'opt2', label: 'Option 2' },
  { value: 'opt3', label: 'Option 3' }
]

<select
  options={options}
  focused={focused}
  selectedIndex={selectedIndex}
  onChange={(index, option) => {
    setSelectedIndex(index)
    console.log('Selected:', option)
  }}
/>
```

### 5. ScrollBox Component

Scrollable container for large content:

```tsx
<scrollbox
  focused={focused}
  style={{
    height: 20,
    rootOptions: { backgroundColor: "#1a1a1a" },
    scrollbarOptions: {
      showArrows: true,
      trackOptions: {
        foregroundColor: "#7aa2f7",
        backgroundColor: "#414868",
      },
    },
  }}
>
  {Array.from({ length: 100 }).map((_, i) => (
    <box key={i}>
      <text content={`Item ${i}`} />
    </box>
  ))}
</scrollbox>
```

### 6. TabSelect Component

Tabbed navigation interface:

```tsx
const tabs = [
  { value: 'tab1', label: 'Tab 1' },
  { value: 'tab2', label: 'Tab 2' },
  { value: 'tab3', label: 'Tab 3' }
]

<tab-select
  options={tabs}
  focused={focused}
  selectedIndex={activeTab}
  onChange={(index, tab) => setActiveTab(index)}
/>
```

### 7. ASCII Font Component

Large text rendering using ASCII fonts:

```tsx
<ascii-font
  text="HELLO"
  selectable={false}
  style={{
    fg: "#00FF00",
    font: "big", // or other available fonts
  }}
/>
```

## Styling System

### Style Prop Architecture

Components accept a `style` prop that automatically excludes non-visual properties:

```tsx
// These properties are automatically excluded from style:
// - Event handlers (onInput, onChange, etc.)
// - Component-specific props (placeholder, value, etc.)
// - React props (key, ref, children)

<input
  placeholder="Username" // Component prop
  onInput={handleInput} // Event handler
  style={{
    // Only visual/layout properties go here
    backgroundColor: "#000000",
    padding: 1,
    border: true,
  }}
/>
```

### Color System

Colors can be specified as:

- Named colors: `"red"`, `"blue"`, `"green"`
- Bright colors: `"brightRed"`, `"brightGreen"`
- Hex codes: `"#FF0000"`, `"#00FF00"`
- RGB objects: `{ r: 255, g: 0, b: 0, a: 1 }`

### Text Attributes

Use bitwise operations to combine text attributes:

```tsx
import { TextAttributes } from "@opentui/core";
<text
  content="Styled text"
  style={{
    attributes:
      TextAttributes.BOLD | TextAttributes.ITALIC | TextAttributes.UNDERLINE,
  }}
/>;
```

## Hooks & Event Handling

### Keyboard Events

Handle global keyboard events with the `useKeyboard` hook:

```tsx
import { useKeyboard } from "@opentui/react";

useKeyboard((key) => {
  // Global keyboard handler
  if (key.name === "tab") {
    cycleFocus();
  }

  if (key.ctrl && key.name === "c") {
    process.exit();
  }

  if (key.name === "escape") {
    setShowModal(false);
  }
});
```

**Key Event Properties:**

- `name`: string - Key name ("tab", "enter", "space", etc.)
- `ctrl`, `alt`, `shift`, `meta`: boolean - Modifier keys
- `sequence`: string - Raw key sequence

### Focus Management

Focus is managed manually through component props and state:

```tsx
const [focused, setFocused] = useState<"input1" | "input2">("input1");

useKeyboard((key) => {
  if (key.name === "tab") {
    setFocused((prev) => (prev === "input1" ? "input2" : "input1"));
  }
});

return (
  <>
    <input focused={focused === "input1"} />
    <input focused={focused === "input2"} />
  </>
);
```

### Renderer Access

Access the underlying renderer for advanced operations:

```tsx
const renderer = useRenderer();

// Toggle debug overlay
renderer.toggleDebugOverlay();

// Access console
renderer.console.toggle();

// Force re-render
renderer.requestRender();
```

### Terminal Dimensions

React to terminal size changes:

```tsx
import { useTerminalDimensions } from "@opentui/react";

const { width, height } = useTerminalDimensions();

return (
  <box style={{ width: width - 2, height: height - 2 }}>
    <text content={`Terminal: ${width}x${height}`} />
  </box>
);
```

## Component Extension System

### Creating Custom Components

Extend OpenTUI with custom renderables:

```tsx
import { extend } from "@opentui/react";
import { MyCustomRenderable } from "./MyCustomRenderable";

// Register custom component
extend({
  "my-custom": MyCustomRenderable,
});

// Now usable in JSX
declare module "@opentui/react" {
  interface OpenTUIComponents {
    "my-custom": typeof MyCustomRenderable;
  }
}

// Usage
<my-custom customProp="value" />;
```

## Application Patterns

### App Structure

Typical OpenTUI React app structure:

```tsx
import { render, useKeyboard, useState } from "@opentui/react";

const App = () => {
  // State management
  const [currentView, setCurrentView] = useState("main");
  const [data, setData] = useState([]);

  // Global keyboard handling
  useKeyboard((key) => {
    if (key.name === "q") process.exit();
    if (key.name === "h") setCurrentView("help");
  });

  // Conditional rendering
  return (
    <box style={{ padding: 1, flexDirection: "column" }}>
      <Header />
      {currentView === "main" && <MainView data={data} />}
      {currentView === "help" && <HelpView />}
      <Footer />
    </box>
  );
};

render(<App />);
```

### Modal/Dialog Pattern

```tsx
const [showModal, setShowModal] = useState(false);

useKeyboard((key) => {
  if (key.name === "escape" && showModal) {
    setShowModal(false);
  }
});

return (
  <>
    <MainContent />
    {showModal && (
      <box
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "#1a1a1a",
          border: true,
          padding: 2,
        }}
      >
        <text content="Modal Content" />
      </box>
    )}
  </>
);
```

### Form Handling Pattern

```tsx
const LoginForm = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [focused, setFocused] = useState<"username" | "password">("username");

  const handleSubmit = () => {
    console.log("Login:", { username, password });
  };

  useKeyboard((key) => {
    if (key.name === "tab") {
      setFocused((prev) => (prev === "username" ? "password" : "username"));
    }
  });

  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      <box title="Username" style={{ border: true }}>
        <input
          value={username}
          focused={focused === "username"}
          onInput={setUsername}
          onSubmit={handleSubmit}
        />
      </box>

      <box title="Password" style={{ border: true }}>
        <input
          value={password}
          focused={focused === "password"}
          onInput={setPassword}
          onSubmit={handleSubmit}
        />
      </box>
    </box>
  );
};
```

### List/Table Pattern

```tsx
const DataList = ({ items, selectedIndex, onSelect }) => {
  return (
    <scrollbox focused style={{ height: 20 }}>
      {items.map((item, index) => (
        <box
          key={item.id}
          style={{
            backgroundColor: index === selectedIndex ? "#333" : "transparent",
            padding: 1,
          }}
          onClick={() => onSelect(index)}
        >
          <text content={item.name} />
        </box>
      ))}
    </scrollbox>
  );
};
```

## Performance Considerations

### Efficient Rendering

- Use `key` props for list items to help React's reconciliation
- Minimize state updates that trigger full re-renders
- Use `useMemo` and `useCallback` for expensive computations

### Memory Management

- Clean up intervals/timeouts in `useEffect` cleanup
- Remove event listeners properly
- Avoid creating new objects in render methods

OpenTUI React provides a complete framework for building sophisticated terminal applications with familiar React patterns, rich styling capabilities, and robust event handling systems.
