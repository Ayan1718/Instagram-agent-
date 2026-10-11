const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const cloudinary = require("cloudinary").v2;

const app = express();
const PORT = process.env.PORT || 3000;

const gemini = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

function validAgentSecret(req) {
  const expected = process.env.AGENT_CRON_SECRET;
  const supplied = req.get("authorization") || "";
  return Boolean(expected && supplied === `Bearer ${expected}`);
}


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
body{font-family:Arial;background:#10121a;color:#fff;margin:0;padding:20px}
main{max-width:700px;margin:auto}
h1{color:#c9a7ff}
.card{background:#1d2030;padding:18px;border-radius:14px;margin:14px 0}
a,button{display:inline-block;background:#805ad5;color:white;padding:12px 16px;border:0;border-radius:8px;text-decoration:none;margin:5px 0;cursor:pointer}
input,textarea{box-sizing:border-box;width:100%;padding:12px;margin:8px 0;background:#10121a;color:white;border:1px solid #555;border-radius:8px}
textarea{min-height:110px}
button{font-size:16px}
.small{color:#bdbdcc;font-size:13px}
</style>
</head>
<body>
<main>
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
<h2>AI Draft Tester</h2>
<p class="small">Generate a draft for review. Nothing is published.</p>
<label for="agentSecret">Agent Secret</label>
<input id="agentSecret" type="password" autocomplete="off" placeholder="Enter AGENT_CRON_SECRET">
<label for="draftType">Content type</label>
<select id="draftType" style="width:100%;padding:12px;margin:8px 0;background:#10121a;color:white;border:1px solid #555;border-radius:8px">
<option value="india">India top news draft</option>
<option value="news">World news draft</option>
<option value="fact">Interesting fact draft</option>
</select>
<button type="button" id="draftButton">Generate Draft</button>
<p id="draftStatus" role="status"></p>
<div id="draftPreview" style="white-space:pre-wrap;overflow-wrap:anywhere"></div>
</div>

<div class="card">
<h2>Publish a Photo</h2>
<p class="small">Enter a publicly accessible HTTPS image URL and your caption.</p>
<form id="publishForm">
<label for="imageUrl">Public image URL</label>
<input id="imageUrl" name="imageUrl" type="url"
placeholder="https://example.com/photo.jpg" required>

<label for="caption">Caption</label>
<textarea id="caption" name="caption"
placeholder="Write your Instagram caption..." maxlength="2200"></textarea>

<button type="submit" id="publishButton">Publish Photo</button>
</form>
<p id="publishResult" role="status"></p>
</div>

<div class="card">
<a href="/privacy">Privacy Policy</a>
</div>
</main>

<script>
fetch('/auth/meta/status')
.then(r => r.json())
.then(d => document.getElementById('status').textContent =
d.connected ? 'Meta connection: Connected' : 'Meta connection: Not connected')
.catch(() => document.getElementById('status').textContent =
'Unable to check connection');

document.getElementById('publishForm').addEventListener('submit', async e => {
  e.preventDefault();

  const button = document.getElementById('publishButton');
  const result = document.getElementById('publishResult');

  button.disabled = true;
  button.textContent = 'Publishing...';
  result.textContent = 'Please wait. Do not close this page.';

  try {
    const response = await fetch('/api/instagram/publish-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: document.getElementById('imageUrl').value.trim(),
        caption: document.getElementById('caption').value.trim()
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Publishing failed.');
    }

    result.textContent = 'Published successfully! Media ID: ' + data.id;
  } catch (err) {
    result.textContent = 'Error: ' + err.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Publish Photo';
  }
});
document.getElementById('draftButton').addEventListener('click', async () => {
  const secretInput = document.getElementById('agentSecret');
  const button = document.getElementById('draftButton');
  const status = document.getElementById('draftStatus');
  const preview = document.getElementById('draftPreview');
  const secret = secretInput.value.trim();
  preview.textContent = '';

  if (!secret) {
    status.textContent = 'Enter your agent secret first.';
    return;
  }

  button.disabled = true;
  button.textContent = 'Generating...';
  status.textContent = 'Generating draft. Please wait.';

  try {
    const response = await fetch('/api/agent/draft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + secret
      },
      body: JSON.stringify({ type: document.getElementById('draftType').value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Draft generation failed.');

    const d = data.draft || {};
    preview.textContent = 'HEADLINE\\n' + (d.headline || '') +
      '\\n\\nCAPTION\\n' + (d.caption || '') +
      '\\n\\nIMAGE PROMPT\\n' + (d.image_prompt || '') +
      '\\n\\nFACT-CHECK NOTE\\n' + (d.fact_check_note || '');
    status.textContent = 'Draft generated. Review it before use. Nothing was published.';
    secretInput.value = '';
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Generate Draft';
  }
});

</script>
</body>
</html>`);
});

// Privacy Policy
app.get("/privacy", (req, res) => {
  res.send(`<h1>Privacy Policy</h1>
<p>Daily Frame Instagram Agent provides features through services authorized by users.</p>
<h2>Information</h2>
<p>The app may access Facebook Page and Instagram account information and content required for requested features.</p>
<h2>Use</h2>
<p>Information is used to provide app features and is not sold.</p>
<h2>Data deletion</h2>
<p>Revoke permissions in Meta settings or contact ayandevalapur@gmail.com for deletion requests.</p>
<h2>Contact</h2><p>ayandevalapur@gmail.com</p>`);
});

// Meta Login
app.get("/auth/meta/login", (req, res) => {
  if (
    !process.env.META_APP_ID ||
    !process.env.META_APP_SECRET ||
    !process.env.META_REDIRECT_URI
  ) {
    return res.status(500).send(
      "Check META_APP_ID, META_APP_SECRET and META_REDIRECT_URI in Render."
    );
  }

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    redirect_uri: process.env.META_REDIRECT_URI,
    response_type: "code",
    config_id: CONFIG_ID
  });

  res.redirect(
    "https://www.facebook.com/v24.0/dialog/oauth?" + params.toString()
  );
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
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    const data = await response.json();

    if (!response.ok || !data.access_token) {
      console.error("Meta token exchange failed:", data.error?.message);
      return res.status(400).send(
        "Meta token exchange failed. Check Render logs."
      );
    }

    metaAccessToken = data.access_token;

    console.log("Meta access token received successfully.");

    res.send(
      'Meta access token received successfully. <a href="/">Open Dashboard</a>'
    );
  } catch (err) {
    console.error("Meta callback error:", err.message);
    res.status(500).send("Server error during Meta login.");
  }
});

// Meta GET helper
async function metaGet(path, params = {}) {
  if (!metaAccessToken) {
    throw new Error("Not connected to Meta. Reconnect first.");
  }

  const url = new URL(GRAPH_API + path);
  url.searchParams.set("access_token", metaAccessToken);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url);
  const data = await response.json();

  return {
    ok: response.ok && !data.error,
    status: response.status,
    data
  };
}

// Meta POST helper
async function metaPost(path, params = {}) {
  if (!metaAccessToken) {
    throw new Error("Not connected to Meta. Reconnect first.");
  }

  const body = new URLSearchParams({
    access_token: metaAccessToken
  });

  for (const [key, value] of Object.entries(params)) {
    body.set(key, String(value));
  }

  const response = await fetch(GRAPH_API + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

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

// Permissions
app.get("/auth/meta/permissions", async (req, res) => {
  if (!metaAccessToken) {
    return res.status(401).json({
      connected: false,
      error: "Reconnect to Meta first."
    });
  }

  try {
    const result = await metaGet("/me/permissions");
    res.status(result.ok ? 200 : 400).json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Facebook Pages
app.get("/auth/meta/pages", async (req, res) => {
  if (!metaAccessToken) {
    return res.status(401).json({
      connected: false,
      error: "Reconnect to Meta first."
    });
  }

  try {
    const result = await metaGet("/me/accounts", {
      fields: "id,name,tasks,instagram_business_account"
    });

    res.status(result.ok ? 200 : 400).json(result.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Instagram account lookup
app.get("/auth/meta/instagram", async (req, res) => {
  if (!metaAccessToken) {
    return res.status(401).json({
      connected: false,
      error: "Reconnect to Meta first."
    });
  }

  try {
    const result = await metaGet("/me/accounts", {
      fields: "id,name,tasks,instagram_business_account"
    });

    if (!result.ok) {
      return res.status(400).json({
        error: result.data.error || "Instagram lookup failed."
      });
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
    res.status(500).json({ error: err.message });
  }
});

// Publish an Instagram photo
app.post("/api/instagram/publish-photo", async (req, res) => {
  if (!metaAccessToken) {
    return res.status(401).json({
      error: "Meta is not connected. Tap Connect / Reconnect Meta first."
    });
  }

  const imageUrl = String(req.body.imageUrl || "").trim();
  const caption = String(req.body.caption || "").trim();

  if (!imageUrl) {
    return res.status(400).json({
      error: "Please enter a public image URL."
    });
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return res.status(400).json({ error: "The image URL is invalid." });
  }

  if (parsedUrl.protocol !== "https:") {
    return res.status(400).json({
      error: "The image URL must start with https://."
    });
  }

  if (caption.length > 2200) {
    return res.status(400).json({
      error: "The caption must be 2,200 characters or fewer."
    });
  }

  try {
    // Step 1: Ask Instagram to prepare the image.
    const container = await metaPost("/" + IG_ID + "/media", {
      image_url: imageUrl,
      caption
    });

    if (!container.ok || !container.data.id) {
      console.error("Instagram container error:", container.data.error);
      return res.status(400).json({
        error: container.data.error?.message ||
          "Instagram could not prepare this image."
      });
    }

    const creationId = container.data.id;

    // Step 2: Wait for Instagram to finish processing the image.
    let ready = false;

    for (let attempt = 0; attempt < 12; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2500));

      const status = await metaGet("/" + creationId, {
        fields: "status_code,status"
      });

      if (!status.ok) {
        return res.status(400).json({
          error: status.data.error?.message ||
            "Could not check image processing status."
        });
      }

      if (status.data.status_code === "FINISHED") {
        ready = true;
        break;
      }

      if (status.data.status_code === "ERROR" ||
          status.data.status_code === "EXPIRED") {
        return res.status(400).json({
          error: status.data.status || "Instagram image processing failed."
        });
      }
    }

    if (!ready) {
      return res.status(408).json({
        error: "Instagram is still processing the image. Please try again later."
      });
    }

    // Step 3: Publish the prepared image.
    const published = await metaPost("/" + IG_ID + "/media_publish", {
      creation_id: creationId
    });

    if (!published.ok || !published.data.id) {
      console.error("Instagram publish error:", published.data.error);
      return res.status(400).json({
        error: published.data.error?.message ||
          "Instagram could not publish the photo."
      });
    }

    console.log("Instagram photo published:", published.data.id);

    res.json({
      success: true,
      message: "Instagram photo published successfully.",
      id: published.data.id
    });
  } catch (err) {
    console.error("Instagram publishing error:", err.message);
    res.status(500).json({
      error: err.message || "Unexpected publishing error."
    });
  }
});


// Protected AI content draft endpoint. Draft only; never publishes.
app.post("/api/agent/draft", async (req, res) => {
    if (!validAgentSecret(req)) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    if (!gemini) {
        return res.status(503).json({ error: "Gemini is not configured." });
    }

    try {
        const requestedType = req.body?.type;
        const topicType = requestedType === "fact" ? "interesting fact" :
            requestedType === "india" ? "top India news" : "world news";
        const regionInstruction = requestedType === "india"
            ? "Focus on important developments in India."
            : requestedType === "news"
                ? "Focus on important international developments."
                : "Focus on well-established, interesting facts.";
        const response = await gemini.models.generateContent({
            model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
            contents: `Create one Instagram ${topicType} draft for Daily Frame. ${regionInstruction} Return valid JSON only with keys: headline, caption, image_prompt, fact_check_note. Make it engaging and concise. Never invent breaking news, dates, quotes, statistics, or sources. You do not have live news verification in this request, so clearly state in fact_check_note that news claims and dates must be checked against current reliable sources before publication. For facts, use well-established information and avoid dubious claims.`,
            config: {
                responseMimeType: "application/json",
                temperature: 0.7
            }
        });

        const draft = JSON.parse(response.text || "{}");
        return res.json({
            success: true,
            published: false,
            type: topicType,
            draft
        });
    } catch (err) {
        console.error("Gemini draft error:", err.message);
        return res.status(500).json({ error: "Could not generate draft." });
    }
});

// AI configuration status (never exposes secret values)
app.get("/api/ai/status", (req, res) => {
    res.json({
        gemini_configured: Boolean(process.env.GEMINI_API_KEY && gemini),
        cloudinary_configured: Boolean(
            process.env.CLOUDINARY_CLOUD_NAME &&
            process.env.CLOUDINARY_API_KEY &&
            process.env.CLOUDINARY_API_SECRET
        ),
        auto_publishing_enabled: false
    });
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
