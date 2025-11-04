import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"

export async function POST() {
  try {
    await requireAuth()
    const supabase = await createClient()

    const { data: activeProject } = await supabase.from("projects").select("id").eq("is_active", true).maybeSingle()
    if (!activeProject?.id) {
      return NextResponse.json({ error: "No active project selected" }, { status: 400 })
    }

    const { error } = await supabase
      .from("texts")
      .update({ project_id: activeProject.id })
      .is("project_id", null)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] migrate project ids error:", error)
    return NextResponse.json({ error: "Failed to migrate project ids" }, { status: 500 })
  }
}


