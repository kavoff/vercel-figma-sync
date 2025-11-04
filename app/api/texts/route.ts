import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status")
    const category = searchParams.get("category") // Added category filter
    const q = searchParams.get("q")
    const lang = searchParams.get("lang") || "ru"

    const supabase = await createClient()

    // Scope to active project
    const { data: activeProject } = await supabase
      .from("projects")
      .select("id")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    // Fetch both EN and RU for grouping by key
    let query = supabase
      .from("texts")
      .select("key, value, lang, status, updated_at, project_id")
      .order("updated_at", { ascending: false })

    if (activeProject?.id) query = query.eq("project_id", activeProject.id)
    if (status) query = query.eq("status", status)
    if (category && category !== "all") query = query.eq("category", category)
    if (q) query = query.or(`key.ilike.%${q}%,value.ilike.%${q}%`)

    const { data, error } = await query

    if (error) {
      throw error
    }

    // Group rows by key into combined entry with en/ru
    const map = new Map<string, any>()
    for (const row of data || []) {
      const entry = map.get(row.key) || { key: row.key, value_en: "", value_ru: "", status_en: "draft", status_ru: "draft", updated_at: row.updated_at }
      if (row.lang === "en") {
        entry.value_en = row.value
        entry.status_en = row.status
      } else if (row.lang === "ru") {
        entry.value_ru = row.value
        entry.status_ru = row.status
      }
      if (new Date(row.updated_at).getTime() > new Date(entry.updated_at).getTime()) entry.updated_at = row.updated_at
      map.set(row.key, entry)
    }

    const combined = Array.from(map.values())
    const statusOrder: Record<string, number> = { in_review: 0, draft: 1, approved: 2 }
    combined.sort((a, b) => {
      const aRank = Math.min(statusOrder[a.status_en] ?? 3, statusOrder[a.status_ru] ?? 3)
      const bRank = Math.min(statusOrder[b.status_en] ?? 3, statusOrder[b.status_ru] ?? 3)
      if (aRank !== bRank) return aRank - bRank
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })

    return NextResponse.json({ texts: combined })
  } catch (error) {
    console.error("[v0] Get texts error:", error)
    return NextResponse.json({ error: "Failed to fetch texts" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const keys: string[] = Array.isArray(body?.keys) ? body.keys : []
    if (!keys.length) {
      return NextResponse.json({ error: "No keys provided" }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase.from("texts").delete().in("key", keys)
    if (error) throw error

    return NextResponse.json({ success: true, deleted: keys.length })
  } catch (error) {
    console.error("[v0] Delete texts error:", error)
    return NextResponse.json({ error: "Failed to delete texts" }, { status: 500 })
  }
}
