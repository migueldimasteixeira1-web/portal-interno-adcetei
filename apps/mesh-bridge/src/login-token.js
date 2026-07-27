const crypto = require("crypto");

function encodeLoginToken(userId, keyHex, expireMinutes = 60) {
  if (!userId || typeof userId !== "string") {
    throw new Error("userId inválido para login token.");
  }
  if (!keyHex || typeof keyHex !== "string") {
    throw new Error("MESHCENTRAL_LOGIN_TOKEN_KEY não configurada.");
  }

  const key = Buffer.from(keyHex.trim(), "hex");
  if (key.length < 32) {
    throw new Error("MESHCENTRAL_LOGIN_TOKEN_KEY inválida (esperado hex de pelo menos 32 bytes).");
  }

  const payload = {
    u: userId,
    a: 3,
    time: Math.floor(Date.now() / 1000),
  };
  if (Number.isFinite(expireMinutes) && expireMinutes > 0) {
    payload.expire = Math.ceil(expireMinutes);
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key.subarray(0, 32), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const encoding = String(process.env.MESHCENTRAL_COOKIE_ENCODING || "base64").toLowerCase();
  const raw =
    encoding === "hex"
      ? Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("hex")
      : Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");

  return encoding === "hex" ? raw : raw.replace(/\+/g, "@").replace(/\//g, "$");
}

function resolveMeshUserId(adminUser, domain = "") {
  const username = String(adminUser || "").trim().toLowerCase();
  if (!username) {
    throw new Error("MESHCENTRAL_ADMIN_USER não configurado.");
  }
  const normalizedDomain = String(domain || "").trim().toLowerCase();
  return `user/${normalizedDomain}/${username}`;
}

module.exports = {
  encodeLoginToken,
  resolveMeshUserId,
};
