import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ADMIN_EMAIL = "iliushka00@bk.ru";
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

  if (!tokenHash) return json({ error: "Invalid session token" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

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
