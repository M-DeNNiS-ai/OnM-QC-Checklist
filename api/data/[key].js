import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const DATA_STORES = [
  "om_chain_records",
  "plant_records",
  "plant_stock_records",
  "new_battery_records",
  "inventory_adjustments",
  "warranty_records",
  "daily_stock_records",
  "iot_given_records",
  "iot_returned_records",
  "day_log_records",
  "bsa_records"
];

function getCookie(req, name) {
  const cookies = req.headers.cookie || "";

  const match = cookies
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith(`${name}=`));

  if (!match) return null;

  return decodeURIComponent(
    match.substring(name.length + 1)
  );
}

function authenticate(req) {
  const cookie = getCookie(req, "bqc_session");
  const secret = process.env.JWT_SECRET;

  if (!cookie || !secret) return null;

  const parts = cookie.split(".");

  if (parts.length !== 2) return null;

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
      Buffer.from(session, "base64url").toString("utf8")
    );

    const maxAge = 8 * 60 * 60 * 1000;

    if (
      !data.issuedAt ||
      Date.now() - data.issuedAt > maxAge
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

// 'plantinv' is the single combined Plant & Inventory role the frontend
// logs in as (STATE.role === 'plantinv') — it needs the union of every
// store the old split 'plant'/'inventory' roles could touch, so nothing
// it saves gets silently rejected or read back as empty.
const PLANTINV_STORES = [
  "plant_records",
  "plant_stock_records",
  "new_battery_records",
  "inventory_adjustments",
  "warranty_records",
  "daily_stock_records",
  "iot_given_records",
  "iot_returned_records",
  "day_log_records"
];

function canRead(user, store) {
  if (user.role === "omadmin") return true;

  if (user.role === "quality") return true;

  if (user.role === "bsa") {
    return [
      "om_chain_records",
      "warranty_records",
      "bsa_records"
    ].includes(store);
  }

  if (user.role === "plantinv") {
    return PLANTINV_STORES.includes(store);
  }

  if (user.role === "omtech") {
    return store === "om_chain_records";
  }

  return false;
}

function canWrite(user, store) {
  if (user.role === "omadmin") return true;

  if (user.role === "quality") {
    return true;
  }

  if (user.role === "bsa") {
    return [
      "bsa_records",
      "om_chain_records",
      "warranty_records"
    ].includes(store);
  }

  if (user.role === "plantinv") {
    return PLANTINV_STORES.includes(store);
  }

  if (user.role === "omtech") {
    return store === "om_chain_records";
  }

  return false;
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "SUPABASE_URL or SUPABASE_SECRET_KEY is missing"
    );
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function audit(
  supabase,
  user,
  action,
  store,
  recordId,
  details = null
) {
  const { error } = await supabase
    .from("bqc_audit_log")
    .insert({
      username: user.name || null,
      role: user.role || null,
      action,
      store_key: store,
      record_id: recordId || null,
      details
    });

  if (error) {
    console.error("Audit log error:", error);
  }
}

export default async function handler(req, res) {
  const user = authenticate(req);

  if (!user) {
    return res.status(401).json({
      error: "Authentication required"
    });
  }

  const store = req.query.key;

  if (!store || !DATA_STORES.includes(store)) {
    return res.status(404).json({
      error: "Unknown data store"
    });
  }

  if (req.method !== "GET" && req.method !== "PUT") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  if (req.method === "GET") {
    if (!canRead(user, store)) {
      return res.status(403).json({
        error: "You do not have permission to read this data"
      });
    }

    try {
      const supabase = getSupabase();

      const { data, error } = await supabase
        .from("bqc_records")
        .select("id, payload, created_at, updated_at, updated_by")
        .eq("store_key", store)
        .order("created_at", {
          ascending: true
        });

      if (error) {
        console.error("GET error:", error);

        return res.status(500).json({
          error: error.message
        });
      }

      const records = (data || []).map(row => ({
        ...(row.payload || {}),
        id: row.id
      }));

      return res.status(200).json({
        success: true,
        data: records
      });

    } catch (error) {
      console.error("GET store error:", error);

      return res.status(500).json({
        error: "Internal server error"
      });
    }
  }

  if (req.method === "PUT") {
    if (!canWrite(user, store)) {
      return res.status(403).json({
        error: "You do not have permission to modify this data"
      });
    }

    const records = req.body?.data;

    if (!Array.isArray(records)) {
      return res.status(400).json({
        error: "Request must contain a data array"
      });
    }

    try {
      const supabase = getSupabase();

      /*
       * Read existing records for this store.
       */
      const { data: existing, error: existingError } =
        await supabase
          .from("bqc_records")
          .select("id")
          .eq("store_key", store);

      if (existingError) {
        console.error(
          "Existing records error:",
          existingError
        );

        return res.status(500).json({
          error: existingError.message
        });
      }

      const incomingIds = new Set(
        records
          .map(record => record?.id)
          .filter(Boolean)
          .map(String)
      );

      const idsToDelete = (existing || [])
        .map(row => String(row.id))
        .filter(id => !incomingIds.has(id));

      /*
       * SAFETY GUARDRAIL: this endpoint does a full replace of the store —
       * anything not in the incoming array gets deleted. That's exactly how
       * a race condition (saving before the initial GET has finished), a
       * dropped network response treated as "empty", or any other bug that
       * hands this endpoint a too-small array can silently wipe real data
       * with no error shown to the user. If a write would delete most of an
       * existing, non-trivial store, refuse it unless the caller explicitly
       * confirms via the x-confirm-wipe header — this turns silent data loss
       * into a visible error instead.
       */
      const existingCount = (existing || []).length;
      const wipingMost = existingCount >= 5 && idsToDelete.length >= existingCount * 0.8;
      if (wipingMost && req.headers["x-confirm-wipe"] !== "true") {
        console.error(
          `Refused suspicious write to ${store}: would delete ${idsToDelete.length} of ${existingCount} existing records (user: ${user.name || user.role})`
        );
        await audit(supabase, user, "PUT_STORE_BLOCKED", store, null, {
          existingCount,
          incomingCount: records.length,
          wouldDelete: idsToDelete.length
        });
        return res.status(409).json({
          error: `This save would delete ${idsToDelete.length} of ${existingCount} existing records in "${store}". Refused as a safety check. Refresh the page to reload the latest data before retrying — if this deletion is really intended, contact an admin.`
        });
      }

      /*
       * Delete records removed by the frontend.
       */
      if (idsToDelete.length > 0) {
        const { error: deleteError } =
          await supabase
            .from("bqc_records")
            .delete()
            .eq("store_key", store)
            .in("id", idsToDelete);

        if (deleteError) {
          console.error(
            "Delete error:",
            deleteError
          );

          return res.status(500).json({
            error: deleteError.message
          });
        }
      }

      /*
       * Upsert records.
       */
      if (records.length > 0) {
        const rows = records.map(record => {
          const id =
            record?.id ||
            crypto.randomUUID();

          const {
            id: ignoredId,
            ...payload
          } = record;

          return {
            id: String(id),
            store_key: store,
            payload,
            updated_at: new Date().toISOString(),
            updated_by: user.name || user.role
          };
        });

        const { error: upsertError } =
          await supabase
            .from("bqc_records")
            .upsert(rows, {
              onConflict: "id"
            });

        if (upsertError) {
          console.error(
            "Upsert error:",
            upsertError
          );

          return res.status(500).json({
            error: upsertError.message
          });
        }
      }

      await audit(
        supabase,
        user,
        "PUT_STORE",
        store,
        null,
        {
          count: records.length
        }
      );

      return res.status(200).json({
        success: true,
        count: records.length
      });

    } catch (error) {
      console.error("PUT store error:", error);

      return res.status(500).json({
        error: "Internal server error"
      });
    }
  }
}