const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");

const CANVA_MCP_URL = "https://api.canva.com/connect/v1/mcp";

async function connectCanva(accessToken) {
  if (!accessToken) {
    throw new Error("Canva access token is required.");
  }

  const client = new Client({
    name: "daily-frame-instagram-agent",
    version: "1.0.0",
  });

  const transport = new StreamableHTTPClientTransport(
    new URL(CANVA_MCP_URL),
    {
      requestInit: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );

  await client.connect(transport);
  return client;
}

module.exports = { connectCanva };
