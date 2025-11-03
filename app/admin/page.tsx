"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import useSWR from "swr"
import type { TextKey, TextStatus, Project } from "@/lib/types"
import { EditTextDialog } from "@/components/edit-text-dialog"
import { useRouter } from "next/navigation"
import { Download, LogOut, Search, Settings, FolderOpen } from "lucide-react"
import Link from "next/link"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function AdminPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all") // Added category filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [editingText, setEditingText] = useState<TextKey | null>(null)
  const router = useRouter()

  const queryParams = new URLSearchParams()
  if (statusFilter !== "all") queryParams.set("status", statusFilter)
  if (categoryFilter !== "all") queryParams.set("category", categoryFilter) // Added category to query params
  if (searchQuery) queryParams.set("q", searchQuery)

  const { data, mutate, isLoading } = useSWR<{ texts: TextKey[] }>(`/api/texts?${queryParams.toString()}`, fetcher)
  const { data: projectsData } = useSWR<{ projects: Project[] }>("/api/projects", fetcher)
  const { data: categoriesData } = useSWR<{ categories: string[] }>("/api/texts/categories", fetcher) // Fetch categories

  const activeProject = projectsData?.projects.find((p) => p.is_active)

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
    const variants: Record<TextStatus, "default" | "secondary" | "outline"> = {
      draft: "secondary",
      in_review: "default",
      approved: "outline",
    }
    return <Badge variant={variants[status]}>{status}</Badge>
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">TextSync Admin</h1>
            {activeProject && (
              <p className="text-sm text-muted-foreground mt-1">
                Active: {activeProject.name} → {activeProject.github_owner}/{activeProject.github_repo}
              </p>
            )}
          </div>
          <div className="flex gap-2">
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
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categoriesData?.categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-3 w-3" />
                    {cat}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                  <TableHead>Category</TableHead> {/* Added category column */}
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
                        <Badge variant="secondary" className="font-mono text-xs">
                          {text.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{text.key}</TableCell>
                      <TableCell className="max-w-md truncate">{text.value}</TableCell>
                      <TableCell>{getStatusBadge(text.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(text.updated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setEditingText(text)}>
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {editingText && (
        <EditTextDialog
          text={editingText}
          onClose={() => setEditingText(null)}
          onSave={() => {
            mutate()
            setEditingText(null)
          }}
        />
      )}
    </div>
  )
}
