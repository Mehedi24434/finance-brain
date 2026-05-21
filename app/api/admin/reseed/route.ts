import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { reseed } from "@/lib/reseed";

export async function POST() {
  const auth = await createServerSupabaseClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reseed();
    revalidatePath("/");
    revalidatePath("/inbox");
    revalidatePath("/tasks");
    revalidatePath("/memory");
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reseed failed" },
      { status: 500 },
    );
  }
}
