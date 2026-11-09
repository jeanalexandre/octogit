import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";

if (import.meta.env.MODE === "web") {
  await import("./web-bridge");
}

mount(App, { target: document.getElementById("app")! });
