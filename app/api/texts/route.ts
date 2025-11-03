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
    let query = supabase
      .from("texts")
      .select("*")
      .eq("lang", lang)
      .order("category")
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

    return NextResponse.json({ texts: data || [] })
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
