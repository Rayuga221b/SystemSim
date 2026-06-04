import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { router } from "./routes";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* forcedTheme="dark" locks the theme — DottedSurface always uses white particles */}
    <ThemeProvider defaultTheme="dark" forcedTheme="dark" attribute="class">
      <RouterProvider router={router} />
    </ThemeProvider>
  </React.StrictMode>
);
