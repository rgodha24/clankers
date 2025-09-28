import { RGBA } from "@opentui/core";
import { render, useAppContext, useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useState, useEffect } from "react";
import { create, useStore } from "zustand";

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
  bg: "#222436",
  bg_dark: "#1e2030",
  bg_dark1: "#191B29",
  bg_highlight: "#2f334d",
  blue: "#82aaff",
  blue1: "#65bcff",
  blue2: "#0db9d7",
  cyan: "#86e1fc",
  comment: "#636da6",
  dark3: "#545c7e",
  dark5: "#737aa2",
  fg: "#c8d3f5",
  fg_dark: "#828bb8",
  fg_gutter: "#3b4261",
  green: "#c3e88d",
  green1: "#4fd6be",
  magenta: "#c099ff",
  orange: "#ff966c",
  purple: "#fca7ea",
  red: "#ff757f",
  red1: "#c53b53",
  teal: "#4fd6be",
  yellow: "#ffc777",
  git: {
    add: "#b8db87",
    change: "#7ca1f2",
    delete: "#e26a75",
  }
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
const chatState = create<Store>()((set) => ({
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
  const { renderer } = useAppContext();
  const [projectName, setProjectName] = useState("blossom");
  const [clankers, setClankers] = useState([
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
  const [selectedClankerId, setSelectedClankerId] = useState<number>();
  const selectedClankerIndex = clankers.findIndex(
    (clanker) => clanker.id === selectedClankerId,
  );
  useKeyboard((key) => {
    if (key.name === "d" && key.ctrl) {
      renderer?.console.toggle();
    }
    if (key.name === "o" && key.ctrl) {
      renderer?.toggleDebugOverlay();
    }
    if (key.name === "j" && (key.option || key.meta)) {
      console.log(selectedClankerIndex, "option+j");
      if (
        selectedClankerIndex !== -1 &&
        selectedClankerIndex < clankers.length - 1
      ) {
        setSelectedClankerId(clankers[selectedClankerIndex + 1]!.id);
      }
    }
    if (key.name === "k" && (key.option || key.meta)) {
      console.log(selectedClankerIndex, "option+k");
      if (selectedClankerIndex !== -1 && selectedClankerIndex > 0) {
        setSelectedClankerId(clankers[selectedClankerIndex - 1]!.id);
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
        color: TOKYO_NIGHT.fg
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
        <ascii-font
          text={selectedClankerId ? `CLANKER ${selectedClankerId}` : "CLANKERS"}
          style={{ font: "block", fg: TOKYO_NIGHT.fg }}
        />
        <ascii-font text="/" style={{ font: "block", fg: TOKYO_NIGHT.comment }} />
        <ascii-font text="/" style={{ font: "block", fg: TOKYO_NIGHT.comment }} marginLeft={-3} />
        <ascii-font text={projectName} style={{ font: "block", fg: TOKYO_NIGHT.blue }} />
      </box>
      <box height="100%" flexDirection="row">
        <box width={CLANKER_WIDTH + 2} flexDirection="column">
          {clankers.map((clanker) => (
            <Clanker
              clanker={clanker}
              key={clanker.id}
              selectedClankerId={selectedClankerId}
              setSelectedClankerId={setSelectedClankerId}
            />
          ))}
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
            paddingLeft={1}
          >
            <text content="main" style={{ fg: TOKYO_NIGHT.green }} />
          </box>
        </box>
        <box 
          flexDirection="column" 
          flexGrow={1} 
          borderStyle="single"
          borderColor={TOKYO_NIGHT.dark3}
          paddingLeft={1}
        >
          <Chat selectedClankerId={selectedClankerId} clankers={clankers} />
        </box>
      </box>
    </box>
  );
};

function Clanker({
  clanker,
  selectedClankerId,
  setSelectedClankerId,
}: {
  clanker: Clanker;
  key: number;
  selectedClankerId: number | undefined;
  setSelectedClankerId: (id: number | undefined) => void;
}) {
  const isSelected = selectedClankerId === clanker.id;
  
  return (
    <box
      flexDirection="column"
      key={clanker.id}
      onMouseDown={() => setSelectedClankerId(clanker.id)}
      height={5}
      style={{
        backgroundColor: isSelected ? TOKYO_NIGHT.bg_highlight : "transparent",
        borderLeftWidth: 2,
        borderLeftColor: STATUS_COLORS[clanker.status],
        borderLeftStyle: "solid",
        padding: 1,
        marginBottom: 1
      }}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text 
          content={"clanker " + clanker.id.toString()} 
          style={{ fg: TOKYO_NIGHT.fg_dark }}
        />
        <text 
          content={clanker.status} 
          style={{ fg: STATUS_COLORS[clanker.status] }}
        />
      </box>
      <box
        flexDirection="row"
        justifyContent="space-between"
        height={1}
        maxHeight={1}
      >
        <text
          content={clanker.title.slice(0, CLANKER_WIDTH - 2)}
          height={1}
          maxHeight={1}
          style={{ fg: TOKYO_NIGHT.fg }}
        />
      </box>
      <box flexDirection="row" justifyContent="space-between" height={1}>
        <text 
          content={"$" + clanker.cost.toFixed(2)} 
          style={{ fg: TOKYO_NIGHT.fg_dark }}
        />
        <text 
          content={clanker.contextusage.toFixed(2) + "%"} 
          style={{ fg: TOKYO_NIGHT.fg_dark }}
        />
      </box>
    </box>
  );
}

function Chat({
  selectedClankerId,
  clankers,
}: {
  selectedClankerId: number | undefined;
  clankers: Clanker[];
}) {
  const { addMessage, updateChat, messages, chat } = useStore(chatState);

  const activeClankers = clankers.filter((c) => c.status === "running" || c.status === "waiting");

  return (
    <box flexDirection="column" height="100%">
      <box 
        flexGrow={1} 
        style={{ 
          backgroundColor: TOKYO_NIGHT.bg_dark,
          padding: 1,
          marginBottom: 1
        }}
      >
        <text 
          content={JSON.stringify({ chat, messages })} 
          style={{ fg: TOKYO_NIGHT.fg_dark }}
        />
      </box>
      
      <box flexDirection="column" flexShrink={0}>
        <box 
          borderStyle="single"
          borderColor={selectedClankerId ? TOKYO_NIGHT.blue : TOKYO_NIGHT.dark3}
        >
          <input
            placeholder={selectedClankerId ? "enter message" : "choose the agent"}
            height={3}
            focused={selectedClankerId !== undefined}
            onInput={(val) => updateChat(selectedClankerId!, val)}
            value={selectedClankerId ? (chat[selectedClankerId] ?? "") : ""}
            backgroundColor={TOKYO_NIGHT.bg_dark}
            focusedBackgroundColor={TOKYO_NIGHT.bg_dark}
            style={{ fg: TOKYO_NIGHT.fg }}
          />
        </box>
        
        <box 
          flexDirection="row" 
          height={1} 
          justifyContent="space-between"
          style={{ marginTop: 1 }}
        >
          <text content="esc=cancel" style={{ fg: TOKYO_NIGHT.comment }} />
          <text content="enter=send" style={{ fg: TOKYO_NIGHT.comment }} />
        </box>
        
        {activeClankers.length > 0 && <ClankersStatus clankers={clankers} />}
      </box>
    </box>
  );
}

function ClankersStatus({ clankers }: { clankers: Clanker[] }) {
  const [history, setHistory] = useState<Record<number, ClankerHistoryEntry[]>>({});
  const { width } = useTerminalDimensions();

  const activeClankers = clankers.filter((c) => c.status === "running" || c.status === "waiting");
  const boxHeight = Math.min(3, activeClankers.length); // Cap the height to 3 rows max
  
  // Calculate exact available width for history bars:
  // Total terminal width - left clanker panel (CLANKER_WIDTH + 2 = 42) - right border (1) - left padding of main (1) - dot (1) - clanker ID (4) - colon + space (2) - padding left (1) - overshooting by 2
  const historyWidth = width - 42 - 1 - 1 - 1 - 4 - 2 - 1 - 2;

  // Update history every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setHistory((prev) => {
        const updated = { ...prev };
        activeClankers.forEach((clanker) => {
          if (!updated[clanker.id]) updated[clanker.id] = [];
          updated[clanker.id] = [
            ...updated[clanker.id],
            { timestamp: now, status: clanker.status }
          ];
          // Keep only last 120 entries (2 minutes worth)
          if (updated[clanker.id].length > 120) {
            updated[clanker.id] = updated[clanker.id].slice(-120);
          }
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeClankers]);

  if (activeClankers.length === 0) {
    return null;
  }

  return (
    <box 
      flexDirection="column" 
      height={boxHeight}
      style={{ 
        borderTopWidth: 1,
        borderTopColor: TOKYO_NIGHT.dark3,
        borderTopStyle: "single",
        marginTop: 1
      }}
      paddingTop={1}
      paddingLeft={1}
    >
      {activeClankers.map((clanker) => (
        <box key={clanker.id} flexDirection="row" alignItems="center" height={1}>
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
          <ClankerHistory clanker={clanker} history={history[clanker.id] || []} width={historyWidth} />
        </box>
      ))}
    </box>
  );
}

function ClankerHistory({
  clanker,
  history,
  width,
}: {
  clanker: Clanker;
  history: ClankerHistoryEntry[];
  width: number;
}) {
  const now = Date.now();
  // Use exactly the width we calculated - each block is 1 character
  const maxHistorySeconds = Math.max(1, width);
  
  // Get the recent history 
  const recentHistory = history
    .filter((entry) => now - entry.timestamp < maxHistorySeconds * 1000)
    .slice(-maxHistorySeconds);

  // Create exactly width number of blocks
  const blocks = Array.from({ length: maxHistorySeconds }, (_, i) => {
    const secondTimestamp = now - (maxHistorySeconds - i - 1) * 1000;
    const entry = recentHistory.find(
      (h) => Math.abs(h.timestamp - secondTimestamp) < 500
    );
    return entry?.status || null;
  });

  return (
    <text>
      {blocks.map((status, i) => (
          <span
            key={i}
            style={{
              fg: status ? STATUS_COLORS[status] : TOKYO_NIGHT.dark3,
            }}
          >
          █
        </span>
      ))}
    </text>
  );
}

render(<App />, { useKittyKeyboard: true });
