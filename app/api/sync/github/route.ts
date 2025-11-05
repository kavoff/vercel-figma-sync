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

    // Per-locale files based on project name
    const { getFileContent, createOrUpdateFile } = await import("@/lib/github")
    const projectFile = `${activeProject.name}.json`
    const enPath = `locales/en/${projectFile}`
    const ruPath = `locales/ru/${projectFile}`
    const baseCfg = {
      token: activeProject.github_token,
      owner: activeProject.github_owner,
      repo: activeProject.github_repo,
      branch: activeProject.github_branch,
    }

    if (keys && keys.length > 0) {
      // Partial: fetch both langs for selected keys
      const { data: rows, error } = await supabase
        .from("texts")
        .select("key, value, lang, status")
        .eq("project_id", activeProject.id)
        .in("key", keys)
      if (error) throw error
      const enJson: Record<string, string> = {}
      const ruJson: Record<string, string> = {}
      for (const r of rows || []) {
        if (r.status !== "approved") continue
        if (r.lang === "en") enJson[r.key] = r.value
        if (r.lang === "ru") ruJson[r.key] = r.value
      }
      const existingEn = await getFileContent({ ...baseCfg, path: enPath })
      let mergedEn: Record<string, string> = {}
      try { mergedEn = existingEn?.content ? JSON.parse(existingEn.content) : {} } catch { mergedEn = {} }
      Object.assign(mergedEn, enJson)
      await createOrUpdateFile({ ...baseCfg, path: enPath }, JSON.stringify(mergedEn, null, 2), "Partial EN update", existingEn?.sha)

      const existingRu = await getFileContent({ ...baseCfg, path: ruPath })
      let mergedRu: Record<string, string> = {}
      try { mergedRu = existingRu?.content ? JSON.parse(existingRu.content) : {} } catch { mergedRu = {} }
      Object.assign(mergedRu, ruJson)
      await createOrUpdateFile({ ...baseCfg, path: ruPath }, JSON.stringify(mergedRu, null, 2), "Partial RU update", existingRu?.sha)
      return NextResponse.json({ success: true, count: Object.keys(enJson).length + Object.keys(ruJson).length, mode: "partial-both" })
    } else {
      // Full: fetch approved for both langs and merge into per-locale files
      const { data: rows, error: textsError } = await supabase
        .from("texts")
        .select("key, value, lang, status")
        .eq("project_id", activeProject.id)
      if (textsError) throw textsError
      const enJson: Record<string, string> = {}
      const ruJson: Record<string, string> = {}
      for (const r of rows || []) {
        if (r.status !== "approved") continue
        if (r.lang === "en") enJson[r.key] = r.value
        if (r.lang === "ru") ruJson[r.key] = r.value
      }
      const existingEn = await getFileContent({ ...baseCfg, path: enPath })
      let mergedEn: Record<string, string> = {}
      try { mergedEn = existingEn?.content ? JSON.parse(existingEn.content) : {} } catch { mergedEn = {} }
      Object.assign(MergedEn, enJson)
      await createOrUpdateFile({ ...baseCfg, path: enPath }, JSON.stringify(mergedEn, null, 2), "Merge approved EN", existingEn?.sha)

      const existingRu = await getFileContent({ ...baseCfg, path: ruPath })
      let mergedRu: Record<string, string> = {}
      try { mergedRu = existingRu?.content ? JSON.parse(existingRu.content) : {} } catch { mergedRu = {} }
      Object.assign(mergedRu, ruJson)
      await createOrUpdateFile({ ...baseCfg, path: ruPath }, JSON.stringify(mergedRu, null, 2), "Merge approved RU", existingRu?.sha)
      return NextResponse.json({ success: true, count: Object.keys(enJson).length + Object.keys(ruJson).length, mode: "full-both" })
    }
  } catch (error) {
    console.error("[v0] Manual GitHub sync error:", error)
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Failed to sync to GitHub" }, { status: 500 })
  }
}


