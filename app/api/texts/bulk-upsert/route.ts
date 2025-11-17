import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { texts } = body

    if (!texts || !Array.isArray(texts)) {
      return NextResponse.json({ error: "Invalid texts array" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: activeProject } = await supabase
      .from("projects")
      .select("id")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!activeProject?.id) {
      return NextResponse.json({ error: "No active project selected" }, { status: 400 })
    }
    const results = []

    for (const item of texts) {
      const { key, value, category, sources } = item

      const { data: existing } = await supabase
        .from("texts")
        .select("*")
        .eq("key", key)
        .eq("project_id", activeProject.id)
        .single()

      if (!existing) {
        const { data, error } = await supabase
          .from("texts")
          .insert({
            key,
            value_en: value,
            value_ru: null,
            category: category || "uncategorized",
            status: "draft",
            sources: sources || {},
            project_id: activeProject.id,
          })
          .select()
          .single()

        if (!error) {
          results.push({ key, action: "created", data })
        }
      } else if (existing.status !== "approved") {
        const { data, error } = await supabase
          .from("texts")
          .update({
            value_en: value,
            category: category || existing.category,
            sources: sources || existing.sources,
          })
          .eq("key", key)
          .eq("project_id", activeProject.id)
          .select()
          .single()

        if (!error) {
          results.push({ key, action: "updated", data })
        }
      } else if (existing.value_en !== value) {
        const { data, error } = await supabase
          .from("texts")
          .update({
            value_en: value,
            category: category || existing.category,
            status: "in_review",
            sources: sources || existing.sources,
          })
          .eq("key", key)
          .eq("project_id", activeProject.id)
          .select()
          .single()

        if (!error) {
          results.push({ key, action: "moved_to_review", data })
        }
      } else {
        results.push({ key, action: "skipped", reason: "approved_unchanged" })
      }
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error("[v0] Bulk upsert error:", error)
    return NextResponse.json({ error: "Failed to process bulk upsert" }, { status: 500 })
  }
}
