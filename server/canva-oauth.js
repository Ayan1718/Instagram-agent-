
const crypto = require("node:crypto");
const {
  initializeCanvaDatabase,
  getCanvaSession,
  saveCanvaSession,
} = require("./canva-db");

const CANVA_AUTHORIZE_URL =
  "https://www.canva.com/api/oauth/authorize";

const CANVA_TOKEN_URL =
  "https://api.canva.com/rest/v1/oauth/token";

function getConfig() {
  const {
    CANVA_CLIENT_ID,
    CANVA_CLIENT_SECRET,
    CANVA_REDIRECT_URI,
  } = process.env;

  if (!CANVA_CLIENT_ID || !CANVA_CLIENT_SECRET ||
      !CANVA_REDIRECT_URI) {
    throw new Error("Canva OAuth environment variables are missing.");
  }

  return {
    clientId: CANVA_CLIENT_ID,
    clientSecret: CANVA_CLIENT_SECRET,
    redirectUri: CANVA_REDIRECT_URI,
  };
}

function base64url(buffer) {
  return buffer.toString("base64url");
}

function registerCanvaOAuth(app) {
  app.get("/auth/canva/login", async (req, res) => {
    try {
      const config = getConfig();
      await initializeCanvaDatabase();

      const state = base64url(crypto.randomBytes(32));
      const verifier = base64url(crypto.randomBytes(32));
      const challenge = base64url(
        crypto.createHash("sha256").update(verifier).digest()
      );

      await saveCanvaSession(state, {
        verifier,
        clientInfo: { status: "pending" },
      });

      const url = new URL(CANVA_AUTHORIZE_URL);
      url.searchParams.set("client_id", config.clientId);
      url.searchParams.set("redirect_uri", config.redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set("code_challenge_method", "S256");

      if (process.env.CANVA_SCOPES) {
        url.searchParams.set("scope", process.env.CANVA_SCOPES);
      }

      return res.redirect(url.toString());
    } catch (error) {
      console.error("Canva login setup failed:", error.message);
      return res.status(500).send(
        "Could not start Canva login. Check the server configuration and logs."
      );
    }
  });

  app.get("/auth/canva/callback", async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).send("Canva authorization was not completed.");
    }

    if (typeof code !== "string" ||
        typeof state !== "string") {
      return res.status(400).send(
        "Canva callback is missing the authorization code or state."
      );
    }

    try {
      const config = getConfig();
      await initializeCanvaDatabase();

      const session = await getCanvaSession(state);

      if (!session || !session.verifier) {
        return res.status(400).send(
          "Canva login session is invalid or expired. Please try again."
        );
      }

      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        code_verifier: session.verifier,
        redirect_uri: config.redirectUri,
      });

      const response = await fetch(CANVA_TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization:
            "Basic " + Buffer.from(
              config.clientId + ":" + config.clientSecret
            ).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      const tokens = await response.json();

      if (!response.ok || !tokens.access_token) {
        console.error(
          "Canva token exchange failed with status:",
          response.status
        );
        return res.status(400).send(
          "Canva token exchange failed. Check the server logs and Canva app settings."
        );
      }

      await saveCanvaSession(state, {
        tokens,
        verifier: null,
        clientInfo: {
          status: "connected",
          connectedAt: new Date().toISOString(),
        },
      });

      return res.send(
        'Canva authorization succeeded and token data was stored securely. ' +
        '<a href="/">Open Dashboard</a>'
      );
    } catch (error) {
      console.error("Canva callback failed:", error.message);
      return res.status(500).send(
        "Canva authorization could not be completed. Check the server logs."
      );
    }
  });
}

module.exports = { registerCanvaOAuth };
