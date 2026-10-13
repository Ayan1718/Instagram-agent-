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

async function listCanvaTools(accessToken) {
  const client = await connectCanva(accessToken);
  try {
    const result = await client.listTools();
    return result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  } finally {
    await client.close();
  }
}

async function getCanvaToolSchema(accessToken, name) {
  const client = await connectCanva(accessToken);
  try {
    const result = await client.listTools();
    const tool = result.tools.find((item) => item.name === name);
    if (!tool) return null;
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    };
  } finally {
    await client.close();
  }
}

async function callCanvaTool(accessToken, name, args = {}) {
  const client = await connectCanva(accessToken);
  try { return await client.callTool({ name, arguments: args }); }
  finally { await client.close(); }
}

module.exports = { connectCanva, listCanvaTools, callCanvaTool, getCanvaToolSchema };
