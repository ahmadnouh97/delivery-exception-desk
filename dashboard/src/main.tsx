import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource-variable/noto-sans-arabic";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Missing dashboard root element");

createRoot(root).render(<App />);
