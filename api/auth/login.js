import crypto from "crypto";

/*
 * pinEnv is the NAME of the environment variable holding this account's PIN.
 * defaultPin is only used if that env var is not set, so existing
 * deployments keep working without requiring immediate env var changes —
 * but you should set real env vars in production and remove the defaults.
 *
 * IMPORTANT: 'plantinv' is a single combined role (matches the frontend's
 * login dropdown and STATE.role model) with access to every plant +
 * inventory store — see canRead/canWrite in api/data/[key].js.
 */
const USERS = {
  omadmin: {
    pinEnv: "OMADMIN_PIN",
    defaultPin: "5634",
    role: "omadmin",
    name: "OM Admin"
  },

  plantinv: {
    pinEnv: "PLANTINV_PIN",
    defaultPin: "9876",
    role: "plantinv",
    name: "Plant & Inventory"
  },

  quality: {
    pinEnv: "QUALITY_PIN",
    defaultPin: "6396",
    role: "quality",
    name: "Quality Engineer"
  },

  stage1: {
    pinEnv: "STAGE1_PIN",
    defaultPin: "1101",
    role: "omtech",
    stage: 1,
    name: "Stage 1 Technician"
  },

  stage2: {
    pinEnv: "STAGE2_PIN",
    defaultPin: "1202",
    role: "omtech",
    stage: 2,
    name: "Stage 2 Technician"
  },

  stage3: {
    pinEnv: "STAGE3_PIN",
    defaultPin: "1303",
    role: "omtech",
    stage: 3,
    name: "Stage 3 Technician"
  },

  bsa: {
    pinEnv: "BSA_PIN",
    defaultPin: "7521",
    role: "bsa",
    name: "BSA Engineer"
  }
};

function createSignature(payload, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      mode,
      pin,
      name
    } = req.body || {};

    if (!mode || !pin) {
      return res.status(400).json({
        error: "Role and PIN are required"
      });
    }

    const account = USERS[mode];

    if (!account) {
      return res.status(401).json({
        error: "Invalid role or PIN"
      });
    }

    // Real env var takes priority; the shipped default keeps existing
    // deployments working until you set proper secrets in production.
    const expectedPin = process.env[account.pinEnv] || account.defaultPin;

    if (!expectedPin) {
      console.error(
        `No PIN configured for ${mode} (set env var ${account.pinEnv})`
      );

      return res.status(500).json({
        error: "Authentication configuration error"
      });
    }

    if (String(pin) !== String(expectedPin)) {
      return res.status(401).json({
        error: "Invalid role or PIN"
      });
    }

    const userName =
      account.role === "omtech"
        ? (name || account.name).trim()
        : account.name;

    const sessionData = {
      role: account.role,
      stage: account.stage || null,
      name: userName,
      issuedAt: Date.now(),
      nonce: crypto.randomBytes(16).toString("hex")
    };

    const session = Buffer
      .from(JSON.stringify(sessionData))
      .toString("base64url");

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error("JWT_SECRET is missing");

      return res.status(500).json({
        error: "Authentication configuration error"
      });
    }

    const signature = createSignature(
      session,
      secret
    );

    const cookieValue = `${session}.${signature}`;

    res.setHeader(
      "Set-Cookie",
      `bqc_session=${cookieValue}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800`
    );

    return res.status(200).json({
      success: true,
      user: {
        role: account.role,
        stage: account.stage || null,
        name: userName
      }
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}