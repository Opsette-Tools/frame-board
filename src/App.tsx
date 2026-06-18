import { useState } from "react";
import { App as AntApp } from "antd";
import { ThemeProvider } from "@/lib/theme";
import Shell from "@/components/Shell";
import Home from "./pages/Home";

const App = () => {
  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);
  return (
    <ThemeProvider>
      <AntApp>
        <Shell headerActions={headerActions}>
          <Home setHeaderActions={setHeaderActions} />
        </Shell>
      </AntApp>
    </ThemeProvider>
  );
};

export default App;
