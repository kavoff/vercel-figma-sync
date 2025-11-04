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

    // Load approved texts for language
    const { data: approvedTexts, error: textsError } = await supabase
      .from("texts")
      .select("key, value")
      .eq("status", "approved")
      .eq("lang", lang)

    if (textsError) throw textsError

    const jsonContent: Record<string, string> = {}
    approvedTexts?.forEach((t) => {
      jsonContent[t.key] = t.value
    })

    // Get active project
    const { data: activeProject, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("is_active", true)
      .single()

    if (projectError) throw projectError

    if (!activeProject) {
      return NextResponse.json({ error: "No active project configured" }, { status: 400 })
    }

    const githubConfig = {
      token: activeProject.github_token,
      owner: activeProject.github_owner,
      repo: activeProject.github_repo,
      branch: activeProject.github_branch,
      path: activeProject.github_path,
    }

    await syncToGitHub(jsonContent, githubConfig)

    return NextResponse.json({ success: true, count: Object.keys(jsonContent).length })
  } catch (error) {
    console.error("[v0] Manual GitHub sync error:", error)
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Failed to sync to GitHub" }, { status: 500 })
  }
}


