import { RGBA } from "@opentui/core";
import { render, useAppContext, useKeyboard } from "@opentui/react";
import { useState } from "react";
import { create, useStore } from "zustand";

export type Clanker = {
  id: number;
  title: string;
  status: "running" | "waiting" | "merged";
  contextusage: number;
  cost: number;
  pr_number?: number;
};

const COLORS = {
  merged: RGBA.fromHex("#00ff00"),
  waiting: RGBA.fromHex("#f00f00"),
  running: RGBA.fromHex("#ff00ff"),
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
      style={{ height: "100%", width: "100%", flexDirection: "column" }}
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
          style={{ font: "block" }}
        />
        <ascii-font text="/" style={{ font: "block" }} />
        <ascii-font text="/" style={{ font: "block" }} marginLeft={-3} />
        <ascii-font text={projectName} style={{ font: "block" }} />
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
            borderStyle="rounded"
            borderColor="blue"
          >
            <text content="main" />
          </box>
        </box>
        <box flexDirection="column" flexGrow={1} borderStyle="single">
          <Chat selectedClankerId={selectedClankerId} />
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
  return (
    <box
      flexDirection="column"
      borderStyle={selectedClankerId === clanker.id ? "double" : undefined}
      borderColor={COLORS[clanker.status]}
      key={clanker.id}
      onMouseDown={() => setSelectedClankerId(clanker.id)}
      height={5}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text content={"clanker " + clanker.id.toString()} />
        <text content={clanker.status} />
      </box>
      <box
        flexDirection="row"
        justifyContent="space-between"
        height={1}
        maxHeight={1}
      >
        <text
          content={clanker.title.slice(0, CLANKER_WIDTH)}
          height={1}
          maxHeight={1}
        />
      </box>
      <box flexDirection="row" justifyContent="space-between" height={1}>
        <text content={"$" + clanker.cost.toFixed(2)} />
        <text content={clanker.contextusage.toFixed(2) + "%"} />
      </box>
    </box>
  );
}

function Chat({
  selectedClankerId,
}: {
  selectedClankerId: number | undefined;
}) {
  const { addMessage, updateChat, messages, chat } = useStore(chatState);

  return (
    <box flexDirection="column" height="100%">
      <box flexGrow={1} height={3} borderStyle="rounded" borderColor="blue">
        <text content={JSON.stringify({ chat, messages })} />
      </box>
      <box borderStyle="rounded" borderColor="red">
        <input
          placeholder={selectedClankerId ? "enter message" : "choose the agent"}
          height={3}
          focused={selectedClankerId !== undefined}
          onInput={(val) => updateChat(selectedClankerId!, val)}
          value={selectedClankerId ? (chat[selectedClankerId] ?? "") : ""}
          focusedBackgroundColor="#002222"
          backgroundColor="#000000"
        />
      </box>
      <box flexDirection="row" height={1} justifyContent="space-between">
        <text content="esc=cancel" />
        <text content="enter=send" />
      </box>
    </box>
  );
}

render(<App />);
