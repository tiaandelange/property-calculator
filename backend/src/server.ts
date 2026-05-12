import { app } from "./app.js";
import { env } from "./config/env.js";
import { ensureReportsDirectory } from "./config/reportsPaths.js";

void ensureReportsDirectory().catch((err) => console.error("[server] Failed to ensure reports directory", err));

app.listen(env.PORT, () => {
  console.log(`The Property Guy API running on port ${env.PORT}`);
});
