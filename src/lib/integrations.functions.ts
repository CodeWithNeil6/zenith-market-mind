import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const UpstoxInput = z.object({
  api_key: z.string().min(8).max(200),
  api_secret: z.string().min(8).max(200),
  access_token: z.string().min(8).max(2000).optional().nullable(),
  redirect_uri: z.string().url().optional().nullable(),
});

export const saveUpstoxIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpstoxInput.parse(input))
  .handler(async ({ data, context }) => {
    console.log("[integrations] save upstox user=", context.userId, "hasToken=", !!data.access_token);
    const { data: row, error } = await context.supabase
      .from("integrations")
      .upsert(
        {
          user_id: context.userId,
          provider: "upstox",
          // Mark as connected whenever credentials are saved; live-data calls
          // separately validate the access_token and surface a clear error if
          // it's missing or expired.
          status: "connected",
          credentials: data,
          meta: {
            configured_at: new Date().toISOString(),
            has_access_token: !!data.access_token,
          },
        },
        { onConflict: "user_id,provider" },
      )
      .select()
      .single();
    if (error) {
      console.error("[integrations] save failed", error);
      throw new Error(error.message);
    }
    console.log("[integrations] saved id=", row.id, "status=", row.status);
    return { ok: true, id: row.id, status: row.status, has_access_token: !!data.access_token };
  });

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("integrations")
      .select("id,provider,status,meta,expires_at,updated_at")
      .eq("user_id", context.userId);
    if (error) {
      console.error("[integrations] list failed", error);
      throw new Error(error.message);
    }
    console.log("[integrations] list user=", context.userId, "count=", data?.length ?? 0);
    return data;
  });

export const disconnectIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ provider: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("integrations")
      .delete()
      .eq("user_id", context.userId)
      .eq("provider", data.provider);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
