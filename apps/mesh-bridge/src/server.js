const http = require("http");
const { execFile } = require("child_process");
const { URL } = require("url");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8080);
const SHARED_SECRET = process.env.MESH_BRIDGE_SHARED_SECRET || "";
const MOCK = ["1", "true", "yes"].includes(String(process.env.MESH_BRIDGE_MOCK || "").toLowerCase());
const MESHCENTRAL_URL = stripTrailingSlash(process.env.MESHCENTRAL_URL || "");
const MESHCENTRAL_PUBLIC_URL = stripTrailingSlash(process.env.MESHCENTRAL_PUBLIC_URL || MESHCENTRAL_URL);
const MESHCENTRAL_ADMIN_USER = process.env.MESHCENTRAL_ADMIN_USER || "";
const MESHCENTRAL_ADMIN_PASS = process.env.MESHCENTRAL_ADMIN_PASS || "";
const MESHCENTRAL_DOMAIN = process.env.MESHCENTRAL_DOMAIN || "";
const MESH_SESSION_TTL_SECONDS = Number(process.env.MESH_SESSION_TTL_SECONDS || 3600);
const MESH_SESSION_URL_TEMPLATE = process.env.MESH_SESSION_URL_TEMPLATE || "";

const mockDevices = [
  {
    node_id: "node/mock-adcetei-001",
    name: "ADCETEI-NOTEBOOK-01",
    group_id: "mesh/mock-adcetei",
    group_name: "ADCETEI",
    online: true,
    operating_system: "Windows 11 Pro",
    ip_address: "192.168.10.41",
    last_seen_at: new Date().toISOString(),
    agent_version: "mock",
  },
  {
    node_id: "node/mock-adcetei-002",
    name: "RECEPCAO-PC-02",
    group_id: "mesh/mock-adcetei",
    group_name: "ADCETEI",
    online: false,
    operating_system: "Windows 10 Pro",
    ip_address: "192.168.10.52",
    last_seen_at: new Date(Date.now() - 86400000).toISOString(),
    agent_version: "mock",
  },
  {
    node_id: "node/mock-segov-003",
    name: "SEGOV-ATENDIMENTO-03",
    group_id: "mesh/mock-segov",
    group_name: "SEGOV",
    online: true,
    operating_system: "Windows 11 Pro",
    ip_address: "192.168.20.33",
    last_seen_at: new Date().toISOString(),
    agent_version: "mock",
  },
];

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        request.destroy();
        reject(new Error("Payload muito grande."));
      }
    });
    request.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("JSON inválido."));
      }
    });
    request.on("error", reject);
  });
}

function timingSafeEquals(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function authorize(request) {
  if (!SHARED_SECRET) return true;
  return timingSafeEquals(request.headers["x-bridge-token"], SHARED_SECRET);
}

function resolveMeshCtrlPath() {
  if (process.env.MESHCTRL_BIN) return process.env.MESHCTRL_BIN;
  try {
    return require.resolve("meshcentral/meshctrl.js", { paths: ["/usr/local/lib/node_modules", process.cwd()] });
  } catch (_) {
    return "meshctrl";
  }
}

function meshCtrlInvocation(command, extraArgs = []) {
  const bin = resolveMeshCtrlPath();
  const args = [command, "--url", MESHCENTRAL_URL, "--loginuser", MESHCENTRAL_ADMIN_USER, "--loginpass", MESHCENTRAL_ADMIN_PASS];
  if (MESHCENTRAL_DOMAIN) args.push("--domain", MESHCENTRAL_DOMAIN);
  const finalArgs = args.concat(extraArgs);
  if (bin.endsWith(".js")) return { command: "node", args: [bin, ...finalArgs] };
  return { command: bin, args: finalArgs };
}

function runMeshCtrl(command, extraArgs = []) {
  if (!MESHCENTRAL_URL || !MESHCENTRAL_ADMIN_USER || !MESHCENTRAL_ADMIN_PASS) {
    return Promise.reject(new Error("Credenciais do MeshCentral não configuradas no Mesh Bridge."));
  }
  return new Promise((resolve, reject) => {
    const invocation = meshCtrlInvocation(command, extraArgs);
    execFile(invocation.command, invocation.args, { timeout: 20000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || stdout || error.message));
      resolve(stdout.trim());
    });
  });
}

function normalizeDevice(raw) {
  const nodeId = raw.node_id || raw.nodeId || raw._id || raw.id || raw.nodeid || "";
  const name = raw.name || raw.rname || raw.host || raw.computerName || "Sem nome";
  const online = Boolean(raw.online || raw.connected || raw.conn || raw.conn === 1 || raw.pwr === 1);
  return {
    node_id: String(nodeId),
    name: String(name),
    group_id: String(raw.group_id || raw.groupId || raw.meshid || raw.meshId || ""),
    group_name: String(raw.group_name || raw.groupName || raw.meshname || raw.meshName || ""),
    online,
    operating_system: String(raw.operating_system || raw.operatingSystem || raw.osdesc || raw.os || ""),
    ip_address: String(raw.ip_address || raw.ipAddress || raw.ip || raw.publicip || ""),
    last_seen_at: raw.last_seen_at || raw.lastSeenAt || raw.lastconnect || raw.lastseen || null,
    agent_version: String(raw.agent_version || raw.agentVersion || raw.agent || raw.agentversion || ""),
  };
}

function flattenMeshCtrlDevices(payload) {
  const parsed = JSON.parse(payload || "[]");
  if (Array.isArray(parsed)) return parsed.map(normalizeDevice).filter((item) => item.node_id);
  if (Array.isArray(parsed.devices)) return parsed.devices.map(normalizeDevice).filter((item) => item.node_id);
  const result = [];
  for (const value of Object.values(parsed)) {
    if (Array.isArray(value)) result.push(...value.map(normalizeDevice));
    else if (value && typeof value === "object" && Array.isArray(value.nodes)) result.push(...value.nodes.map(normalizeDevice));
  }
  return result.filter((item) => item.node_id);
}

async function listDevicesFromMeshCentral() {
  const output = await runMeshCtrl("ListDevices", ["--json"]);
  return flattenMeshCtrlDevices(output);
}

function filterAndPage(devices, searchParams) {
  const search = String(searchParams.get("search") || "").trim().toLowerCase();
  const status = String(searchParams.get("status") || "");
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("page_size") || 20)));
  let filtered = devices;
  if (status === "online") filtered = filtered.filter((item) => item.online);
  if (status === "offline") filtered = filtered.filter((item) => !item.online);
  if (search) {
    filtered = filtered.filter((item) => [item.name, item.group_name, item.group_id, item.ip_address, item.operating_system, item.node_id]
      .join(" ").toLowerCase().includes(search));
  }
  const total = filtered.length;
  const online = filtered.filter((item) => item.online).length;
  const offset = (page - 1) * pageSize;
  return {
    items: filtered.slice(offset, offset + pageSize),
    total,
    page,
    page_size: pageSize,
    summary: { total, online, offline: total - online },
  };
}

function buildTemplateUrl(template, context) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => context[key] || "");
}

async function sessionUrl(payload) {
  const nodeId = String(payload.node_id || "").trim();
  if (!nodeId) throw new Error("node_id é obrigatório.");
  const meshUserId = `portal_${String(payload.user_id || "0")}`;
  if (MESH_SESSION_URL_TEMPLATE) {
    return {
      embed_url: buildTemplateUrl(MESH_SESSION_URL_TEMPLATE, {
        publicUrl: MESHCENTRAL_PUBLIC_URL,
        nodeId: encodeURIComponent(nodeId),
        node_id: encodeURIComponent(nodeId),
        sessionId: encodeURIComponent(payload.session_id || ""),
        session_id: encodeURIComponent(payload.session_id || ""),
        userId: encodeURIComponent(payload.user_id || ""),
        user_id: encodeURIComponent(payload.user_id || ""),
        mode: encodeURIComponent(payload.access_mode || "desktop"),
      }),
      expires_in_seconds: MESH_SESSION_TTL_SECONDS,
      mesh_user_id: meshUserId,
    };
  }
  if (MOCK) {
    const html = encodeURIComponent(`<html><body style="margin:0;background:#0a1f33;color:white;font-family:Arial;display:grid;place-items:center;height:100vh"><div><h2>Sessão MeshCentral simulada</h2><p>${nodeId}</p><p>${payload.reason || ""}</p></div></body></html>`);
    return {
      embed_url: `data:text/html;charset=utf-8,${html}`,
      expires_in_seconds: MESH_SESSION_TTL_SECONDS,
      mesh_user_id: meshUserId,
    };
  }
  // Fallback conservador: abre a página do nó. Para SSO completo, configure MESH_SESSION_URL_TEMPLATE
  // após habilitar login por token/link temporário no MeshCentral da VM.
  return {
    embed_url: `${MESHCENTRAL_PUBLIC_URL}/?node=${encodeURIComponent(nodeId)}&viewmode=10`,
    expires_in_seconds: MESH_SESSION_TTL_SECONDS,
    mesh_user_id: meshUserId,
  };
}

async function route(request, response) {
  if (!authorize(request)) return sendJson(response, 401, { detail: "Mesh Bridge token inválido." });
  const currentUrl = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && currentUrl.pathname === "/health") {
    return sendJson(response, 200, {
      status: "ok",
      mock: MOCK,
      meshcentral_configured: Boolean(MESHCENTRAL_URL || MOCK),
    });
  }

  if (request.method === "GET" && currentUrl.pathname === "/devices") {
    const devices = MOCK ? mockDevices : await listDevicesFromMeshCentral();
    return sendJson(response, 200, filterAndPage(devices, currentUrl.searchParams));
  }

  if (request.method === "GET" && currentUrl.pathname.startsWith("/devices/")) {
    const nodeId = decodeURIComponent(currentUrl.pathname.slice("/devices/".length));
    const devices = MOCK ? mockDevices : await listDevicesFromMeshCentral();
    const device = devices.find((item) => item.node_id === nodeId);
    if (!device) return sendJson(response, 404, { detail: "Dispositivo remoto não encontrado." });
    return sendJson(response, 200, device);
  }

  if (request.method === "POST" && currentUrl.pathname === "/session-url") {
    const payload = await readJson(request);
    const launch = await sessionUrl(payload);
    return sendJson(response, 200, launch);
  }

  return sendJson(response, 404, { detail: "Rota não encontrada." });
}

const server = http.createServer((request, response) => {
  route(request, response).catch((error) => sendJson(response, 500, { detail: error.message || "Erro interno no Mesh Bridge." }));
});

server.listen(PORT, () => {
  console.log(`Mesh Bridge ouvindo na porta ${PORT}. Mock=${MOCK ? "sim" : "não"}`);
});
