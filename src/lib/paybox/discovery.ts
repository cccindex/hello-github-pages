const MCP_URL = "https://api.paybox.sh/mcp";
const RESOURCE_METADATA_URL = "https://api.paybox.sh/.well-known/oauth-protected-resource";
const AUTH_METADATA_URL = "https://api.paybox.sh/.well-known/oauth-authorization-server";

export async function discoverPaybox() {
  const [resourceResponse, authResponse, mcpResponse] = await Promise.all([
    fetch(RESOURCE_METADATA_URL, { cache: "no-store" }),
    fetch(AUTH_METADATA_URL, { cache: "no-store" }),
    fetch(MCP_URL, { cache: "no-store" }),
  ]);

  const resource = resourceResponse.ok ? await resourceResponse.json() : null;
  const authorizationServer = authResponse.ok ? await authResponse.json() : null;
  const mcpBody = await mcpResponse.json().catch(() => null);

  return {
    checkedAt: new Date().toISOString(),
    endpoint: MCP_URL,
    endpointStatus: mcpResponse.status,
    endpointResponse: mcpBody,
    resource,
    authorizationServer,
    authenticatedToolsDiscovered: false,
    blocker:
      "OAuth discovery is available, but an authenticated user session is required before tools/list can be inspected.",
  };
}
