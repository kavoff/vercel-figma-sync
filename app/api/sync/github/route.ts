import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { syncToGitHub } from "@/lib/github"

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const searchParams = request.nextUrl.searchParams
    const mode = searchParams.get("mode") || "both"

    const supabase = await createClient()

    // Optional subset keys in body
    const body = await request.json().catch(() => ({}))
    const keys: string[] | undefined = Array.isArray(body?.keys) ? body.keys : undefined

    // Load active project
    const { data: activeProject, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("is_active", true)
      .single()

    if (projectError) throw projectError
    if (!activeProject) {
      return NextResponse.json({ error: "No active project configured" }, { status: 400 })
    }

    // Load texts to sync — BOTH mode writes EN as key and RU as key_ru in a single file
    let jsonContent: Record<string, string> = {}
    const cfg = {
      token: activeProject.github_token,
      owner: activeProject.github_owner,
      repo: activeProject.github_repo,
      branch: activeProject.github_branch,
      path: activeProject.github_path,
    }
    const { getFileContent, createOrUpdateFile } = await import("@/lib/github")
    const existing = await getFileContent(cfg)
    try {
      jsonContent = existing?.content ? JSON.parse(existing.content) : {}
    } catch {
      jsonContent = {}
    }

    if (keys && keys.length > 0) {
      // Partial: fetch both langs for selected keys
      const { data: rows, error } = await supabase
        .from("texts")
        .select("key, value, lang, status")
        .eq("project_id", activeProject.id)
        .in("key", keys)
      if (error) throw error
      let count = 0
      for (const r of rows || []) {
        if (r.status !== "approved") continue
        if (r.lang === "en") {
          jsonContent[r.key] = r.value
          count++
        } else if (r.lang === "ru") {
          jsonContent[`${r.key}_ru`] = r.value
          count++
        }
      }
      await createOrUpdateFile(cfg, JSON.stringify(jsonContent, null, 2), "Partial update (both) from TextSync", existing?.sha)
      return NextResponse.json({ success: true, count, mode: "partial-both" })
    } else {
      // Full: fetch approved for both langs and merge
      const { data: rows, error: textsError } = await supabase
        .from("texts")
        .select("key, value, lang, status")
        .eq("project_id", activeProject.id)
      if (textsError) throw textsError
      let count = 0
      for (const r of rows || []) {
        if (r.status !== "approved") continue
        if (r.lang === "en") {
          jsonContent[r.key] = r.value
          count++
        } else if (r.lang === "ru") {
          jsonContent[`${r.key}_ru`] = r.value
          count++
        }
      }
      await createOrUpdateFile(cfg, JSON.stringify(jsonContent, null, 2), "Merge approved (both) from TextSync", existing?.sha)
      return NextResponse.json({ success: true, count, mode: "full-both" })
    }
  } catch (error) {
    console.error("[v0] Manual GitHub sync error:", error)
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Failed to sync to GitHub" }, { status: 500 })
  }
}


