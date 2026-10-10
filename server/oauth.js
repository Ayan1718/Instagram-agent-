const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

let metaAccessToken = null;

const GRAPH_API = "https://graph.facebook.com/v24.0";
const META_CONFIG_ID = "2337933193701778";

// Home page
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="google-site-verification" content="QUKL6_b-IX3u5J9mf9UK1LdRbFvYhN_GuWsMEkN0Wds">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Daily Frame Instagram Agent</title>
</head>
<body>
<h1>Daily Frame Instagram Agent</h1>
<p>Service status: running</p>
<p><a href="/privacy">Privacy Policy</a></p>
<p><a href="/auth/meta/login">Connect to Meta</a></p>
<p><a href="/auth/meta/status">Connection status</a></p>
</body>
</html>`);
});

// Privacy Policy
app.get("/privacy", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy - Daily Frame Agent</title>
</head>
<body>
<h1>Privacy Policy</h1>
<p>Last updated: October 10, 2026</p>
<p>Daily Frame Agent provides Instagram management features through services authorized by the user.</p>
<h2>Information We Access</h2>
<p>Depending on permissions granted, the app may access Facebook Page and Instagram account information, posts, comments, and messages required for its features.</p>
<h2>How Information Is Used</h2>
<p>Information is used to provide and maintain app features. We do not sell personal information.</p>
<h2>Sharing and Security</h2>
<p>Information may be processed by Meta and service providers necessary to operate the app. Reasonable steps are taken to protect information.</p>
<h2>Data Deletion</h2>
<p>You may revoke app permissions through Meta settings. For deletion requests, email ayandevalapur@gmail.com.</p>
<h2>Children's Privacy</h2>
<p>This app is not intended for children under 13.</p>
<h2>Contact</h2>
<p>Email: ayandevalapur@gmail.com</p>
</body>
</html>`);
});

// Meta login
app.get("/auth/meta/login", (req, res) => {
  if (!process.env.META_APP_ID || !process.env.META_REDIRECT_URI) {
    return res.status(500).send(
      "Missing META_APP_ID or META_REDIRECT_URI in Render."
    );
  }

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    redirect_uri: process.env.META_REDIRECT_URI,
    response_type: "code",
    config_id: META_CONFIG_ID
  });

  res.redirect(
    `https://www.facebook.com/v24.0/dialog/oauth?${params.toString()}`
  );
});

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

  if (
    !process.env.META_APP_ID ||
    !process.env.META_APP_SECRET ||
    !process.env.META_REDIRECT_URI
  ) {
    return res.status(500).send(
      "Check META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI in Render."
    );
  }

  try {
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: process.env.META_REDIRECT_URI,
      code
    });

    const response = await fetch(
      `${GRAPH_API}/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      }
    );

    const data = await response.json();

    if (!response.ok || data.error || !data.access_token) {
      console.error(
        "Meta token exchange failed:",
        data.error?.message || "No access token returned"
      );

      return res.status(400).send(
        "Meta token exchange failed. Check Render logs and OAuth settings."
      );
    }

    metaAccessToken = data.access_token;

    console.log("Meta access token received successfully.");

    return res.send(
      "Meta access token received successfully. You can return to Instagram Agent."
    );
  } catch (err) {
    console.error("OAuth callback error:", err.message);
    return res.status(500).send(
      "Server error during Meta token exchange."
    );
  }
});

// Meta Graph API helper
async function metaGet(path, params = {}) {
  if (!metaAccessToken) {
    throw new Error("Meta access token is missing.");
  }

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

// Connection status
app.get("/auth/meta/status", (req, res) => {
  res.json({ connected: Boolean(metaAccessToken) });
});

// Check granted permissions
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
        meta_error: result.data.error || null
      });
    }

    res.json(result.data);
  } catch (err) {
    console.error("Permission lookup error:", err.message);
    res.status(500).json({
      error: "Server error checking permissions."
    });
  }
});

// List Facebook Pages
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
        error: "Could not retrieve Facebook Pages.",
        meta_error: result.data.error || null
      });
    }

    res.json({
      page_count: result.data.data?.length || 0,
      data: result.data.data || [],
      paging: result.data.paging || undefined
    });
  } catch (err) {
    console.error("Facebook Page lookup error:", err.message);
    res.status(500).json({
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
      fields: "id,name,tasks,instagram_business_account"
    });

    if (!result.ok) {
      return res.status(400).json({
        error: "Instagram account lookup failed.",
        meta_error: result.data.error || null
      });
    }

    const pages = result.data.data || [];

    const linkedPages = pages.map(page => ({
      page_id: page.id,
      page_name: page.name,
      tasks: page.tasks || [],
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

    res.json({
      page_count: pages.length,
      linked_instagram_count: instagramAccounts.length,
      pages: linkedPages,
      instagram_accounts: instagramAccounts
    });
  } catch (err) {
    console.error("Instagram lookup error:", err.message);
    res.status(500).json({
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
