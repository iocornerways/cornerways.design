import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Only for the preview site. Consumers build this package's source with
// their own Vite config.
export default defineConfig({
  plugins: [react()],
  server: { port: 5191, strictPort: true },
});
