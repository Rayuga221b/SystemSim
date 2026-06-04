// Central route configuration for the app.
// Keeps main.jsx slim and makes the route tree easy to extend.

import { createBrowserRouter } from "react-router-dom";
import App         from "@/App";
import Home        from "@/pages/Home";
import Sandbox     from "@/pages/Sandbox";
import Challenges  from "@/pages/Challenges";
import CaseStudies from "@/pages/CaseStudies";
import Dashboard   from "@/pages/Dashboard";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true,               element: <Home />        },
      { path: "sandbox",           element: <Sandbox />     },
      { path: "challenges",        element: <Challenges />  },
      { path: "case-studies",      element: <CaseStudies /> },
      { path: "dashboard",         element: <Dashboard />   },
    ],
  },
]);
