const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

let metaAccessToken = null;

const GRAPH_API = "https://graph.facebook.com/v24.0";

// Home page
app.get("/", (req, res) => {
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="google-site-verification" content="QUKL6_b-IX3u5J9mf9UK1LdRbFvYhN_GuWsMEkN0Wds">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Frame Instagram Agent</title>
</head>
<body>
  <h1>Daily Frame Instagram Agent</h1>
  <p>Service status: running</p>
  <p><a href="/privacy">Privacy Policy</a></p>
</body>
</html>`);
});

// Privacy Policy
app.get("/privacy", (req, res) => {
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - Daily Frame Agent</title>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p>Last updated: October 10, 2026</p>
  <p>Daily Frame Agent provides Instagram management features
  through services authorized by the user.</p>

  <h2>Information We Access</h2>
  <p>Depending on the permissions you grant, the app may access
  Facebook Page and Instagram account information, posts, comments,
  and messages required for its features.</p>

  <h2>How Information Is Used</h2>
  <p>Information is used to provide and maintain the app's features.
  We do not sell personal information.</p>

  <h2>Sharing and Security</h2>
  <p>Information may be processed by Meta and service providers
  necessary to operate the app. We take reasonable steps to protect
  information and retain it only as needed for the stated purposes
  and applicable legal requirements.</p>

  <h2>Your Choices and Data Deletion</h2>
  <p>You may revoke app permissions through your Meta account
  settings. To request deletion of information associated with
  the app, contact us using the email below.</p>

  <h2>Children's Privacy</h2>
  <p>This app is not intended for children under 13.</p>

  <h2>Contact</h2>
  <p>Email: ayandevalapur@gmail.com</p>
</body>
</html>`);
});

// Safely call Meta Graph API
async function metaGet(path, params = {}) {
  const url = new URL(`${GRAPH_API}${path}`);
  url.searchParams.set("access_token", metaAccessToken);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);
  const data = await response.json();

  return {
    ok: response.ok && !data.error,
    status: response.status,
    data
  };
}

// Meta OAuth callback
app.get("/auth/meta/callback", async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(
      `Meta login error: ${error_description || error}`
    );
  }

  if (!code) {
    return res.status(400).send("No authorization code received.");
  }

  try {
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: process.env.META_REDIRECT_URI,
      code
    });

    const response = await fetch(`${GRAPH_API}/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    const data = await response.json();

    if (!response.ok || data.error || !data.access_token) {
      console.error("Meta token exchange failed.");
      return res.status(400).send(
        "Meta token exchange failed. Check Render environment variables and logs."
      );
    }

    metaAccessToken = data.access_token;

    console.log("Meta access token received successfully.");

    return res.send(
      "Meta access token received successfully. You can return to Instagram Agent."
    );
  } catch (err) {
    console.error("OAuth callback error:", err.message);
    return res.status(500).send("Server error during Meta token exchange.");
  }
});

// Meta connection status
app.get("/auth/meta/status", (req, res) => {
  res.json({ connected: Boolean(metaAccessToken) });
});

// Check granted Meta permissions
app.get("/auth/meta/permissions", async (req, res) => {
  if (!metaAccessToken) {
    return res.status(401).json({
      connected: false,
      error: "Not connected to Meta. Authorize first."
    });
  }

  try {
    const result = await metaGet("/me/permissions");

    if (!result.ok) {
      return res.status(400).json({
        error: "Could not retrieve Meta permissions.",
        meta_error: result.data.error
          ? {
              message: result.data.error.message,
              type: result.data.error.type,
              code: result.data.error.code
            }
          : undefined
      });
    }

    return res.json(result.data);
  } catch (err) {
    console.error("Permission lookup error:", err.message);
    return res.status(500).json({
      error: "Server error checking permissions."
    });
  }
});

// List accessible Facebook Pages
app.get("/auth/meta/pages", async (req, res) => {
  if (!metaAccessToken) {
    return res.status(401).json({
      connected: false,
      error: "Not connected to Meta. Authorize first."
    });
  }

  try {
    const result = await metaGet("/me/accounts", {
      fields: "id,name,tasks,instagram_business_account"
    });

    if (!result.ok) {
      return res.status(400).json({
        error: "Meta could not retrieve your Facebook Pages.",
        meta_error: result.data.error
          ? {
              message: result.data.error.message,
              type: result.data.error.type,
              code: result.data.error.code,
              subcode: result.data.error.error_subcode
            }
          : undefined
      });
    }

    return res.json({
      page_count: Array.isArray(result.data.data)
        ? result.data.data.length
        : 0,
      data: result.data.data || [],
      paging: result.data.paging || undefined
    });
  } catch (err) {
    console.error("Facebook Page lookup error:", err.message);
    return res.status(500).json({
      error: "Server error checking Facebook Pages."
    });
  }
});

// Instagram account lookup
app.get("/auth/meta/instagram", async (req, res) => {
  if (!metaAccessToken) {
    return res.status(401).json({
      connected: false,
      error: "Not connected to Meta. Authorize first."
    });
  }

  try {
    const result = await metaGet("/me/accounts", {
      fields: "id,name,instagram_business_account,tasks"
    });

    if (!result.ok) {
      return res.status(400).json({
        error: "Instagram account lookup failed.",
        meta_error: result.data.error
          ? {
              message: result.data.error.message,
              type: result.data.error.type,
              code: result.data.error.code,
              subcode: result.data.error.error_subcode
            }
          : undefined
      });
    }

    const pages = result.data.data || [];

    const linkedPages = pages.map(page => ({
      page_id: page.id,
      page_name: page.name,
      tasks: page.tasks,
      instagram_business_account:
        page.instagram_business_account || null
    }));

    const instagramAccounts = linkedPages
      .filter(page => page.instagram_business_account)
      .map(page => ({
        page_id: page.page_id,
        page_name: page.page_name,
        instagram_business_account: page.instagram_business_account
      }));

    return res.json({
      page_count: pages.length,
      linked_instagram_count: instagramAccounts.length,
      pages: linkedPages,
      instagram_accounts: instagramAccounts
    });
  } catch (err) {
    console.error("Instagram lookup error:", err.message);
    return res.status(500).json({
      error: "Server error during Instagram lookup."
    });
  }
});

// API status
app.get("/api", (req, res) => {
  res.json({
    app: "Daily Frame Instagram Agent",
    server: "online",
    meta_connected: Boolean(metaAccessToken)
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
