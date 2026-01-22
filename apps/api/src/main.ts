import "dotenv/config";
import { createApp } from "./app";

const PORT = Number(process.env.PORT || 4000);

const app = createApp();
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
