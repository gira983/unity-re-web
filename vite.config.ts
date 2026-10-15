import { defineConfig } from "vite";

// relative base so the built app also works from file:// inside the iOS WKWebView shell
export default defineConfig({
  base: "./",
});
