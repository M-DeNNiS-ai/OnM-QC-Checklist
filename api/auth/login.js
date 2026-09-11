import crypto from "crypto";

const USERS = {
  omadmin: {
    pinEnv: "5634",
    role: "omadmin",
    name: "OM Admin"
  },

  plant: {
    pinEnv: "9876",
    role: "plant",
    name: "Plant"
  },

  inventory: {
    pinEnv: "2312",
    role: "inventory",
    name: "Inventory"
  },

  quality: {
    pinEnv: "6396",
    role: "quality",
    name: "Quality Engineer"
  },

  stage1: {
    pinEnv: "1101",
    role: "omtech",
    stage: 1,
    name: "Stage 1 Technician"
  },

  stage2: {
    pinEnv: "1202",
    role: "omtech",
    stage: 2,
    name: "Stage 2 Technician"
  },

  stage3: {
    pinEnv: "1303",
    role: "omtech",
    stage: 3,
    name: "Stage 3 Technician"
  },

  bsa: {
    pinEnv: "7521",
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

    const expectedPin = process.env[account.pinEnv];

    if (!expectedPin) {
      console.error(
        `Missing environment variable: ${account.pinEnv}`
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