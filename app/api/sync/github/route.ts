import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
import { syncToGitHub } from "@/lib/github"

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const supabase = await createClient()

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

    const query = supabase
      .from("texts")
      .select("key, value_en, value_ru, status")
      .eq("status", "approved")
      .eq("project_id", activeProject.id)

    if (keys && keys.length > 0) {
      query.in("key", keys)
    }

    const { data: approvedTexts, error: textsError } = await query
    if (textsError) throw textsError

    const jsonContentEn: Record<string, string> = {}
    const jsonContentRu: Record<string, string> = {}

    for (const t of approvedTexts || []) {
      if (t.value_en) jsonContentEn[t.key] = t.value_en
      if (t.value_ru) jsonContentRu[t.key] = t.value_ru
    }

    const config = {
      token: activeProject.github_token,
      owner: activeProject.github_owner,
      repo: activeProject.github_repo,
      branch: activeProject.github_branch,
      path: activeProject.github_path,
    }

    await syncToGitHub(jsonContentEn, jsonContentRu, config)

    return NextResponse.json({ 
      success: true, 
      count: (approvedTexts || []).length,
      mode: keys ? "partial" : "full"
    })
  } catch (error) {
    console.error("[v0] Manual GitHub sync error:", error)
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Failed to sync to GitHub" 
    }, { status: 500 })
  }
}
