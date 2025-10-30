import { createRoot } from "react-dom/client";
import App from "./App";
import "./i18n";
import { Suspense } from "react";

const container = document.getElementById("root") as HTMLElement;
const root = createRoot(container);

root.render(
  <Suspense fallback={<div>Loading...</div>}>
    <App />
  </Suspense>,
);
