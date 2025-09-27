import { RGBA } from "@opentui/core";
import { render } from "@opentui/react";
import { useState } from "react";

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

const App = () => {
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
      id: 323,
      title: "title title title title title title title title title title",
      status: "merged",
      contextusage: 23.465,
      cost: 0.6721309412,
      pr_number: 67,
    },
  ] satisfies Clanker[]);
  const [selectedClankerId, setSelectedClankerId] = useState<number>();

  return (
    <box style={{ height: "100%", width: "100%", flexDirection: "column" }}>
      <box height={8} paddingLeft={2} paddingTop={1} paddingRight={1}>
        <ascii-font
          text={`CLANKER / ${projectName}`}
          style={{ font: "block" }}
        />
      </box>
      <box height="100%" flexDirection="row">
        <box width={CLANKER_WIDTH + 2} flexDirection="column">
          <box flexGrow={1} flexDirection="column">
            {clankers.map((clanker) => (
              <Clanker
                clanker={clanker}
                key={clanker.id}
                selectedClankerId={selectedClankerId}
                setSelectedClankerId={setSelectedClankerId}
              />
            ))}
          </box>
          <box
            height={3}
            flexDirection="column"
            borderStyle="rounded"
            borderColor="blue"
          >
            <text content="main" />
          </box>
        </box>
      </box>
    </box>
  );
};

function Clanker({
  clanker,
  key,
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
      key={key}
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

render(<App />);
