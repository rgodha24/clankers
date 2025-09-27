import { RGBA } from "@opentui/core";
import { render, useKeyboard } from "@opentui/react";
import { useState, useEffect } from "react";

interface ClankerState {
  id: number;
  title: string;
  status: "running" | "waiting" | "merged";
  progress: number;
  cost: number;
  selected?: boolean;
}

const Header = () => {
  return (
    <box
      style={{ border: true, borderColor: "#FFFFFF", padding: 1, height: 8 }}
    >
      <box style={{ flexDirection: "row", width: "100%" }}>
        <ascii-font
          text="CLANKER //"
          style={{ fg: RGBA.fromHex("#FFFFFF"), font: "block" }}
        />
        <box
          style={{
            marginLeft: "auto",
            alignItems: "flex-end",
            flexDirection: "column",
          }}
        >
          <text content="keybindings so far:" style={{ fg: "#888888" }} />
          <text
            content="opt+n to create new clanker"
            style={{ fg: "#888888" }}
          />
          <text
            content="opt+o to check out the clanker's code"
            style={{ fg: "#888888" }}
          />
          <text
            content="opt+p to tell clanker to create a pr"
            style={{ fg: "#888888" }}
          />
          <text
            content="opt+m to use the github cli to squash and merge the pr"
            style={{ fg: "#888888" }}
          />
          <text
            content="- this should open a modal with confirmation"
            style={{ fg: "#888888" }}
          />
        </box>
      </box>
    </box>
  );
};

const ClankerItem = ({ clanker }: { clanker: ClankerState }) => {
  const statusColors = {
    running: "#4A90E2",
    waiting: "#F5A623",
    merged: "#7ED321",
  };

  const statusColor = statusColors[clanker.status];
  const borderStyle = clanker.selected ? "double" : "single";
  const borderColor = clanker.selected ? "#FFFFFF" : "#666666";

  return (
    <box
      style={{
        border: true,
        borderStyle,
        borderColor,
        padding: 1,
        marginBottom: 1,
        height: 6,
      }}
    >
      <box style={{ flexDirection: "column" }}>
        <box style={{ flexDirection: "row", alignItems: "center" }}>
          <text content={`clanker ${clanker.id}`} style={{ fg: statusColor }} />
          <text
            content={clanker.status}
            style={{ fg: statusColor, marginLeft: 2 }}
          />
        </box>
        <text content={clanker.title} style={{ fg: "#CCCCCC" }} />
        <box style={{ flexDirection: "row", alignItems: "center" }}>
          <box style={{ width: 10, height: 1, backgroundColor: "#333333" }}>
            <box
              style={{
                width: `${clanker.progress}%`,
                height: 1,
                backgroundColor: statusColor,
              }}
            />
          </box>
          <text
            content={`${clanker.progress.toFixed(1)}% ($${clanker.cost.toFixed(2)})`}
            style={{ fg: "#CCCCCC", marginLeft: 2 }}
          />
        </box>
      </box>
    </box>
  );
};

const ClankerList = ({
  clankers,
  selectedIndex,
}: {
  clankers: ClankerState[];
  selectedIndex: number;
}) => {
  return (
    <box
      style={{
        width: "40%",
        padding: 1,
        flexDirection: "column",
        height: "100%",
      }}
    >
      <box style={{ height: "90%" }}>
        {clankers.map((clanker, index) => {
          const clankerWithSelection = {
            ...clanker,
            selected: index === selectedIndex,
          };
          return <ClankerItem clanker={clankerWithSelection} />;
        })}
      </box>
      <box
        style={{
          border: true,
          borderColor: "#666666",
          padding: 1,
          marginTop: 1,
        }}
      >
        <text content="/ main" style={{ fg: "#7ED321" }} />
      </box>
    </box>
  );
};

const LLMOutput = ({
  inputValue,
  onInputChange,
}: {
  inputValue: string;
  onInputChange: (value: string) => void;
}) => {
  const loremText = [
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
    "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.",
    "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui.",
    "Officia deserunt mollit anim id est laborum sed ut perspiciatis unde.",
    "Omnis iste natus error sit voluptatem accusantium doloremque laudantium.",
    "Totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi.",
    "Architecto beatae vitae dicta sunt explicabo nemo enim ipsam voluptatem.",
    "Quia voluptas sit aspernatur aut odit aut fugit sed quia consequuntur.",
    "Magni dolores eos qui ratione voluptatem sequi nesciunt neque porro.",
    "Quisquam est qui dolorem ipsum quia dolor sit amet consectetur adipisci.",
    "Velit sed quia non numquam eius modi tempora incidunt ut labore et.",
    "Dolore magnam aliquam quaerat voluptatem ut enim ad minima veniam quis.",
    "Nostrum exercitationem ullam corporis suscipit laboriosam nisi ut aliquid.",
    "Ex ea commodi consequatur quis autem vel eum iure reprehenderit qui in.",
    "Ea voluptate velit esse quam nihil molestiae consequatur vel illum qui.",
    "Dolorem eum fugiat quo voluptas nulla pariatur at vero eos et accusamus.",
    "Et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum.",
    "Deleniti atque corrupti quos dolores et quas molestias excepturi sint.",
  ];

  const [content, setContent] = useState<string[]>([]);

  useEffect(() => {
    const generateContent = () => {
      const lines = [];
      for (let i = 0; i < 100; i++) {
        lines.push(
          `${i + 1}: ${loremText[Math.floor(Math.random() * loremText.length)]}`,
        );
      }
      setContent(lines);
    };
    generateContent();
  }, []);

  return (
    <box style={{ width: "60%", flexDirection: "column", marginLeft: 2 }}>
      <box
        style={{
          border: true,
          borderColor: "#666666",
          padding: 1,
          height: "100%",
        }}
      >
        <box style={{ flexDirection: "column", height: "100%" }}>
          <scrollbox style={{ height: "100%" }} focused>
            {content.map((line: string, index: number) => (
              <text
                key={`line-${index}`}
                content={line}
                style={{ fg: "#888888", marginBottom: 0.5 }}
              />
            ))}
          </scrollbox>
        </box>
      </box>

      {/* Input area integrated into the LLM output section */}
      <box
        style={{
          border: true,
          borderColor: "#666666",
          marginTop: 1,
          padding: 1,
        }}
      >
        <box style={{ flexDirection: "column", width: "100%" }}>
          <input
            value={inputValue}
            focused={true}
            placeholder="Type your message..."
            onInput={onInputChange}
            style={{
              backgroundColor: "#000000",
              focusedBackgroundColor: "#111111",
              padding: 1,
            }}
          />
        </box>
      </box>
    </box>
  );
};

const ActivityGraph = ({ clankers }: { clankers: ClankerState[] }) => {
  const [graphData, setGraphData] = useState<
    Array<{ id: number; activity: number[] }>
  >([]);

  useEffect(() => {
    const initialData = clankers.map((clanker) => ({
      id: clanker.id,
      activity: Array(20)
        .fill(0)
        .map(() => Math.random()),
    }));
    setGraphData(initialData);

    const interval = setInterval(() => {
      setGraphData((prev: Array<{ id: number; activity: number[] }>) =>
        prev.map((item: { id: number; activity: number[] }) => ({
          ...item,
          activity: [...item.activity.slice(1), Math.random()],
        })),
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [clankers]);

  const statusColors = {
    running: "#E74C3C",
    waiting: "#9B59B6",
    merged: "#2ECC71",
  };

  return (
    <box
      style={{ border: true, borderColor: "#666666", padding: 1, height: 6 }}
    >
      <box style={{ flexDirection: "row", width: "100%", height: "100%" }}>
        <box style={{ flexDirection: "column", marginRight: 2, width: 15 }}>
          <text content="esc=cancel" style={{ fg: "#666666" }} />
          <text content="enter=submit" style={{ fg: "#666666" }} />
        </box>
        <box style={{ width: "85%", flexDirection: "column" }}>
          {graphData.map(
            (data: { id: number; activity: number[] }, index: number) => {
              const clanker = clankers[index];
              if (!clanker) return null;
              return (
                <box
                  key={`graph-${data.id}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    height: 1,
                    marginBottom: 0.2,
                  }}
                >
                  <text
                    content={`clanker ${data.id}`}
                    style={{ fg: "#CCCCCC", width: 12 }}
                  />
                  <box style={{ flexDirection: "row", width: "100%" }}>
                    {data.activity.map((value: number, i: number) => (
                      <box
                        key={`activity-${i}`}
                        style={{
                          width: 2,
                          height: 1,
                          backgroundColor:
                            value > 0.3
                              ? statusColors[clanker.status]
                              : "#333333",
                          marginRight: 0.2,
                        }}
                      />
                    ))}
                  </box>
                </box>
              );
            },
          )}
        </box>
      </box>
    </box>
  );
};

export const App = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [clankers, setClankers] = useState<ClankerState[]>([
    {
      id: 324,
      title: "title title title title ...",
      status: "running",
      progress: 23.4,
      cost: 0.67,
    },
    {
      id: 325,
      title: "title title title t... (#41)",
      status: "waiting",
      progress: 67.4,
      cost: 10.6,
    },
    {
      id: 323,
      title: "title title title... (#67)",
      status: "merged",
      progress: 67.4,
      cost: 10.6,
    },
  ]);

  useKeyboard((key) => {
    if (key.sequence === "∆" && key.name === "j") {
      // alt+j
      setSelectedIndex((prev: number) =>
        Math.min(prev + 1, clankers.length - 1),
      );
    } else if (key.sequence === "˚" && key.name === "k") {
      // alt+k
      setSelectedIndex((prev: number) => Math.max(prev - 1, 0));
    } else if (key.name === "down") {
      setSelectedIndex((prev: number) =>
        Math.min(prev + 1, clankers.length - 1),
      );
    } else if (key.name === "up") {
      setSelectedIndex((prev: number) => Math.max(prev - 1, 0));
    }
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() < 0.01) {
        setClankers((prev: ClankerState[]) =>
          prev.map((clanker: ClankerState) => ({
            ...clanker,
            progress: Math.min(100, clanker.progress + Math.random() * 5),
            cost: clanker.cost + Math.random() * 0.1,
          })),
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <box style={{ height: "100%", flexDirection: "column" }}>
      <Header />
      <box style={{ height: "80%", flexDirection: "row", padding: 1 }}>
        <ClankerList clankers={clankers} selectedIndex={selectedIndex} />
        <LLMOutput inputValue={inputValue} onInputChange={setInputValue} />
      </box>
      <ActivityGraph clankers={clankers} />
    </box>
  );
};

render(<App />);

