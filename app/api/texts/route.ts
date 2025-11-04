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
    const { data: activeProject } = await supabase.from("projects").select("id").eq("is_active", true).single()

    let query = supabase
      .from("texts")
      .select("*")
      .eq("lang", lang)
      .eq(activeProject ? "project_id" : "lang", activeProject ? activeProject.id : lang) // if no project table yet, keep working
      .order("updated_at", { ascending: false })

    if (status) {
      query = query.eq("status", status)
    }

    if (category && category !== "all") {
      query = query.eq("category", category)
    }

    if (q) {
      query = query.or(`key.ilike.%${q}%,value.ilike.%${q}%`)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    // Client wants: Review (in_review) on top, then Draft, then Done (approved)
    const statusOrder: Record<string, number> = { in_review: 0, draft: 1, approved: 2 }
    const sorted = (data || []).slice().sort((a: any, b: any) => {
      const sa = statusOrder[a.status] ?? 3
      const sb = statusOrder[b.status] ?? 3
      if (sa !== sb) return sa - sb
      // within same status, sort by updated_at desc
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })

    return NextResponse.json({ texts: sorted })
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
