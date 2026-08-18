import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const UNLIMITED_SPREAD_EMAILS = new Set(["iliushka00@bk.ru", "moratest@bk.ru"]);
const COOLDOWN_MS = 12 * 60 * 60 * 1000;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";
  const tokenHash = typeof body?.tokenHash === "string" && /^[a-f0-9]{64}$/.test(body.tokenHash)
    ? body.tokenHash
    : "";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const accountActions = new Set([
    "account-state",
    "adopt-guest-daily",
    "complete-daily",
    "reserve-account-spread",
    "complete-account-spread",
    "release-account-spread",
    "clear-account-spread",
  ]);
  if (accountActions.has(action)) {
    const accessToken = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(accessToken);
    const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : "";
    const userEmail = typeof claimsData?.claims?.email === "string"
      ? claimsData.claims.email.toLowerCase()
      : "";
    if (claimsError || !userId || !userEmail) return json({ error: "Authenticated account required" }, 401);

    if (action === "account-state") {
      const cardId = typeof body?.cardId === "string" ? body.cardId : "";
      const variantIndex = Number.isInteger(body?.variantIndex) ? body.variantIndex : -1;
      if (!cardId || variantIndex < 0 || variantIndex > 100) return json({ error: "Invalid daily candidate" }, 400);
      const { data, error } = await supabase.rpc("bootstrap_prototype_account", {
        p_user_id: userId,
        p_card_id: cardId,
        p_variant_index: variantIndex,
      });
      if (error || !data) return json({ error: "Unable to load account state" }, 500);
      return json({ accountId: userId, email: userEmail, isAdmin: UNLIMITED_SPREAD_EMAILS.has(userEmail), ...data });
    }

    if (action === "complete-daily") {
      const { data, error } = await supabase.rpc("complete_prototype_daily", { p_user_id: userId });
      if (error || !data) return json({ error: "Unable to complete daily card" }, 500);
      return json(data, data.completed === true ? 200 : 409);
    }

    if (action === "adopt-guest-daily") {
      const cardId = typeof body?.cardId === "string" ? body.cardId : "";
      const variantIndex = Number.isInteger(body?.variantIndex) ? body.variantIndex : -1;
      if (!cardId || variantIndex < 0 || variantIndex > 100) {
        return json({ error: "Invalid guest daily card" }, 400);
      }
      const { data, error } = await supabase.rpc("adopt_prototype_guest_daily", {
        p_user_id: userId,
        p_card_id: cardId,
        p_variant_index: variantIndex,
      });
      if (error || !data) return json({ error: "Unable to adopt guest daily card" }, 500);
      return json(data);
    }

    if (action === "clear-account-spread") {
      const isAdmin = UNLIMITED_SPREAD_EMAILS.has(userEmail);
      let query = supabase
        .from("prototype_account_states")
        .update({ spread_snapshot: null, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .select("user_id");
      if (!isAdmin) query = query.lte("last_spread_at", new Date(Date.now() - COOLDOWN_MS).toISOString());
      const { data, error } = await query.maybeSingle();
      if (error) return json({ error: "Unable to clear spread" }, 500);
      return data ? json({ cleared: true }) : json({ cleared: false, reason: "cooldown" }, 409);
    }

    const reservationId = typeof body?.reservationId === "string" && /^[0-9a-f-]{36}$/i.test(body.reservationId)
      ? body.reservationId
      : "";
    const isAdminAccount = UNLIMITED_SPREAD_EMAILS.has(userEmail);
    if (
      action !== "reserve-account-spread"
      && !reservationId
      && !(action === "complete-account-spread" && isAdminAccount)
    ) {
      return json({ error: "Invalid reservation" }, 400);
    }

    if (action === "reserve-account-spread") {
      if (isAdminAccount) {
        return json({ reserved: true, reservationId: crypto.randomUUID() });
      }
      const { data, error } = await supabase.rpc("reserve_prototype_account_spread", { p_user_id: userId });
      if (error || !data) return json({ error: "Unable to reserve spread" }, 500);
      return json(data, data.reserved === true ? 200 : 409);
    }

    if (action === "release-account-spread") {
      const { data, error } = await supabase.rpc("release_prototype_account_spread", {
        p_user_id: userId,
        p_reservation_id: reservationId,
      });
      return error || !data ? json({ error: "Unable to release spread" }, 500) : json(data);
    }

    const snapshot = body?.snapshot;
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
      return json({ error: "Invalid spread snapshot" }, 400);
    }
    if (isAdminAccount) {
      const completedAt = new Date().toISOString();
      const { error } = await supabase.from("prototype_account_states").upsert({
        user_id: userId,
        spread_snapshot: snapshot,
        last_spread_at: completedAt,
        spread_reservation_id: null,
        spread_reserved_at: null,
        updated_at: completedAt,
      }, { onConflict: "user_id" });
      return error ? json({ error: "Unable to save admin spread" }, 500) : json({ completed: true, snapshot });
    }
    const { data, error } = await supabase.rpc("complete_prototype_account_spread", {
      p_user_id: userId,
      p_reservation_id: reservationId,
      p_snapshot: snapshot,
    });
    if (error || !data) return json({ error: "Unable to complete spread" }, 500);
    return json(data, data.completed === true ? 200 : 409);
  }

  if (!tokenHash) return json({ error: "Invalid session token" }, 400);

  if (action === "verify") {
    const { data, error } = await supabase
      .from("prototype_testers")
      .select("id,last_spread_at")
      .eq("session_token_hash", tokenHash)
      .maybeSingle();
    return json({
      authenticated: !error && Boolean(data),
      nextSpreadAt: data?.last_spread_at
        ? new Date(new Date(data.last_spread_at).getTime() + COOLDOWN_MS).toISOString()
        : null,
    });
  }

  const spreadActions = {
    "reserve-spread": "reserve_prototype_spread",
    "complete-spread": "complete_prototype_spread",
    "release-spread": "release_prototype_spread",
  } as const;
  if (action in spreadActions) {
    const spreadAction = action as keyof typeof spreadActions;
    const functionName = spreadActions[spreadAction];
    const reservationId = typeof body?.reservationId === "string" ? body.reservationId : "";
    if (spreadAction !== "reserve-spread" && !/^[0-9a-f-]{36}$/i.test(reservationId)) {
      return json({ error: "Invalid reservation" }, 400);
    }

    const { data, error } = await supabase.rpc(functionName, {
      p_token_hash: tokenHash,
      ...(spreadAction === "reserve-spread" ? {} : { p_reservation_id: reservationId }),
    });
    if (error || !data) return json({ error: "Unable to update spread reservation" }, 500);

    const reason = typeof data.reason === "string" ? data.reason : "";
    const status = reason === "session_required"
      ? 401
      : ["cooldown", "in_progress", "reservation_mismatch", "reservation_expired"].includes(reason)
        ? 409
        : 200;
    return json(data, status);
  }

  if (action === "revoke") {
    const replacement = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    await supabase
      .from("prototype_testers")
      .update({ session_token_hash: replacement })
      .eq("session_token_hash", tokenHash);
    return json({ authenticated: false });
  }

  if (action === "create") {
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
      return json({ error: "Invalid email" }, 400);
    }
    if (email === ADMIN_EMAIL) return json({ error: "Admin requires OTP" }, 403);

    const { data, error } = await supabase.from("prototype_testers").upsert(
      { email, session_token_hash: tokenHash, last_seen_at: new Date().toISOString() },
      { onConflict: "email" },
    ).select("last_spread_at").single();
    if (error) return json({ error: "Unable to create tester session" }, 500);
    return json({
      authenticated: true,
      nextSpreadAt: data?.last_spread_at
        ? new Date(new Date(data.last_spread_at).getTime() + COOLDOWN_MS).toISOString()
        : null,
    });
  }

  return json({ error: "Invalid action" }, 400);
});
