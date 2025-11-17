import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] POST /api/texts/bulk-upsert - starting")
    const body = await request.json()
    const { texts } = body

    if (!texts || !Array.isArray(texts)) {
      return NextResponse.json({ error: "Invalid texts array" }, { status: 400 })
    }

    console.log("[v0] Received texts to import:", texts.length)

    const supabase = await createClient()

    let { data: activeProject } = await supabase
      .from("projects")
      .select("id")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!activeProject) {
      console.log("[v0] No active project found, creating default project")
      const { data: newProject, error: createError } = await supabase
        .from("projects")
        .insert({
          name: "Default Project",
          github_owner: "",
          github_repo: "",
          github_branch: "main",
          github_path: "locales",
          github_token: "",
          is_active: true,
        })
        .select()
        .single()

      if (createError) {
        console.error("[v0] Failed to create default project:", createError)
        return NextResponse.json({ error: "No active project and failed to create one" }, { status: 400 })
      }
      activeProject = newProject
      console.log("[v0] Created default project:", activeProject.id)
    }

    const results = []

    for (const item of texts) {
      const { key, value, category, sources } = item

      console.log("[v0] Processing text:", key)

      const { data: existing } = await supabase
        .from("texts")
        .select("*")
        .eq("key", key)
        .eq("project_id", activeProject.id)
        .single()

      if (!existing) {
        console.log("[v0] Creating new text:", key)
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
        } else {
          console.error("[v0] Error creating text:", key, error)
        }
      } else if (existing.status !== "approved") {
        console.log("[v0] Updating draft/in_review text:", key)
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
        console.log("[v0] Approved text changed, moving to review:", key)
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
        console.log("[v0] Skipping unchanged approved text:", key)
        results.push({ key, action: "skipped", reason: "approved_unchanged" })
      }
    }

    console.log("[v0] Bulk upsert completed:", results.length, "processed")
    return NextResponse.json({ results })
  } catch (error) {
    console.error("[v0] Bulk upsert error:", error)
    return NextResponse.json({ error: "Failed to process bulk upsert" }, { status: 500 })
  }
}
