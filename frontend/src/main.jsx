import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { router } from "./routes";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* Dark is the default/primary identity (see DESIGN.md "Dark technical");
        light is an explicit opt-in via the Navbar toggle, not OS-driven, so
        the app doesn't silently repaint on a system setting change. */}
    <ThemeProvider defaultTheme="dark" enableSystem={false} attribute="class">
      <RouterProvider router={router} />
    </ThemeProvider>
  </React.StrictMode>
);
