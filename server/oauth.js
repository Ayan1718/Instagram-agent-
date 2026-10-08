
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Daily Frame Instagram Agent is running.");
});

app.get("/auth/meta/callback", (req, res) => {
  res.send("Meta OAuth callback received.");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
