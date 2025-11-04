"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import useSWR from "swr"
import type { TextStatus, ProjectSafe as Project } from "@/lib/types"
import { EditTextDialog } from "@/components/edit-text-dialog"
import { useRouter } from "next/navigation"
import { Download, LogOut, Search, Settings, FolderOpen } from "lucide-react"
import Link from "next/link"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function AdminPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [editingText, setEditingText] = useState<TextKey | null>(null)
  const router = useRouter()

  const queryParams = new URLSearchParams()
  if (statusFilter !== "all") queryParams.set("status", statusFilter)
  if (searchQuery) queryParams.set("q", searchQuery)

  const { data, mutate, isLoading } = useSWR<{ texts: Array<{ key: string; value_en?: string; value_ru?: string; status_en?: TextStatus; status_ru?: TextStatus; updated_at: string }> }>(`/api/texts?${queryParams.toString()}`, fetcher)
  const { data: projectsData } = useSWR<{ projects: Project[] }>("/api/projects", fetcher)
  // categories are not used anymore

  const activeProject = projectsData?.projects.find((p) => p.is_active)
  const [syncLoading, setSyncLoading] = useState(false)

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  const handleExportJSON = async () => {
    const response = await fetch("/api/export/json?lang=ru")
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "ru.json"
    a.click()
  }

  const getStatusBadge = (status: TextStatus) => {
    // grey (draft), yellow (in_review), green (approved)
    const label = status === "draft" ? "Draft" : status === "in_review" ? "To review" : "Done"
    const className =
      status === "draft"
        ? "bg-muted text-foreground"
        : status === "in_review"
        ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
        : "bg-green-100 text-green-800 border border-green-300"
    return <Badge className={className}>{label}</Badge>
  }

  const updateText = async (key: string, updates: { key?: string; value?: string; status?: TextStatus; lang?: "en" | "ru" }) => {
    await fetch(`/api/texts/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
  }

  const timersRef = (typeof window !== 'undefined' ? (window as any) : {}) as { __textsyncTimers?: Record<string, any> }
  if (!timersRef.__textsyncTimers) timersRef.__textsyncTimers = {}
  const markedRef = (typeof window !== 'undefined' ? (window as any) : {}) as { __textsyncMarked?: Record<string, boolean> }
  if (!markedRef.__textsyncMarked) markedRef.__textsyncMarked = {}

  const scheduleSave = (key: string, updates: Partial<Pick<TextKey, "value">>, delay = 800) => {
    const timers = timersRef.__textsyncTimers!
    if (timers[key]) clearTimeout(timers[key])
    timers[key] = setTimeout(async () => {
      await updateText(key, updates)
      // no immediate mutate to avoid UI jank
    }, delay)
  }

  const toggleSelected = (k: string, checked: boolean) => {
    setSelected((prev) => ({ ...prev, [k]: checked }))
  }

  const deleteSelected = async () => {
    const keys = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k)
    if (keys.length === 0) return
    if (!confirm(`Delete ${keys.length} item(s)?`)) return
    await fetch("/api/texts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys }) })
    setSelected({})
    mutate()
  }

  const toggleSelectAll = (checked: boolean) => {
    const map: Record<string, boolean> = {}
    for (const t of data?.texts || []) map[t.key] = checked
    setSelected(map)
  }

  const bulkChangeStatus = async (status: TextStatus) => {
    const keys = Object.entries(selected).filter(([, v]) => v).map(([k]) => k)
    if (!keys.length) return
    await Promise.all(keys.map((k) => updateText(k, { status })))
    mutate()
  }

  const syncSelected = async () => {
    const keys = Object.entries(selected).filter(([, v]) => v).map(([k]) => k)
    if (!keys.length) return
    setSyncLoading(true)
    try {
      const res = await fetch("/api/sync/github?lang=ru", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys }),
      })
      if (!res.ok) throw new Error("Sync failed")
      const j = await res.json()
      alert(`Synced ${j.count ?? 0} selected item(s) to GitHub`)
    } catch {
      alert("Failed to sync selected to GitHub")
    } finally {
      setSyncLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">TextSync Admin</h1>
            {activeProject && (
              <p className="text-sm text-muted-foreground mt-1">
                Active: {activeProject.name} → {activeProject.github_owner}/{activeProject.github_repo} · {activeProject.github_path}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={async () => {
              try {
                setSyncLoading(true)
                const res = await fetch("/api/sync/github?lang=ru", { method: "POST" })
                if (!res.ok) throw new Error("Sync failed")
                const data = await res.json()
                alert(`Synced ${data.count ?? 0} items to GitHub`)
              } catch (e) {
                alert("Failed to sync to GitHub")
              } finally {
                setSyncLoading(false)
              }
            }} variant="default" size="sm" disabled={syncLoading || !activeProject}>
              {syncLoading ? "Syncing..." : "Sync to GitHub"}
            </Button>
            <Link href="/admin/projects">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Projects
              </Button>
            </Link>
            <Button onClick={handleExportJSON} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by key or value..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="destructive" onClick={deleteSelected} disabled={Object.values(selected).every((v) => !v)}>
            Delete selected
          </Button>
          <Select onValueChange={(v) => bulkChangeStatus(v as TextStatus)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Change status (bulk)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="in_review">To review</SelectItem>
              <SelectItem value="approved">Done</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={syncSelected} disabled={Object.values(selected).every((v) => !v) || syncLoading}>
            {syncLoading ? "Syncing..." : "Sync selected"}
          </Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading texts...</div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      checked={!!data?.texts.length && Object.values(selected).filter(Boolean).length === data?.texts.length}
                    />
                  </TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.texts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No texts found. Export from Figma to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.texts.map((text) => (
                    <TableRow key={text.key}>
                      <TableCell>
                        <input type="checkbox" checked={!!selected[text.key]} onChange={(e) => toggleSelected(text.key, e.target.checked)} />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <Input
                          defaultValue={text.key}
                          onBlur={async (e) => {
                            const newKey = e.target.value
                            if (newKey && newKey !== text.key) {
                              await updateText(text.key, { key: newKey, status: "in_review" })
                              mutate()
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="max-w-md">
                        <Input
                          defaultValue={text.value_en || ""}
                          onChange={async (e) => {
                            const newVal = e.target.value
                            // mark status once per row
                            if (!markedRef.__textsyncMarked![text.key]) {
                              markedRef.__textsyncMarked![text.key] = true
                              await updateText(text.key, { status: "in_review", lang: "en" })
                            }
                            scheduleSave(text.key, { value: newVal, lang: "en" } as any)
                          }}
                          onBlur={async (e) => {
                            const newVal = e.target.value
                            await updateText(text.key, { value: newVal, lang: "en" })
                          }}
                        />
                      </TableCell>
                      <TableCell className="max-w-md">
                        <Input
                          defaultValue={text.value_ru || ""}
                          onChange={async (e) => {
                            const newVal = e.target.value
                            if (!markedRef.__textsyncMarked![text.key + ":ru"]) {
                              markedRef.__textsyncMarked![text.key + ":ru"] = true
                              await updateText(text.key, { status: "in_review", lang: "ru" })
                            }
                            scheduleSave(text.key, { value: newVal, lang: "ru" } as any)
                          }}
                          onBlur={async (e) => {
                            const newVal = e.target.value
                            await updateText(text.key, { value: newVal, lang: "ru" })
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(text.status)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(text.updated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={text.status}
                          onValueChange={async (v) => {
                            const newStatus = v as TextStatus
                            await updateText(text.key, { status: newStatus })
                            mutate()
                          }}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Change status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="in_review">To review</SelectItem>
                            <SelectItem value="approved">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

    </div>
  )
}
