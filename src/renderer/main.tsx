// The page's entry: one React tree, no router (three screens, one at a time), and the
// stylesheet. React's strict mode is on so a mistaken effect shows itself while we develop.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("The page has no root element.");
createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
