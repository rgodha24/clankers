import { RGBA } from "@opentui/core";
import {
  render,
  useRenderer,
  useKeyboard,
  useTerminalDimensions,
} from "@opentui/solid";
import { createSignal, createEffect, For } from "solid-js";
import { createWithSignal } from "solid-zustand";

export type Clanker = {
  id: number;
  title: string;
  status: "running" | "waiting" | "merged";
  contextusage: number;
  cost: number;
  pr_number?: number;
};

export type ClankerHistoryEntry = {
  timestamp: number;
  status: "running" | "waiting" | "merged";
};

// Tokyo Night Color Scheme
const TOKYO_NIGHT = {
  bg: RGBA.fromHex("#222436"),
  bg_dark: RGBA.fromHex("#1e2030"),
  bg_dark1: RGBA.fromHex("#191B29"),
  bg_highlight: RGBA.fromHex("#2f334d"),
  blue: RGBA.fromHex("#82aaff"),
  blue1: RGBA.fromHex("#65bcff"),
  blue2: RGBA.fromHex("#0db9d7"),
  cyan: RGBA.fromHex("#86e1fc"),
  comment: RGBA.fromHex("#636da6"),
  dark3: RGBA.fromHex("#545c7e"),
  dark5: RGBA.fromHex("#737aa2"),
  fg: RGBA.fromHex("#c8d3f5"),
  fg_dark: RGBA.fromHex("#828bb8"),
  fg_gutter: RGBA.fromHex("#3b4261"),
  green: RGBA.fromHex("#c3e88d"),
  green1: RGBA.fromHex("#4fd6be"),
  magenta: RGBA.fromHex("#c099ff"),
  orange: RGBA.fromHex("#ff966c"),
  purple: RGBA.fromHex("#fca7ea"),
  red: RGBA.fromHex("#ff757f"),
  red1: RGBA.fromHex("#c53b53"),
  teal: RGBA.fromHex("#4fd6be"),
  yellow: RGBA.fromHex("#ffc777"),
};

const STATUS_COLORS = {
  merged: TOKYO_NIGHT.green,
  waiting: TOKYO_NIGHT.yellow,
  running: TOKYO_NIGHT.blue,
};
const CLANKER_WIDTH = 40 - 2;

type Message = {};
type Store = {
  chat: Record<number, string>;
  messages: Record<number, Message[]>;
  addMessage: (id: number, message: string) => void;
  updateChat: (id: number, message: string) => void;
};
const chatState = createWithSignal<Store>((set) => ({
  chat: {},
  messages: {},
  updateChat: (id, message) =>
    set((state) => ({ chat: { ...state.chat, [id]: message } })),
  addMessage: (id, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [id]: [...(state.messages[id] || []), message],
      },
    })),
}));

const App = () => {
  const renderer = useRenderer();
  const [projectName] = createSignal("blossom");
  const [clankers] = createSignal([
    {
      id: 324,
      title: "title title title title title title title title title title",
      status: "running",
      contextusage: 23.465,
      cost: 0.6721309412,
    },
    {
      id: 325,
      title: "title title title title title title title title title title",
      status: "waiting",
      contextusage: 67.321423,
      cost: 10.615,
      pr_number: 41,
    },
    {
      id: 670,
      title: "title title title title title title title title title title",
      status: "merged",
      contextusage: 23.465,
      cost: 0.6721309412,
      pr_number: 67,
    },
  ] satisfies Clanker[]);
  const [selectedClankerId, setSelectedClankerId] = createSignal<number>();
  
  const selectedClankerIndex = () => {
    const id = selectedClankerId();
    return id !== undefined ? clankers().findIndex((clanker) => clanker.id === id) : -1;
  };

  useKeyboard((key) => {
    if (key.name === "d" && key.ctrl) {
      renderer.console.toggle();
    }
    if (key.name === "o" && key.ctrl) {
      renderer.toggleDebugOverlay();
    }
    if (key.name === "j" && (key.option || key.meta)) {
      console.log(selectedClankerIndex(), "option+j");
      const index = selectedClankerIndex();
      if (index !== -1) {
        if (index < clankers().length - 1)
          setSelectedClankerId(clankers()[index + 1]!.id);
      } else {
        setSelectedClankerId(clankers()[0]?.id);
      }
    }
    if (key.name === "k" && (key.option || key.meta)) {
      console.log(selectedClankerIndex(), "option+k");
      const index = selectedClankerIndex();
      if (index !== -1) {
        if (index > 0)
          setSelectedClankerId(clankers()[index - 1]!.id);
      } else {
        setSelectedClankerId(clankers()[clankers().length - 1]?.id);
      }
    }
  });

  return (
    <box
      style={{
        height: "100%",
        width: "100%",
        flexDirection: "column",
        backgroundColor: TOKYO_NIGHT.bg,
      }}
      paddingLeft={1}
    >
      <box
        height={8}
        paddingTop={1}
        paddingRight={1}
        flexDirection="row"
        gap={2}
      >
        <ascii_font
          text={selectedClankerId() ? `CLANKER ${selectedClankerId()}` : "CLANKERS"}
          style={{ font: "block", fg: TOKYO_NIGHT.fg }}
        />
        <ascii_font
          text="/"
          style={{ font: "block", fg: TOKYO_NIGHT.comment }}
        />
        <ascii_font
          text="/"
          style={{ font: "block", fg: TOKYO_NIGHT.comment }}
          marginLeft={-3}
        />
        <ascii_font
          text={projectName()}
          style={{ font: "block", fg: TOKYO_NIGHT.blue }}
        />
      </box>
      <box height="100%" flexDirection="row">
        <box width={CLANKER_WIDTH + 2} flexDirection="column">
          <For each={clankers()}>
            {(clanker) => (
              <Clanker
                clanker={clanker}
                selectedClankerId={selectedClankerId()}
                setSelectedClankerId={setSelectedClankerId}
              />
            )}
          </For>
          <box
            flexGrow={1}
            width="100%"
            onMouseDown={() => setSelectedClankerId(undefined)}
          />
          <box
            height={3}
            flexDirection="column"
            borderStyle="single"
            borderColor={TOKYO_NIGHT.dark3}
            border
            paddingLeft={1}
          >
            <text content="main" style={{ fg: TOKYO_NIGHT.green }} />
          </box>
        </box>
        <box flexDirection="column" flexGrow={1}>
          <box
            flexGrow={1}
            borderStyle="single"
            borderColor={TOKYO_NIGHT.dark3}
            border
            paddingLeft={1}
          >
            <Chat selectedClankerId={selectedClankerId()} clankers={clankers()} />
          </box>
          <ClankersStatusWrapper clankers={clankers()} />
        </box>
      </box>
    </box>
  );
};

function Clanker(props: {
  clanker: Clanker;
  selectedClankerId: number | undefined;
  setSelectedClankerId: (id: number | undefined) => void;
}) {
  const isSelected = () => props.selectedClankerId === props.clanker.id;

  return (
    <box
      flexDirection="column"
      onMouseDown={() => props.setSelectedClankerId(props.clanker.id)}
      height={5}
      style={{
        backgroundColor: isSelected() ? TOKYO_NIGHT.bg_highlight : "transparent",
        padding: 1,
      }}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text
          content={"clanker " + props.clanker.id.toString()}
          style={{ fg: TOKYO_NIGHT.fg_dark }}
        />
        <text
          content={props.clanker.status}
          style={{ fg: STATUS_COLORS[props.clanker.status] }}
        />
      </box>
      <box
        flexDirection="row"
        justifyContent="space-between"
        height={1}
        maxHeight={1}
      >
        <text
          content={props.clanker.title.slice(0, CLANKER_WIDTH - 2)}
          height={1}
          maxHeight={1}
          style={{ fg: TOKYO_NIGHT.fg }}
        />
      </box>
      <box flexDirection="row" justifyContent="space-between" height={1}>
        <text
          content={"$" + props.clanker.cost.toFixed(2)}
          style={{ fg: TOKYO_NIGHT.fg_dark }}
        />
        <text
          content={props.clanker.contextusage.toFixed(2) + "%"}
          style={{ fg: TOKYO_NIGHT.fg_dark }}
        />
      </box>
    </box>
  );
}

function Chat(props: {
  selectedClankerId: number | undefined;
  clankers: Clanker[];
}) {
  const updateChat = chatState((state) => state.updateChat);
  const messages = chatState((state) => state.messages);
  const chat = chatState((state) => state.chat);

  return (
    <box flexDirection="column" height="100%">
      <box
        flexGrow={1}
        style={{
          backgroundColor: TOKYO_NIGHT.bg_dark,
          padding: 1,
          marginBottom: 1,
        }}
      >
        <text
          content={JSON.stringify({ chat: chat(), messages: messages() })}
          style={{ fg: TOKYO_NIGHT.fg_dark }}
        />
      </box>

      <input
        placeholder={
          props.selectedClankerId ? "> enter message" : "> choose the agent"
        }
        height={Math.max(
          1,
          Math.ceil(
            (props.selectedClankerId ? (chat()[props.selectedClankerId] ?? "").length : 0) /
              80,
          ),
        )}
        focused={props.selectedClankerId !== undefined}
        onInput={(val) => updateChat(props.selectedClankerId!, val)}
        value={props.selectedClankerId ? (chat()[props.selectedClankerId] ?? "") : ""}
        style={{
          backgroundColor: TOKYO_NIGHT.bg,
          focusedBackgroundColor: TOKYO_NIGHT.bg,
          textColor: TOKYO_NIGHT.fg,
        }}
      />
    </box>
  );
}

function ClankersStatusWrapper(props: { clankers: Clanker[] }) {
  const activeClankers = () => props.clankers.filter(
    (c) => c.status === "running" || c.status === "waiting",
  );

  if (activeClankers().length === 0) {
    return null;
  }

  return <ClankersStatus clankers={props.clankers} />;
}

function ClankersStatus(props: { clankers: Clanker[] }) {
  const [history, setHistory] = createSignal<Record<number, string[]>>({});
  const dimensions = useTerminalDimensions();

  const activeClankers = () => props.clankers.filter(
    (c) => c.status === "running" || c.status === "waiting",
  );
  const boxHeight = () => activeClankers().length;

  // Terminal width (195) - left panel (40) - dot (1) - ID (4) - colon+space (2) - off by 3 fix
  const historyWidth = () => dimensions().width - (CLANKER_WIDTH + 2) - 1 - 4 - 2 - 3;

  // Update history every second
  createEffect(() => {
    const interval = setInterval(() => {
      setHistory((prev) => {
        const updated = { ...prev };

        activeClankers().forEach((clanker) => {
          if (!updated[clanker.id])
            updated[clanker.id] = Array.from({ length: 240 }, () => " ");

          // max 240 seconds. we dont rly care about inneficiency of the popping off the front of the array here bc its one every second anyways and computers are fast
          updated[clanker.id]!.push(clanker?.status === "running" ? "█" : " ");
          updated[clanker.id] = updated[clanker.id]!.slice(-240);
        });
        return updated;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  });

  if (activeClankers().length === 0) {
    return null;
  }

  return (
    <box flexDirection="column" height={boxHeight()} paddingLeft={1}>
      <For each={activeClankers()}>
        {(clanker) => (
          <box flexDirection="row">
            <text
              content="●"
              style={{ fg: STATUS_COLORS[clanker.status] }}
              paddingRight={1}
            />
            <text
              content={`${clanker.id}:`}
              style={{ fg: STATUS_COLORS[clanker.status] }}
              width={6}
            />
            <ClankerHistory
              history={
                history()[clanker.id] || Array.from({ length: 240 }, () => " ")
              }
              width={historyWidth()}
            />
          </box>
        )}
      </For>
    </box>
  );
}

function ClankerHistory(props: {
  history: string[];
  width: number;
}) {
  const maxHistorySeconds = () => Math.max(1, props.width);

  return (
    <text
      content={props.history.join("").slice(-maxHistorySeconds())}
      style={{
        bg: TOKYO_NIGHT.dark3,
        fg: STATUS_COLORS.running,
      }}
    />
  );
}

render(() => <App />, { useKittyKeyboard: true, targetFps: 60 });