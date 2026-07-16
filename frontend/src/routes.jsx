// Central route configuration for the app.
// Keeps main.jsx slim and makes the route tree easy to extend.

import { createBrowserRouter, Navigate } from "react-router-dom";
import App             from "@/App";
import Home            from "@/pages/Home";
import Sandbox         from "@/pages/Sandbox";
import Challenges      from "@/pages/Challenges";
import ChallengePlay   from "@/pages/ChallengePlay";
import CaseStudies     from "@/pages/CaseStudies";
import CaseStudyDetail from "@/pages/CaseStudyDetail";
import Learn           from "@/pages/Learn";
import RoadmapOverview from "@/pages/RoadmapOverview";
import RoadmapLesson   from "@/pages/RoadmapLesson";
import InterviewPrep   from "@/pages/InterviewPrep";
import Dashboard       from "@/pages/Dashboard";
import Login           from "@/pages/Login";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true,                element: <Home />            },
      { path: "sandbox",            element: <Sandbox />         },
      { path: "challenges",         element: <Challenges />      },
      { path: "challenges/:slug",   element: <ChallengePlay />   },
      { path: "case-studies",       element: <CaseStudies />     },
      { path: "case-studies/:slug", element: <CaseStudyDetail /> },
      { path: "learn",              element: <Learn />           },
      { path: "learn/roadmap",         element: <RoadmapOverview /> },
      { path: "learn/roadmap/:slug",   element: <RoadmapLesson />   },
      // Interview prep now lives under Learn (2026-07-16). Old /interview
      // links redirect so nothing breaks.
      { path: "learn/interview",    element: <InterviewPrep />   },
      { path: "interview",          element: <Navigate to="/learn/interview" replace /> },
      { path: "dashboard",          element: <Dashboard />       },
      { path: "login",              element: <Login />           },
    ],
  },
]);
