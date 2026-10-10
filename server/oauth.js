const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

let metaAccessToken = null;

const GRAPH_API = "https://graph.facebook.com/v24.0";
const CONFIG_ID = "2337933193701778";
const PAGE_ID = "1309773125563524";
const IG_ID = "17841425938237273";

// Dashboard
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Daily Frame Instagram Agent</title>
<style>
body{font-family:Arial;background:#10121a;color:#fff;margin:0;padding:24px}
main{max-width:700px;margin:auto}
h1{color:#c9a7ff}
.card{background:#1d2030;padding:18px;border-radius:14px;margin:14px 0}
a,button{display:inline-block;background:#805ad5;color:white;padding:12px 16px;border:0;border-radius:8px;text-decoration:none;margin:5px 0}
p{color:#d6d6e0}
</style>
</head>
<body><main>
<h1>Daily Frame</h1>
<p>Instagram Agent Dashboard</p>
<div class="card">
<h2>Account Connection</h2>
<p>Facebook Page: Daily Frame</p>
<p>Instagram: @the.daily.frame17</p>
<p>Instagram ID: ${IG_ID}</p>
<p id="status">Checking Meta connection...</p>
<a href="/auth/meta/login">Connect / Reconnect Meta</a>
</div>
<div class="card">
<h2>Instagram Tools</h2>
<a href="/auth/meta/instagram">Check Instagram Account</a><br>
<a href="/auth/meta/pages">Check Facebook Pages</a><br>
<a href="/auth/meta/permissions">Check Permissions</a>
</div>
<div class="card">
<h2>Publishing</h2>
<p>Publishing tools will be added after the dashboard connection is verified.</p>
</div>
<div class="card"><a href="/privacy">Privacy Policy</a></div>
</main>
<script>
fetch('/auth/meta/status')
.then(r=>r.json())
.then(d=>document.getElementById('status').textContent =
d.connected ? 'Meta connection: Connected' : 'Meta connection: Not connected')
.catch(()=>document.getElementById('status').textContent='Unable to check connection');
</script>
</body></html>`);
});

// Privacy Policy
app.get("/privacy", (req, res) => {
  res.send(`<h1>Privacy Policy</h1>
<p>Daily Frame Instagram Agent provides features through services authorized by users.</p>
<h2>Information</h2>
<p>Depending on permissions, the app may access Page and Instagram account information, posts, comments, and messages.</p>
<h2>Use</h2>
<p>Information is used to provide app features and is not sold.</p>
<h2>Data deletion</h2>
<p>Revoke permissions in Meta settings or contact ayandevalapur@gmail.com for deletion requests.</p>
<h2>Contact</h2><p>ayandevalapur@gmail.com</p>`);
});

// Meta Login
app.get("/auth/meta/login", (req, res) => {
  if (!process.env.META_APP_ID || !process.env.META_REDIRECT_URI) {
    return res.status(500).send("Check Meta environment variables in Render.");
  }

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    redirect_uri: process.env.META_REDIRECT_URI,
    response_type: "code",
    config_id: CONFIG_ID
  });

  res.redirect("https://www.facebook.com/v24.0/dialog/oauth?" + params);
});

// Meta OAuth Callback
app.get("/auth/meta/callback", async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(String(error_description || error));
  }
  if (!code) {
    return res.status(400).send("No authorization code received.");
  }

  try {
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: process.env.META_REDIRECT_URI,
      code: String(code)
    });

    const response = await fetch(GRAPH_API + "/oauth/access_token", {
      method: "POST",
      headers: {"Content-Type": "application/x-www-form-urlencoded"},
      body: params.toString()
    });

    const data = await response.json();

    if (!response.ok || !data.access_token) {
      console.error("Meta token exchange failed:", data.error?.message);
      return res.status(400).send("Meta token exchange failed. Check Render logs.");
    }

    metaAccessToken = data.access_token;
    console.log("Meta access token received successfully.");
    res.send('Meta access token received successfully. <a href="/">Open Dashboard</a>');
  } catch (err) {
    console.error("Meta callback error:", err.message);
    res.status(500).send("Server error during Meta login.");
  }
});

// Meta API helper
async function metaGet(path, params = {}) {
  if (!metaAccessToken) {
    throw new Error("Not connected to Meta. Reconnect first.");
  }

  const url = new URL(GRAPH_API + path);
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
  res.json({connected: Boolean(metaAccessToken)});
});

// Permissions
app.get("/auth/meta/permissions", async (req, res) => {
  if (!metaAccessToken) {
    return res.status(401).json({connected: false, error: "Reconnect to Meta first."});
  }

  try {
    const result = await metaGet("/me/permissions");
    res.status(result.ok ? 200 : 400).json(result.data);
  } catch (err) {
    res.status(500).json({error: err.message});
  }
});

// Facebook Pages
app.get("/auth/meta/pages", async (req, res) => {
  if (!metaAccessToken) {
    return res.status(401).json({connected: false, error: "Reconnect to Meta first."});
  }

  try {
    const result = await metaGet("/me/accounts", {
      fields: "id,name,tasks,instagram_business_account"
    });
    res.status(result.ok ? 200 : 400).json(result.data);
  } catch (err) {
    res.status(500).json({error: err.message});
  }
});

// Instagram account lookup
app.get("/auth/meta/instagram", async (req, res) => {
  if (!metaAccessToken) {
    return res.status(401).json({connected: false, error: "Reconnect to Meta first."});
  }

  try {
    const result = await metaGet("/me/accounts", {
      fields: "id,name,tasks,instagram_business_account"
    });

    if (!result.ok) {
      return res.status(400).json({error: result.data.error || "Instagram lookup failed."});
    }

    const pages = result.data.data || [];
    const accounts = pages
      .filter(p => p.instagram_business_account)
      .map(p => ({
        page_id: p.id,
        page_name: p.name,
        instagram_business_account: p.instagram_business_account
      }));

    res.json({
      page_count: pages.length,
      linked_instagram_count: accounts.length,
      pages,
      instagram_accounts: accounts
    });
  } catch (err) {
    res.status(500).json({error: err.message});
  }
});

// API status
app.get("/api", (req, res) => {
  res.json({
    app: "Daily Frame Instagram Agent",
    server: "online",
    meta_connected: Boolean(metaAccessToken),
    page_id: PAGE_ID,
    instagram_id: IG_ID
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});
