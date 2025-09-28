# clanker

so basically this is a terminal tui application to multiplex a bunch of clankers (e.g. claude code and codex. starting with claude code)

the architecture is a solid+opentui thing to actually run the tui on the 'frontend'. this communicates with the 'backend' via the capnweb RPC protocol. the backend is a bun server that is communicating with the frontend thru JSONL. we're using this decoupling because the clankers (e.g. the claude codes) can maybe be running on a different computer, and the communication method might be happening over ssh.

here is the functionality:
Clanker is a local-first TUI (in src/index.tsx) that orchestrates many parallel coding tasks on a remote or local machine via a simple JSON-over-stdio protocol (wrapped over SSH when remote). The daemon on the host clones the project into ~/.clanker/projects/{name}/repo, creates one git worktree per task (branch refs/heads/clanker/task-{id}), and updates an advertised read-only ref refs/clanker/tasks/{id} on every commit or auto-commit. The TUI shows a Kanban of tasks (Not Started, Running, Done, Failed), streams structured events/logs from the daemon, and focuses first on integrating Claude Code using its JSON event output (not embedding external TUIs). For code review on the Mac, the client performs on-demand git fetch directly from a URL without adding a remote, e.g., git fetch ssh://user@host/abs/path '+refs/clanker/tasks/:refs/remotes/clanker/tasks/', and then checks out a task in detached mode for viewing. Local mode uses the same protocol over stdio and fetches via file:///abs/path to avoid SSH, keeping the user’s repo and config untouched. No GitHub push/pull is required; synchronization is point-to-point from the daemon’s repo using Git’s native protocol, with optional bundle fallback only for demos. The scope stays lean: one remote, minimal events (Started, LogLine, TaskUpdated), simple presets, hard reset for review checkouts, and no extra directories unless the user wants a local worktree.

its set up with the daemon running rust code (src/main.rs) that listens to a unix socket. we use a thin wrapper over this for the ssh case.

# OpenTUI Solid: Complete Developer Guide

OpenTUI's SolidJS bindings provide a reactive terminal UI framework that leverages SolidJS's fine-grained reactivity for building high-performance CLI applications. Here's a comprehensive overview:

## Architecture & Core Concepts

### Rendering System

OpenTUI Solid uses a custom renderer that translates SolidJS components into terminal renderables. The system operates through:

```tsx
import { render } from "@opentui/solid";

// Entry point - renders your app to the terminal
const App = () => <text>Hello World</text>;

render(App, {
  targetFps: 30,
  consoleOptions: {
    position: ConsolePosition.BOTTOM,
    maxStoredLogs: 1000,
    sizePercent: 40,
  },
});
```

### Reactive State Management

State lives in SolidJS signals with fine-grained reactivity. The renderer automatically updates the terminal when signals change:

```tsx
import { createSignal, createEffect } from "solid-js";

const [count, setCount] = createSignal(0);

createEffect(() => {
  const timer = setInterval(() => setCount((c) => c + 1), 1000);
  onCleanup(() => clearInterval(timer));
});

return <text content={`Counter: ${count()}`} />;
```

### Context System

OpenTUI provides a `RendererContext` that gives access to the renderer throughout your component tree:

```tsx
import { useRenderer, useKeyboard } from "@opentui/solid";

const renderer = useRenderer();

useKeyboard((key) => {
  if (key.name === "q") process.exit();
  if (key.name === "`") renderer.console.toggle();
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
  Welcome to <b style={{ fg: "yellow" }}>OpenTUI</b>!
  <br />
  <i style={{ fg: "cyan" }}>Build amazing terminal apps</i>
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

**Important: Border Syntax for OpenTUI Solid**

In OpenTUI Solid, you must include both `borderStyle` and `border` prop to display borders:

```tsx
<box
  borderStyle="single"
  borderColor="#FFFFFF"
  border  // Required prop for borders to show
>
  <text>Content with border</text>
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
- `position`: "relative" | "absolute" for positioning
- `zIndex`: stacking order for overlapping elements

### 3. Input Component

Interactive text input with event handling and ref support:

```tsx
const [value, setValue] = createSignal("")
let inputRef: InputRenderable | null = null

<input
  ref={r => inputRef = r}
  placeholder="Enter text..."
  focused
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

Dropdown/list selection component with rich styling:

```tsx
const options = [
  { name: 'Option 1', description: 'First option', value: 'opt1' },
  { name: 'Option 2', description: 'Second option', value: 'opt2' },
  { name: 'Option 3', description: 'Third option', value: 'opt3' }
]

<select
  options={options}
  focused
  selectedIndex={selectedIndex()}
  onSelect={(index, option) => {
    setSelectedIndex(index)
    console.log('Selected:', option)
  }}
  style={{
    height: 10,
    backgroundColor: "transparent",
    focusedBackgroundColor: "transparent",
    selectedBackgroundColor: "#334455",
    selectedTextColor: "#FFFF00",
    descriptionColor: "#888888"
  }}
  showScrollIndicator
  wrapSelection
  fastScrollStep={5}
/>
```

### 5. ScrollBox Component

Scrollable container for large content with extensive styling options:

```tsx
<scrollbox
  focused
  stickyScroll={true}
  stickyStart="bottom"
  style={{
    height: 20,
    width: "100%",
    flexGrow: 1,
    rootOptions: {
      backgroundColor: "#24283b",
      border: true,
    },
    wrapperOptions: {
      backgroundColor: "#1f2335",
    },
    viewportOptions: {
      backgroundColor: "#1a1b26",
    },
    contentOptions: {
      backgroundColor: "#16161e",
    },
    scrollbarOptions: {
      showArrows: true,
      trackOptions: {
        foregroundColor: "#7aa2f7",
        backgroundColor: "#414868",
      },
    },
  }}
>
  <For each={items()}>
    {(item) => (
      <box style={{ width: "100%", padding: 1 }}>
        <text content={`Item ${item.id}`} />
      </box>
    )}
  </For>
</scrollbox>
```

### 6. TabSelect Component

Tabbed navigation interface:

```tsx
const tabs = [
  { name: 'Tab 1', value: 'tab1' },
  { name: 'Tab 2', value: 'tab2' },
  { name: 'Tab 3', value: 'tab3' }
]

<tab_select
  options={tabs}
  focused
  selectedIndex={activeTab()}
  onChange={(index, tab) => setActiveTab(index)}
/>
```

### 7. ASCII Font Component

Large text rendering using ASCII fonts:

```tsx
import { measureText } from "@opentui/core"

const titleText = "OPENTUI"
const titleFont = "tiny"
const { width: titleWidth, height: titleHeight } = measureText({
  text: titleText,
  font: titleFont
})

<ascii_font
  text={titleText}
  style={{
    width: titleWidth,
    height: titleHeight,
    font: titleFont,
    fg: "#00FF00"
  }}
/>
```

## SolidJS-Specific Features

### Signals & Reactivity

OpenTUI Solid leverages SolidJS's fine-grained reactivity:

```tsx
import { createSignal, createMemo, createEffect } from "solid-js";

const [input, setInput] = createSignal("");
const processedInput = createMemo(() => input().toUpperCase());

createEffect(() => {
  console.log("Input changed:", processedInput());
});

return (
  <box>
    <input onInput={setInput} />
    <text content={processedInput()} />
  </box>
);
```

### Control Flow Components

Use SolidJS control flow with terminal components:

```tsx
import { Show, For, Index, Switch, Match } from "solid-js"

// Conditional rendering
<Show when={showModal()}>
  <box style={{ position: "absolute", backgroundColor: "#1a1a1a" }}>
    <text>Modal Content</text>
  </box>
</Show>

// List rendering with object arrays
<For each={items()}>
  {(item) => <text content={item.name} />}
</For>

// List rendering with primitive arrays (more efficient)
<Index each={numbers()}>
  {(num) => <text content={`Number: ${num()}`} />}
</Index>

// Switch/Match for multiple conditions
<Switch>
  <Match when={view() === "home"}>
    <HomeView />
  </Match>
  <Match when={view() === "settings"}>
    <SettingsView />
  </Match>
</Switch>
```

### Refs & DOM Access

Access underlying renderables with refs:

```tsx
import type { InputRenderable, BoxRenderable } from "@opentui/core";

let inputRef: InputRenderable | null = null;
let boxRef: BoxRenderable | null = null;

const handleAction = () => {
  inputRef?.insertText("Hello");
  boxRef?.requestRender();
};

return (
  <box ref={(r) => (boxRef = r)}>
    <input ref={(r) => (inputRef = r)} />
  </box>
);
```

## Hooks & Event Handling

### Keyboard Events

Handle global keyboard events with the `useKeyboard` hook:

```tsx
import { useKeyboard } from "@opentui/solid";

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

  // Raw key sequences
  if (key.raw === "\u0003") {
    // Ctrl+C
    process.exit();
  }
});
```

**Key Event Properties:**

- `name`: string - Key name ("tab", "enter", "space", etc.)
- `ctrl`, `alt`, `shift`, `meta`: boolean - Modifier keys
- `sequence`: string - Key sequence
- `raw`: string - Raw key data

### Paste Events

Handle clipboard paste events:

```tsx
import { usePaste } from "@opentui/solid";

usePaste((event) => {
  inputRef?.insertText(event.text);
});
```

### Terminal Dimensions

React to terminal size changes:

```tsx
import { useTerminalDimensions } from "@opentui/solid";

const terminalDimensions = useTerminalDimensions();

return (
  <box
    style={{
      width: terminalDimensions().width - 2,
      height: terminalDimensions().height - 2,
    }}
  >
    <text
      content={`Terminal: ${terminalDimensions().width}x${terminalDimensions().height}`}
    />
  </box>
);
```

### Resize Events

Listen for terminal resize events:

```tsx
import { onResize } from "@opentui/solid";

onResize((width, height) => {
  console.log(`Terminal resized to: ${width}x${height}`);
});
```

### Renderer Access

Access the underlying renderer for advanced operations:

```tsx
const renderer = useRenderer();

// Toggle debug overlay
renderer.toggleDebugOverlay();

// Access console
renderer.console.toggle();
renderer.console.show();

// Set background color
renderer.setBackgroundColor("#001122");

// Debug utilities
renderer.dumpHitGrid();
```

### Selection Events

Handle text selection events:

```tsx
import { useSelectionHandler } from "@opentui/solid";

useSelectionHandler((selection) => {
  console.log("Text selected:", selection);
});
```

### Timeline & Animation

Create animations with the timeline system:

```tsx
import { useTimeline } from "@opentui/solid";

const [animatedValues, setAnimatedValues] = createSignal({
  cpu: 0,
  memory: 0,
  network: 0,
});

const timeline = useTimeline({
  duration: 8000,
  loop: false,
  autoplay: true,
});

timeline.add(
  animatedValues(),
  {
    cpu: 85,
    memory: 70,
    network: 95,
    duration: 3000,
    ease: "inOutQuad",
    onUpdate(values) {
      setAnimatedValues({ ...values.targets[0] });
    },
  },
  0,
);

return (
  <box>
    <text content={`CPU: ${animatedValues().cpu}%`} />
    <text content={`Memory: ${animatedValues().memory}%`} />
  </box>
);
```

## Styling System

### Style Prop Architecture

Components accept a `style` prop that automatically excludes non-visual properties:

```tsx
<input
  placeholder="Username" // Component prop
  onInput={handleInput} // Event handler
  style={{
    // Only visual/layout properties go here
    backgroundColor: "#000000",
    padding: 1,
    border: true,
    focusedBackgroundColor: "#FFFFFF",
  }}
/>
```

### Color System

Colors can be specified as:

- Named colors: `"red"`, `"blue"`, `"green"`
- Bright colors: `"brightRed"`, `"brightGreen"`
- Hex codes: `"#FF0000"`, `"#00FF00"`
- RGB objects: `{ r: 255, g: 0, b: 0, a: 1 }`

### Advanced Layout

OpenTUI Solid supports advanced positioning:

```tsx
<box style={{ position: "relative" }}>
  <box
    style={{
      position: "absolute",
      left: 10,
      top: 5,
      width: 20,
      height: 10,
      zIndex: 2,
    }}
  >
    <text>Positioned element</text>
  </box>
</box>
```

## Component Extension System

### Creating Custom Components

Extend OpenTUI with custom renderables:

```tsx
import { extend } from "@opentui/solid";
import { MyCustomRenderable } from "./MyCustomRenderable";

// Register custom component
extend({
  "my-custom": MyCustomRenderable,
});

// TypeScript augmentation
declare module "@opentui/solid" {
  namespace JSX {
    interface IntrinsicElements {
      "my-custom": {
        customProp?: string;
        style?: any;
      };
    }
  }
}

// Usage
<my-custom customProp="value" />;
```

## Application Patterns

### App Structure

Typical OpenTUI Solid app structure:

```tsx
import { render, useKeyboard } from "@opentui/solid";
import { createSignal, Switch, Match } from "solid-js";

const App = () => {
  // Reactive state
  const [currentView, setCurrentView] = createSignal("main");
  const [data, setData] = createSignal([]);

  // Global keyboard handling
  useKeyboard((key) => {
    if (key.name === "q") process.exit();
    if (key.name === "h") setCurrentView("help");
  });

  // Reactive rendering
  return (
    <box style={{ padding: 1, flexDirection: "column" }}>
      <Header />
      <Switch>
        <Match when={currentView() === "main"}>
          <MainView data={data()} />
        </Match>
        <Match when={currentView() === "help"}>
          <HelpView />
        </Match>
      </Switch>
      <Footer />
    </box>
  );
};

render(App);
```

### Modal/Dialog Pattern

```tsx
const [showModal, setShowModal] = createSignal(false);

useKeyboard((key) => {
  if (key.name === "escape" && showModal()) {
    setShowModal(false);
  }
});

return (
  <>
    <MainContent />
    <Show when={showModal()}>
      <box
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "#1a1a1a",
          border: true,
          padding: 2,
          zIndex: 10,
        }}
      >
        <text content="Modal Content" />
      </box>
    </Show>
  </>
);
```

### Form Handling Pattern

```tsx
const LoginForm = () => {
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [focused, setFocused] = createSignal<"username" | "password">(
    "username",
  );

  const handleSubmit = () => {
    console.log("Login:", { username: username(), password: password() });
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
          value={username()}
          focused={focused() === "username"}
          onInput={setUsername}
          onSubmit={handleSubmit}
        />
      </box>

      <box title="Password" style={{ border: true }}>
        <input
          value={password()}
          focused={focused() === "password"}
          onInput={setPassword}
          onSubmit={handleSubmit}
        />
      </box>
    </box>
  );
};
```

### Performance Patterns

```tsx
// Use Index for primitive arrays (more efficient)
<Index each={numbers()}>
  {(num, index) => (
    <text content={`${index()}: ${num()}`} />
  )}
</Index>

// Use For for object arrays
<For each={users()}>
  {(user) => (
    <box key={user.id}>
      <text content={user.name} />
    </box>
  )}
</For>

// Use createMemo for expensive computations
const filteredItems = createMemo(() =>
  items().filter(item => item.name.includes(searchTerm()))
)
```

## Testing Support

### Test Rendering

OpenTUI Solid provides test rendering utilities:

```tsx
import { testRender } from "@opentui/solid";

const testSetup = await testRender(() => <MyComponent />, {
  width: 80,
  height: 24,
});

// Access test renderer
const { renderer, buffer } = testSetup;

// Perform assertions
expect(buffer.toString()).toContain("Expected text");
```

## Performance Considerations

### Efficient Reactivity

- Use `createMemo` for expensive computations
- Batch updates with `batch()` when needed
- Use `untrack()` to prevent unnecessary reactivity

### Memory Management

- Cleanup is automatic with SolidJS lifecycle
- Use `onCleanup()` for manual cleanup
- Refs are automatically cleaned up

### Rendering Optimization

- Use `Index` instead of `For` for primitive arrays
- Minimize style object recreation
- Use signals for fine-grained updates

OpenTUI Solid provides a complete framework for building sophisticated terminal applications with SolidJS's reactive patterns, rich styling capabilities, and robust event handling systems.
