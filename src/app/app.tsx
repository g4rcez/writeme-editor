import { RouterProvider } from "react-router-dom";
import { StrictMode } from "react";
import { router } from "./router";

export const App = () => {
  return (
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
};