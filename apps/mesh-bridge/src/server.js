const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const PORT = Number(process.env.PORT || 8080);
const MOCK = String(process.env.MESH_BRIDGE_MOCK || "false").toLowerCase() === "true";
const SHARED_SECRET = process.env.MESH_BRIDGE_SHARED_SECRET || "";
const MESHCENTRAL_URL = process.env.MESHCENTRAL_URL || "";
const MESHCENTRAL_PUBLIC_URL =
  process.env.MESHCENTRAL_PUBLIC_URL || MESHCENTRAL_URL.replace(/^wss:/i, "https:");
const MESHCENTRAL_ADMIN_USER = process.env.MESHCENTRAL_ADMIN_USER || "";
const MESHCENTRAL_ADMIN_PASS = process.env.MESHCENTRAL_ADMIN_PASS || "";
const MESHCENTRAL_DOMAIN = process.env.MESHCENTRAL_DOMAIN || "";
const MESH_SESSION_URL_TEMPLATE =
  process.env.MESH_SESSION_URL_TEMPLATE || "{publicUrl}/?node={nodeId}&viewmode=10";
const MESH_SESSION_TTL_SECONDS = Number(process.env.MESH_SESSION_TTL_SECONDS || 3600);
const MESHCTRL_PATH = "/usr/local/lib/node_modules/meshcentral/meshctrl.js";

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function authorize(request) {
  if (!SHARED_SECRET) return true;
  return request.headers["x-bridge-token"] === SHARED_SECRET;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) request.destroy();
    });
    request.on("end", () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("JSON inválido no corpo da requisição."));
      }
    });
    request.on("error", reject);
  });
}

function asNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asString(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function mapNode(raw) {
  if (!raw || typeof raw !== "object") return null;

  const nodeId = asString(raw._id || raw.id).trim();
  if (!nodeId.startsWith("node/")) return null;

  const conn = asNumber(raw.conn) || 0;
  const pwr = asNumber(raw.pwr) || 0;
  const agent = raw.agent && typeof raw.agent === "object" ? raw.agent : {};
  const agentVersion = agent.ver === null || agent.ver === undefined ? "" : String(agent.ver);
  const lastSeen = asNumber(raw.lastconnect) ?? asNumber(raw.agct);

  return {
    node_id: nodeId,
    name: asString(raw.name || raw.rname || "Sem nome").trim() || "Sem nome",
    group_id: asString(raw.meshid || raw.group_id).trim(),
    group_name: asString(raw.groupname || raw.group_name).trim(),
    online: conn > 0 || pwr > 0,
    operating_system: asString(raw.osdesc || raw.operating_system).trim(),
    ip_address: asString(raw.ip || raw.host || raw.ip_address).trim(),
    last_seen_at: lastSeen,
    agent_version: agentVersion,
  };
}

function decodeMeshString(value) {
  if (!value) return "";
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return String(value).replace(/\\\\/g, "\\");
  }
}

function getStringField(block, field) {
  const pattern = new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`);
  const match = block.match(pattern);
  return match ? decodeMeshString(match[1]) : "";
}

function getNumberField(block, field) {
  const pattern = new RegExp(`"${field}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`);
  const match = block.match(pattern);
  return match ? Number(match[1]) : null;
}

function getAgentVersionFromBlock(block) {
  const agentMatch = block.match(/"agent"\s*:\s*\{([\s\S]*?)\}/);
  if (!agentMatch) return "";
  const ver = getNumberField(agentMatch[1], "ver");
  return ver === null ? "" : String(ver);
}

function extractNodeBlocks(payload) {
  const raw = String(payload || "");
  const blocks = [];
  const starter = /\{\s*"type"\s*:\s*"node"/g;
  let match;

  while ((match = starter.exec(raw)) !== null) {
    const start = match.index;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < raw.length; index += 1) {
      const char = raw[index];

      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;

      if (depth === 0) {
        blocks.push(raw.slice(start, index + 1));
        starter.lastIndex = index + 1;
        break;
      }
    }
  }

  return blocks;
}

function mapNodeFromBlock(block) {
  const nodeId = getStringField(block, "_id");
  if (!nodeId.startsWith("node/")) return null;

  const conn = getNumberField(block, "conn") || 0;
  const pwr = getNumberField(block, "pwr") || 0;
  const lastSeen = getNumberField(block, "lastconnect") ?? getNumberField(block, "agct");

  return {
    node_id: nodeId,
    name: getStringField(block, "name") || getStringField(block, "rname") || "Sem nome",
    group_id: getStringField(block, "meshid"),
    group_name: getStringField(block, "groupname"),
    online: conn > 0 || pwr > 0,
    operating_system: getStringField(block, "osdesc"),
    ip_address: getStringField(block, "ip") || getStringField(block, "host"),
    last_seen_at: lastSeen,
    agent_version: getAgentVersionFromBlock(block),
  };
}

function collectNodes(nodes) {
  const unique = new Map();

  for (const device of nodes) {
    if (!device || !device.node_id) continue;
    const previous = unique.get(device.node_id);
    if (!previous) {
      unique.set(device.node_id, device);
      continue;
    }

    unique.set(device.node_id, {
      ...previous,
      ...Object.fromEntries(
        Object.entries(device).filter(([, value]) => value !== "" && value !== null && value !== undefined)
      ),
      online: Boolean(previous.online || device.online),
    });
  }

  return [...unique.values()];
}

function collectNodesFromParsedJson(parsed) {
  const candidates = [];

  if (Array.isArray(parsed)) {
    candidates.push(...parsed);
  } else if (parsed && typeof parsed === "object") {
    for (const key of ["nodes", "devices", "items", "result"]) {
      if (Array.isArray(parsed[key])) candidates.push(...parsed[key]);
    }
    if (parsed.type === "node" || parsed._id) candidates.push(parsed);
  }

  return collectNodes(candidates.map(mapNode).filter(Boolean));
}

function collectNodesFromRawText(payload) {
  return collectNodes(extractNodeBlocks(payload).map(mapNodeFromBlock).filter(Boolean));
}

function parseDevicesFromMeshCtrl(payload) {
  const raw = String(payload || "").trim();
  if (!raw) return [];

  try {
    return collectNodesFromParsedJson(JSON.parse(raw));
  } catch {
    return collectNodesFromRawText(raw);
  }
}

function mockDevices() {
  return [
    {
      node_id: "node//mock-adcetei-01",
      name: "ADCETEI-NOTEBOOK-01",
      group_id: "mesh//mock",
      group_name: "ADCETEI",
      online: true,
      operating_system: "Windows 11 Pro",
      ip_address: "192.168.10.50",
      last_seen_at: Date.now(),
      agent_version: "mock",
    },
    {
      node_id: "node//mock-recepcao-02",
      name: "RECEPCAO-PC-02",
      group_id: "mesh//mock",
      group_name: "ADCETEI",
      online: false,
      operating_system: "Windows 10 Pro",
      ip_address: "192.168.10.60",
      last_seen_at: null,
      agent_version: "mock",
    },
  ];
}

function cleanupTempFiles(...files) {
  for (const file of files) {
    try {
      if (file) fs.unlinkSync(file);
    } catch {
      // ignore cleanup errors
    }
  }
}

function runMeshCtrl(command, args = []) {
  return new Promise((resolve, reject) => {
    if (!MESHCENTRAL_URL || !MESHCENTRAL_ADMIN_USER || !MESHCENTRAL_ADMIN_PASS) {
      return reject(new Error("MeshCentral não configurado no mesh-bridge."));
    }

    const stamp = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const stdoutPath = path.join(os.tmpdir(), `meshctrl-out-${stamp}.json`);
    const stderrPath = path.join(os.tmpdir(), `meshctrl-err-${stamp}.log`);
    let stdoutFd;
    let stderrFd;

    try {
      stdoutFd = fs.openSync(stdoutPath, "w");
      stderrFd = fs.openSync(stderrPath, "w");
    } catch (error) {
      cleanupTempFiles(stdoutPath, stderrPath);
      return reject(error);
    }

    const meshArgs = [
      MESHCTRL_PATH,
      command,
      "--url",
      MESHCENTRAL_URL,
      "--loginuser",
      MESHCENTRAL_ADMIN_USER,
      "--loginpass",
      MESHCENTRAL_ADMIN_PASS,
    ];
    if (MESHCENTRAL_DOMAIN) meshArgs.push("--domain", MESHCENTRAL_DOMAIN);
    meshArgs.push(...args);

    const child = spawn(
      "node",
      meshArgs,
      {
        stdio: ["ignore", stdoutFd, stderrFd],
        env: {
          ...process.env,
          NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED || "0",
        },
      }
    );

    const closeFd = (fd) => {
      if (fd === undefined) return;
      try {
        fs.closeSync(fd);
      } catch {
        // already closed
      }
    };

    child.on("error", (error) => {
      closeFd(stdoutFd);
      closeFd(stderrFd);
      cleanupTempFiles(stdoutPath, stderrPath);
      reject(error);
    });

    child.on("close", (code) => {
      closeFd(stdoutFd);
      closeFd(stderrFd);

      let stdout = "";
      let stderr = "";
      try {
        stdout = fs.readFileSync(stdoutPath, "utf8");
        stderr = fs.readFileSync(stderrPath, "utf8");
      } catch (error) {
        cleanupTempFiles(stdoutPath, stderrPath);
        return reject(error);
      }

      cleanupTempFiles(stdoutPath, stderrPath);

      if (code !== 0) {
        return reject(new Error((stderr || stdout || `meshctrl saiu com código ${code}`).trim()));
      }
      resolve(stdout);
    });
  });
}

async function listDevicesFromMeshCentral() {
  if (MOCK) return mockDevices();
  const output = await runMeshCtrl("listdevices", ["--json"]);
  return parseDevicesFromMeshCtrl(output);
}

function filterAndPaginate(devices, url) {
  const search = (url.searchParams.get("q") || url.searchParams.get("search") || "").toLowerCase().trim();
  const onlineParam = (url.searchParams.get("online") || "").toLowerCase();
  const statusParam = (url.searchParams.get("status") || "").toLowerCase();
  const page = Math.max(Number(url.searchParams.get("page") || 1), 1);
  const pageSize = Math.min(Math.max(Number(url.searchParams.get("page_size") || 25), 1), 100);

  let filtered = devices;

  if (search) {
    filtered = filtered.filter((device) =>
      [device.name, device.group_name, device.ip_address, device.operating_system]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }

  const onlineFilter =
    onlineParam === "true" || statusParam === "online"
      ? true
      : onlineParam === "false" || statusParam === "offline"
        ? false
        : null;

  if (onlineFilter === true) filtered = filtered.filter((device) => device.online);
  if (onlineFilter === false) filtered = filtered.filter((device) => !device.online);

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);
  const onlineCount = devices.filter((device) => device.online).length;

  return {
    items,
    total,
    page,
    page_size: pageSize,
    summary: {
      total: devices.length,
      online: onlineCount,
      offline: devices.length - onlineCount,
    },
  };
}

function buildSessionUrl(nodeId) {
  const encodedNodeId = encodeURIComponent(nodeId);
  return MESH_SESSION_URL_TEMPLATE.replaceAll("{publicUrl}", MESHCENTRAL_PUBLIC_URL.replace(/\/$/, "")).replaceAll(
    "{nodeId}",
    encodedNodeId
  );
}

async function route(request, response) {
  const currentUrl = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && currentUrl.pathname === "/health") {
    return sendJson(response, 200, {
      status: "ok",
      mock: MOCK,
      meshcentral_configured: Boolean(MOCK || MESHCENTRAL_URL),
    });
  }

  if (!authorize(request)) {
    return sendJson(response, 401, { detail: "Mesh Bridge token inválido." });
  }

  if (request.method === "GET" && currentUrl.pathname === "/devices") {
    const devices = await listDevicesFromMeshCentral();
    return sendJson(response, 200, filterAndPaginate(devices, currentUrl));
  }

  if (request.method === "GET" && currentUrl.pathname.startsWith("/devices/")) {
    const nodeId = decodeURIComponent(currentUrl.pathname.replace("/devices/", ""));
    const devices = await listDevicesFromMeshCentral();
    const device = devices.find((item) => item.node_id === nodeId);
    if (!device) return sendJson(response, 404, { detail: "Dispositivo não encontrado." });
    return sendJson(response, 200, device);
  }

  if (request.method === "POST" && currentUrl.pathname === "/session-url") {
    const body = await readBody(request);
    const nodeId = body.node_id || body.nodeId;
    if (!nodeId) return sendJson(response, 422, { detail: "node_id é obrigatório." });

    const url = buildSessionUrl(String(nodeId));
    return sendJson(response, 200, {
      url,
      session_url: url,
      expires_in: MESH_SESSION_TTL_SECONDS,
      expires_in_seconds: MESH_SESSION_TTL_SECONDS,
    });
  }

  if (request.method === "POST" && currentUrl.pathname === "/users/sync") {
    return sendJson(response, 200, { status: "ok", synced: false });
  }

  return sendJson(response, 404, { detail: "Rota não encontrada." });
}

const server = http.createServer((request, response) => {
  route(request, response).catch((error) => {
    console.error(error);
    sendJson(response, 500, { detail: error.message || "Erro interno no Mesh Bridge." });
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Mesh Bridge ouvindo na porta ${PORT}. Mock=${MOCK ? "sim" : "não"}`);
});
