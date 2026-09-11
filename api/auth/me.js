import crypto from "crypto";

function getCookie(req, name) {
  const cookies = req.headers.cookie || "";

  const match = cookies
    .split(";")
    .map(cookie => cookie.trim())
    .find(cookie =>
      cookie.startsWith(`${name}=`)
    );

  if (!match) {
    return null;
  }

  return decodeURIComponent(
    match.substring(name.length + 1)
  );
}

function verifySession(cookieValue) {
  const secret = process.env.JWT_SECRET;

  if (!cookieValue || !secret) {
    return null;
  }

  const parts = cookieValue.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [session, signature] = parts;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(session)
    .digest("base64url");

  try {
    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer
        .from(session, "base64url")
        .toString("utf8")
    );

    const SESSION_MAX_AGE =
      8 * 60 * 60 * 1000;

    if (
      !data.issuedAt ||
      Date.now() - data.issuedAt >
        SESSION_MAX_AGE
    ) {
      return null;
    }

    return {
      role: data.role,
      stage: data.stage || null,
      name: data.name || ""
    };

  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const cookie = getCookie(
    req,
    "bqc_session"
  );

  const user = verifySession(cookie);

  if (!user) {
    return res.status(401).json({
      authenticated: false
    });
  }

  return res.status(200).json({
    authenticated: true,
    user
  });
}