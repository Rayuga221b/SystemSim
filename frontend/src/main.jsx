import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import Home from "./pages/Home.jsx";
import Sandbox from "./pages/Sandbox.jsx";
import Challenges from "./pages/Challenges.jsx";
import CaseStudies from "./pages/CaseStudies.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Home />} />
          <Route path="sandbox" element={<Sandbox />} />
          <Route path="challenges" element={<Challenges />} />
          <Route path="case-studies" element={<CaseStudies />} />
          <Route path="dashboard" element={<Dashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
