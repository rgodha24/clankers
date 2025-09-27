import { render } from "@opentui/react";

import { useTerminalDimensions } from "@opentui/react";

export const App = () => {
  const { width, height } = useTerminalDimensions();

  return (
    <box style={{ height: "100%" }} borderStyle="rounded">
      <text content={`Terminal: ${width}x${height}`} />
    </box>
  );
};

render(<App />);
