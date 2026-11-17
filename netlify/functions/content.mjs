import { getDatabase } from "@netlify/database";
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";

const DEFAULT_PASSCODE = process.env.ADMIN_INITIAL_PASSCODE || "bitacora2026";
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function hashPasscode(passcode, salt = randomBytes(16).toString("hex")) {
  const derived = scryptSync(passcode, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPasscode(passcode, storedHash) {
  const [salt, keyHex] = String(storedHash || "").split(":");
  if (!salt || !keyHex) return false;
  const derived = scryptSync(passcode, salt, 64);
  const keyBuf = Buffer.from(keyHex, "hex");
  if (derived.length !== keyBuf.length) return false;
  return timingSafeEqual(derived, keyBuf);
}

function signToken(secret) {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ role: "admin", exp })).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyToken(token, secret) {
  if (!token || !secret) return false;
  const [payload, sig] = String(token).split(".");
  if (!payload || !sig) return false;
  const expectedSig = createHmac("sha256", secret).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed.role === "admin" && Number(parsed.exp) > Date.now();
  } catch {
    return false;
  }
}

async function ensureAdminRow(db) {
  const rows = await db.sql`SELECT id, passcode_hash, token_secret FROM admin_auth WHERE id = 1`;
  if (rows.length > 0) return rows[0];
  const initialHash = hashPasscode(DEFAULT_PASSCODE);
  const secret = randomBytes(32).toString("hex");
  const [created] = await db.sql`
    INSERT INTO admin_auth (id, passcode_hash, token_secret)
    VALUES (1, ${initialHash}, ${secret})
    ON CONFLICT (id) DO NOTHING
    RETURNING id, passcode_hash, token_secret
  `;
  if (created) return created;
  const [retry] = await db.sql`SELECT id, passcode_hash, token_secret FROM admin_auth WHERE id = 1`;
  return retry;
}

export default async (req, context) => {
  const db = getDatabase();

  try {
    if (req.method === "GET") {
      const rows = await db.sql`SELECT key, data FROM site_content WHERE key IN ('posts', 'pillars')`;
      const result = { posts: null, pillars: null };
      for (const r of rows) {
        if (r.key === "posts") result.posts = r.data;
        if (r.key === "pillars") result.pillars = r.data;
      }
      return Response.json(result);
    }

    if (req.method === "POST") {
      const body = await req.json();
      const action = body?.action;
      const adminRow = await ensureAdminRow(db);

      if (action === "login") {
        const passcode = String(body?.passcode || "");
        if (!verifyPasscode(passcode, adminRow.passcode_hash)) {
          return Response.json({ error: "Clave incorrecta" }, { status: 401 });
        }
        const token = signToken(adminRow.token_secret);
        return Response.json({ ok: true, token });
      }

      const authHeader = req.headers.get("authorization") || "";
      const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      const hasIdentityUser = Boolean(context?.clientContext?.user);
      const isAuthorized = hasIdentityUser || verifyToken(bearer, adminRow.token_secret);

      if (!isAuthorized) {
        return Response.json({ error: "No autorizado" }, { status: 401 });
      }

      if (action === "change_password") {
        const currentPasscode = String(body?.currentPasscode || "");
        const newPasscode = String(body?.newPasscode || "");
        if (newPasscode.length < 8) {
          return Response.json({ error: "La nueva clave debe tener al menos 8 caracteres" }, { status: 400 });
        }
        if (!verifyPasscode(currentPasscode, adminRow.passcode_hash)) {
          return Response.json({ error: "La clave actual es incorrecta" }, { status: 401 });
        }
        const nextHash = hashPasscode(newPasscode);
        const nextSecret = randomBytes(32).toString("hex");
        await db.sql`
          UPDATE admin_auth
          SET passcode_hash = ${nextHash}, token_secret = ${nextSecret}, updated_at = NOW()
          WHERE id = 1
        `;
        const token = signToken(nextSecret);
        return Response.json({ ok: true, token });
      }

      if (action === "save_posts") {
        const posts = Array.isArray(body?.posts) ? body.posts : [];
        await db.sql`
          INSERT INTO site_content (key, data, updated_at)
          VALUES ('posts', ${JSON.stringify(posts)}::jsonb, NOW())
          ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
        `;
        return Response.json({ ok: true });
      }

      if (action === "save_pillars") {
        const pillars = Array.isArray(body?.pillars) ? body.pillars : [];
        await db.sql`
          INSERT INTO site_content (key, data, updated_at)
          VALUES ('pillars', ${JSON.stringify(pillars)}::jsonb, NOW())
          ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
        `;
        return Response.json({ ok: true });
      }

      if (action === "reset") {
        await db.sql`DELETE FROM site_content WHERE key IN ('posts', 'pillars')`;
        return Response.json({ ok: true });
      }

      return Response.json({ error: "Acción no válida" }, { status: 400 });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (err) {
    return Response.json({ error: "Error interno de servidor" }, { status: 500 });
  }
};

export const config = {
  path: "/api/content"
};
