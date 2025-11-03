import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    // Get distinct categories
    const { data, error } = await supabase.from("texts").select("category").order("category")

    if (error) {
      throw error
    }

    // Extract unique categories
    const categories = [...new Set(data?.map((item) => item.category) || [])]

    return NextResponse.json({ categories })
  } catch (error) {
    console.error("[v0] Get categories error:", error)
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 })
  }
}
