import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] POST /api/texts/bulk-upsert - starting")
    const body = await request.json()
    console.log("[v0] Request body:", JSON.stringify(body))
    
    const { texts } = body

    if (!texts || !Array.isArray(texts)) {
      console.error("[v0] Invalid texts array received:", texts)
      return NextResponse.json({ error: "Invalid texts array", received: typeof texts }, { status: 400 })
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
        return NextResponse.json({ error: "No active project and failed to create one", details: createError.message }, { status: 500 })
      }
      activeProject = newProject
      console.log("[v0] Created default project:", activeProject.id)
    }

    console.log("[v0] Active project ID:", activeProject.id)

    const results = []

    for (const item of texts) {
      const { key, value, category, sources } = item

      if (!key || !value) {
        console.error("[v0] Invalid text item:", item)
        results.push({ key: key || "unknown", action: "error", error: "Missing key or value" })
        continue
      }

      console.log("[v0] Processing text:", key, "value length:", value.length)

      const { data: existing } = await supabase
        .from("texts")
        .select("*")
        .eq("key", key)
        .eq("project_id", activeProject.id)
        .maybeSingle()

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
          console.log("[v0] Successfully created text:", key)
        } else {
          console.error("[v0] Error creating text:", key, error)
          results.push({ key, action: "error", error: error.message })
        }
      } else if (existing.status !== "done") {
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
          console.log("[v0] Successfully updated text:", key)
        } else {
          console.error("[v0] Error updating text:", key, error)
          results.push({ key, action: "error", error: error.message })
        }
      } else if (existing.value_en !== value) {
        console.log("[v0] Done text changed, moving to in_review:", key)
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
          console.log("[v0] Successfully moved to review:", key)
        } else {
          console.error("[v0] Error moving to review:", key, error)
          results.push({ key, action: "error", error: error.message })
        }
      } else {
        console.log("[v0] Skipping unchanged done text:", key)
        results.push({ key, action: "skipped", reason: "done_unchanged" })
      }
    }

    console.log("[v0] Bulk upsert completed:", results.length, "processed")
    return NextResponse.json({ results, success: true })
  } catch (error) {
    console.error("[v0] Bulk upsert error:", error)
    return NextResponse.json({ 
      error: "Failed to process bulk upsert", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 })
  }
}
