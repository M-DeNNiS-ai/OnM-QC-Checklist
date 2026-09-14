import crypto from "crypto";

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

  bsa: {
    pinEnv: "BSA_PIN",
    defaultPin: "7521",
    role: "bsa",
    name: "BSA Engineer"
  }
};

/*
 * Quality Technician login
 *
 * The frontend uses one role:
 *   omtech
 *
 * The technician's Stage PIN determines the stage:
 *   1101 -> Stage 1
 *   1202 -> Stage 2
 *   1303 -> Stage 3
 *
 * The technician name is supplied by the frontend and stored
 * in the authenticated session.
 */
const TECHNICIAN_STAGES = [
  {
    pinEnv: "STAGE1_PIN",
    defaultPin: "1101",
    stage: 1
  },
  {
    pinEnv: "STAGE2_PIN",
    defaultPin: "1202",
    stage: 2
  },
  {
    pinEnv: "STAGE3_PIN",
    defaultPin: "1303",
    stage: 3
  }
];

function getConfiguredPin(pinEnv, defaultPin) {
  return process.env[pinEnv] || defaultPin;
}

function createSessionToken(sessionData, secret) {
  const payload = Buffer.from(
    JSON.stringify(sessionData),
    "utf8"
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

export default async function handler(req, res) {
  /*
   * Only POST is allowed.
   */
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { mode, pin, name } = req.body || {};

    /*
     * Basic validation.
     */
    if (!mode || !pin) {
      return res.status(400).json({
        error: "Role and PIN are required"
      });
    }

    /*
     * Validate the authentication secret first.
     */
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error("JWT_SECRET is not configured");

      return res.status(500).json({
        error: "Authentication configuration error"
      });
    }

    let sessionData;

    /*
     * ============================================================
     * QUALITY TECHNICIAN
     * ============================================================
     *
     * Frontend sends:
     *
     * {
     *   mode: "omtech",
     *   name: "...",
     *   pin: "1101"
     * }
     *
     * The PIN determines Stage 1, 2 or 3.
     */
    if (mode === "omtech") {
      const technicianPin = String(pin);

      const matchedStage = TECHNICIAN_STAGES.find((stageConfig) => {
        const expectedPin = getConfiguredPin(
          stageConfig.pinEnv,
          stageConfig.defaultPin
        );

        return technicianPin === String(expectedPin);
      });

      if (!matchedStage) {
        return res.status(401).json({
          error: "Invalid PIN or role"
        });
      }

      const technicianName =
        typeof name === "string" && name.trim()
          ? name.trim()
          : `Stage ${matchedStage.stage} Technician`;

      sessionData = {
        role: "omtech",
        stage: matchedStage.stage,
        name: technicianName,
        issuedAt: Date.now(),
        nonce: crypto.randomBytes(16).toString("hex")
      };
    }

    /*
     * ============================================================
     * NORMAL SECTOR USERS
     * ============================================================
     */
    else {
      const account = USERS[mode];

      if (!account) {
        return res.status(401).json({
          error: "Invalid PIN or role"
        });
      }

      const expectedPin = getConfiguredPin(
        account.pinEnv,
        account.defaultPin
      );

      if (String(pin) !== String(expectedPin)) {
        return res.status(401).json({
          error: "Invalid PIN or role"
        });
      }

      sessionData = {
        role: account.role,
        stage: null,
        name: account.name,
        issuedAt: Date.now(),
        nonce: crypto.randomBytes(16).toString("hex")
      };
    }

    /*
     * ============================================================
     * CREATE SIGNED SESSION TOKEN
     * ============================================================
     */
    const token = createSessionToken(sessionData, secret);

    /*
     * Session cookie.
     *
     * secure=true works on Vercel HTTPS.
     * sameSite=lax allows normal same-site application use.
     */
    res.setHeader(
      "Set-Cookie",
      [
        `bqc_session=${token}`,
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
        "Max-Age=28800"
      ].join("; ")
    );

    /*
     * Return the authenticated user to the frontend.
     */
    return res.status(200).json({
      ok: true,
      user: {
        role: sessionData.role,
        stage: sessionData.stage,
        name: sessionData.name
      }
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      error: "Authentication failed"
    });
  }
}