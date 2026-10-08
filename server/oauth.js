const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Daily Frame Instagram Agent is running.");
});

app.get("/auth/meta/callback", async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(`Meta login error: ${error_description || error}`);
  }

  if (!code) {
    return res.status(400).send("No authorization code received.");
  }

  res.send("Meta authorization code received successfully.");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
