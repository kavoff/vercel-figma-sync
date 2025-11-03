"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useState } from "react"
import useSWR from "swr"
import type { Project } from "@/lib/types"
import { ArrowLeft, Plus, Trash2, Check } from "lucide-react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function ProjectsPage() {
  const { data, mutate, isLoading } = useSWR<{ projects: Project[] }>("/api/projects", fetcher)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    github_token: "",
    github_owner: "",
    github_repo: "",
    github_branch: "main",
    github_path: "locales/ru.json",
  })

  const handleCreate = async () => {
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, is_active: false }),
      })

      if (!response.ok) throw new Error("Failed to create project")

      await mutate()
      setIsCreating(false)
      setFormData({
        name: "",
        github_token: "",
        github_owner: "",
        github_repo: "",
        github_branch: "main",
        github_path: "locales/ru.json",
      })
    } catch (error) {
      console.error("[v0] Create project error:", error)
      alert("Failed to create project")
    }
  }

  const handleSetActive = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      })

      if (!response.ok) throw new Error("Failed to set active project")

      await mutate()
    } catch (error) {
      console.error("[v0] Set active project error:", error)
      alert("Failed to set active project")
    }
  }

  const handleDelete = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete project")

      await mutate()
    } catch (error) {
      console.error("[v0] Delete project error:", error)
      alert("Failed to delete project")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">GitHub Projects</h1>
          </div>
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Project
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>About Projects</CardTitle>
            <CardDescription>
              Configure GitHub repositories for automatic text synchronization. Only one project can be active at a
              time. When texts are approved, they will be automatically pushed to the active project's repository.
            </CardDescription>
          </CardHeader>
        </Card>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading projects...</div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No projects configured. Add a project to enable GitHub synchronization.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {project.github_owner}/{project.github_repo}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{project.github_branch}</TableCell>
                      <TableCell className="font-mono text-sm">{project.github_path}</TableCell>
                      <TableCell>
                        {project.is_active ? (
                          <Badge variant="default">
                            <Check className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!project.is_active && (
                            <Button variant="ghost" size="sm" onClick={() => handleSetActive(project.id)}>
                              Set Active
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(project.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add GitHub Project</DialogTitle>
            <DialogDescription>Configure a new GitHub repository for text synchronization.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                placeholder="My Project"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="token">GitHub Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={formData.github_token}
                onChange={(e) => setFormData({ ...formData, github_token: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Create at: Settings → Developer settings → Personal access tokens
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="owner">Repository Owner</Label>
                <Input
                  id="owner"
                  placeholder="mycompany"
                  value={formData.github_owner}
                  onChange={(e) => setFormData({ ...formData, github_owner: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="repo">Repository Name</Label>
                <Input
                  id="repo"
                  placeholder="translations"
                  value={formData.github_repo}
                  onChange={(e) => setFormData({ ...formData, github_repo: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  placeholder="main"
                  value={formData.github_branch}
                  onChange={(e) => setFormData({ ...formData, github_branch: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="path">File Path</Label>
                <Input
                  id="path"
                  placeholder="locales/ru.json"
                  value={formData.github_path}
                  onChange={(e) => setFormData({ ...formData, github_path: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
