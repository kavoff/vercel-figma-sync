import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] POST /api/texts/bulk-upsert - starting")
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[v0] Missing Supabase environment variables")
      return NextResponse.json({ 
        error: "Supabase not configured. Please add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your Vercel project environment variables.",
        results: []
      }, { status: 500 })
    }
    
    const body = await request.json()
    console.log("[v0] Request body keys:", Object.keys(body))
    
    const { texts } = body

    if (!texts || !Array.isArray(texts)) {
      console.error("[v0] Invalid texts:", typeof texts, Array.isArray(texts))
      return NextResponse.json({ 
        error: "Invalid request: 'texts' must be an array", 
        received: typeof texts,
        results: []
      }, { status: 400 })
    }

    if (texts.length === 0) {
      return NextResponse.json({ 
        results: [], 
        success: true,
        message: "No texts to process"
      })
    }

    console.log("[v0] Processing", texts.length, "texts")

    const supabase = await createClient()

    let { data: activeProject } = await supabase
      .from("projects")
      .select("id")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!activeProject) {
      console.log("[v0] Creating default project...")
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
        console.error("[v0] Failed to create project:", createError)
        return NextResponse.json({ 
          error: "Failed to create default project", 
          details: createError.message,
          results: []
        }, { status: 500 })
      }
      
      activeProject = newProject
      console.log("[v0] Created project:", activeProject.id)
    }

    const results = []

    for (const item of texts) {
      const { key, value, category, sources } = item

      if (!key || !value) {
        console.warn("[v0] Skipping invalid item:", { key, hasValue: !!value })
        results.push({ key: key || "unknown", action: "error", error: "Missing key or value" })
        continue
      }

      const { data: existing } = await supabase
        .from("texts")
        .select("*")
        .eq("key", key)
        .eq("project_id", activeProject.id)
        .maybeSingle()

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
          console.log("[v0] Created:", key)
        } else {
          console.error("[v0] Create error:", key, error.message)
          results.push({ key, action: "error", error: error.message })
        }
      } else if (existing.status !== "done") {
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
          console.log("[v0] Updated:", key)
        } else {
          console.error("[v0] Update error:", key, error.message)
          results.push({ key, action: "error", error: error.message })
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
          console.log("[v0] Moved to review:", key)
        } else {
          console.error("[v0] Review error:", key, error.message)
          results.push({ key, action: "error", error: error.message })
        }
      } else {
        results.push({ key, action: "skipped", reason: "done_unchanged" })
      }
    }

    console.log("[v0] Completed:", results.length, "processed")
    return NextResponse.json({ results, success: true })
  } catch (error) {
    console.error("[v0] Bulk upsert error:", error)
    return NextResponse.json({ 
      error: "Failed to process bulk upsert", 
      details: error instanceof Error ? error.message : String(error),
      results: []
    }, { status: 500 })
  }
}
