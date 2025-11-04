import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { syncToGitHub } from "@/lib/github"

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const searchParams = request.nextUrl.searchParams
    const lang = searchParams.get("lang") || "ru"

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

    // Load texts to sync
    let jsonContent: Record<string, string> = {}
    if (keys && keys.length > 0) {
      // Partial: fetch only provided keys in active project
      const { data: rows, error } = await supabase
        .from("texts")
        .select("key, value")
        .eq("lang", lang)
        .eq("project_id", activeProject.id)
        .in("key", keys)
      if (error) throw error
      // Merge into existing file content
      const cfg = {
        token: activeProject.github_token,
        owner: activeProject.github_owner,
        repo: activeProject.github_repo,
        branch: activeProject.github_branch,
        path: activeProject.github_path,
      }
      // Get existing file to merge
      const { getFileContent, createOrUpdateFile } = await import("@/lib/github")
      const existing = await getFileContent(cfg)
      try {
        jsonContent = existing?.content ? JSON.parse(existing.content) : {}
      } catch {
        jsonContent = {}
      }
      for (const r of rows || []) jsonContent[r.key] = r.value
      // Write merged content back
      await createOrUpdateFile(cfg, JSON.stringify(jsonContent, null, 2), "Partial update from TextSync", existing?.sha)
      return NextResponse.json({ success: true, count: keys.length, mode: "partial" })
    } else {
      // Full: all approved in active project
      const { data: approvedTexts, error: textsError } = await supabase
        .from("texts")
        .select("key, value")
        .eq("status", "approved")
        .eq("lang", lang)
        .eq("project_id", activeProject.id)
      if (textsError) throw textsError
      approvedTexts?.forEach((t) => {
        jsonContent[t.key] = t.value
      })
      const githubConfig = {
        token: activeProject.github_token,
        owner: activeProject.github_owner,
        repo: activeProject.github_repo,
        branch: activeProject.github_branch,
        path: activeProject.github_path,
      }
      await syncToGitHub(jsonContent, githubConfig)
      return NextResponse.json({ success: true, count: Object.keys(jsonContent).length, mode: "full" })
    }
  } catch (error) {
    console.error("[v0] Manual GitHub sync error:", error)
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Failed to sync to GitHub" }, { status: 500 })
  }
}


