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

  if (user.role === "plant") {
    return [
      "plant_records",
      "plant_stock_records",
      "new_battery_records",
      "inventory_adjustments",
      "warranty_records",
      "daily_stock_records",
      "iot_given_records",
      "iot_returned_records",
      "day_log_records"
    ].includes(store);
  }

  if (user.role === "inventory") {
    return [
      "plant_records",
      "plant_stock_records",
      "new_battery_records",
      "inventory_adjustments",
      "warranty_records",
      "daily_stock_records",
      "iot_given_records",
      "iot_returned_records",
      "day_log_records"
    ].includes(store);
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

  if (user.role === "plant") {
    return [
      "plant_records",
      "plant_stock_records",
      "new_battery_records",
      "daily_stock_records",
      "iot_given_records",
      "iot_returned_records",
      "day_log_records"
    ].includes(store);
  }

  if (user.role === "inventory") {
    return [
      "plant_stock_records",
      "new_battery_records",
      "inventory_adjustments",
      "daily_stock_records",
      "iot_given_records",
      "iot_returned_records"
    ].includes(store);
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