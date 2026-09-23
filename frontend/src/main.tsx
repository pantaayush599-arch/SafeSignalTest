import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { IdentityProvider } from "./state/identity";
import { ThemeProvider } from "./state/theme";
import { SecurityStateProvider } from "./state/securityState";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <SecurityStateProvider>
        <BrowserRouter>
          <IdentityProvider>
            <App />
          </IdentityProvider>
        </BrowserRouter>
      </SecurityStateProvider>
    </ThemeProvider>
  </StrictMode>
);
