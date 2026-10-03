import "../../3rok-design-system/tokens.css";
import "../../3rok-design-system/components/bundle.css";
import "cesium/Build/Cesium/Widgets/widgets.css";
import "./app.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
