import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { sendReply } from "@/lib/gmail";

const bodySchema = z.object({
  body: z.string().max(20_000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await createServerSupabaseClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: "Invalid inbox id" }, { status: 400 });
  }

  let body: { body?: string } = {};
  try {
    const raw = await request.json();
    const parsed = bodySchema.safeParse(raw);
    if (parsed.success) body = parsed.data;
  } catch {
    // empty body is fine — we'll fall back to the suggested_response
  }

  // If no body provided, pull suggested_response.
  let replyBody = body.body?.trim() ?? "";
  if (!replyBody) {
    const db = createServiceRoleClient();
    const { data } = await db
      .from("inbox_items")
      .select("suggested_response")
      .eq("id", idParsed.data)
      .maybeSingle();
    replyBody = data?.suggested_response?.trim() ?? "";
  }
  if (!replyBody) {
    return NextResponse.json(
      { error: "No reply body and no suggested_response on file" },
      { status: 400 },
    );
  }

  try {
    const result = await sendReply(idParsed.data, replyBody);
    // sendReply flips inbox_item.status to 'actioned' — flush dashboard
    // + inbox so the row disappears from the triage panel.
    revalidatePath("/");
    revalidatePath("/inbox");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 502 },
    );
  }
}
