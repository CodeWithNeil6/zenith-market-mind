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
    const { data: row, error } = await context.supabase
      .from("integrations")
      .upsert(
        {
          user_id: context.userId,
          provider: "upstox",
          status: data.access_token ? "connected" : "configured",
          credentials: data,
          meta: { configured_at: new Date().toISOString() },
        },
        { onConflict: "user_id,provider" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id, status: row.status };
  });

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("integrations")
      .select("id,provider,status,meta,expires_at,updated_at")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
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
