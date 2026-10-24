import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import App, { Protected, NotFound } from "./App";
import Landing from "./pages/Landing";
const Auth = React.lazy(() => import("./pages/Auth"));
const Library = React.lazy(() => import("./pages/Library"));
const CreateStory = React.lazy(() => import("./pages/CreateStory"));
const Story = React.lazy(() => import("./pages/Story"));
const Settings = React.lazy(() => import("./pages/Settings"));
import "./styles.css";
import { queryClient } from "./lib";
const protect = (element: React.ReactNode) => <Protected>{element}</Protected>;
const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/login", element: <Auth mode="login" /> },
      { path: "/signup", element: <Auth mode="signup" /> },
      { path: "/reset", element: <Auth mode="reset" /> },
      { path: "/dashboard", element: protect(<Library dashboard />) },
      { path: "/library", element: protect(<Library />) },
      { path: "/create", element: protect(<CreateStory />) },
      { path: "/settings", element: protect(<Settings />) },
      { path: "/profile", element: <NavigateProfile /> },
      { path: "/story/:id", element: protect(<Story />) },
      ...(["universe", "characters", "timeline", "constellation"] as const).map(
        (view) => ({
          path: `/story/:id/${view}`,
          element: protect(<Story view={view} />),
        }),
      ),
      { path: "*", element: <NotFound /> },
    ],
  },
]);
function NavigateProfile() {
  return protect(<Settings />);
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <RouterProvider router={router} />
      </MotionConfig>
    </QueryClientProvider>
  </React.StrictMode>,
);
