const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

let metaAccessToken = null;

app.get("/", (req, res) => {
  res.send("Daily Frame Instagram Agent is running.");
});

app.get("/auth/meta/callback", async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res
      .status(400)
      .send(`Meta login error: ${error_description || error}`);
  }

  if (!code) {
    return res.status(400).send("No authorization code received.");
  }

  try {
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: process.env.META_REDIRECT_URI,
      code,
    });

    const response = await fetch(
      "https://graph.facebook.com/v24.0/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    const data = await response.json();

    if (!response.ok || data.error || !data.access_token) {
      console.error("Meta token exchange failed.");
      return res
        .status(400)
        .send("Meta token exchange failed. Check Render logs.");
    }

    metaAccessToken = data.access_token;

    console.log("Meta access token received successfully.");

    res.send("Meta access token received successfully.");
  } catch (err) {
    console.error("OAuth callback error:", err.message);
    res.status(500).send("Server error during Meta token exchange.");
  }
});

app.get("/auth/meta/status", (req, res) => {
  res.json({
    connected: Boolean(metaAccessToken),
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
