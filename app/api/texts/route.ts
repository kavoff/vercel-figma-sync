import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] GET /api/texts - starting")
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status")
    const category = searchParams.get("category")
    const q = searchParams.get("q")

    const supabase = await createClient()

    const { data: activeProject } = await supabase
      .from("projects")
      .select("id")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    console.log("[v0] Active project:", activeProject?.id || "none")

    let query = supabase
      .from("texts")
      .select("*")
      .order("updated_at", { ascending: false })

    if (activeProject?.id) {
      query = query.eq("project_id", activeProject.id)
    }

    if (status) {
      query = query.eq("status", status)
    }

    if (category && category !== "all") {
      query = query.eq("category", category)
    }

    if (q) {
      query = query.or(`key.ilike.%${q}%,value_en.ilike.%${q}%,value_ru.ilike.%${q}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error("[v0] Get texts query error:", error)
      throw error
    }

    console.log("[v0] Found texts:", data?.length || 0)

    const statusOrder: Record<string, number> = { in_review: 0, draft: 1, approved: 2 }
    const sorted = (data || []).slice().sort((a: any, b: any) => {
      const sa = statusOrder[a.status] ?? 3
      const sb = statusOrder[b.status] ?? 3
      if (sa !== sb) return sa - sb
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })

    return NextResponse.json({ texts: sorted })
  } catch (error) {
    console.error("[v0] Get texts error:", error)
    return NextResponse.json({ texts: [], error: "Failed to fetch texts" }, { status: 200 })
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
