import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { App as AntApp } from "antd";
import { ThemeProvider } from "@/lib/theme";
import Shell from "@/components/Shell";
import Dashboard from "./pages/Dashboard";
import Editor from "./pages/Editor";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Match the router basename to Vite's build-time base ("/frame-board/" in
// production, "/" in dev). Without this, React Router treats the app as
// mounted at "/" and fires NotFound for the production URL /frame-board/.
const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AntApp>
        <BrowserRouter basename={basename}>
          <Shell>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/project/:id" element={<Editor />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Shell>
        </BrowserRouter>
      </AntApp>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
