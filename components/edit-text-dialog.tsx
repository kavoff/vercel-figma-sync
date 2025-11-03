"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState } from "react"
import type { TextKey, TextStatus } from "@/lib/types"

interface EditTextDialogProps {
  text: TextKey
  onClose: () => void
  onSave: () => void
}

export function EditTextDialog({ text, onClose, onSave }: EditTextDialogProps) {
  const [value, setValue] = useState(text.value)
  const [status, setStatus] = useState<TextStatus>(text.status)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/texts/${text.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, status }),
      })

      if (!response.ok) {
        throw new Error("Failed to save")
      }

      onSave()
    } catch (error) {
      console.error("[v0] Save error:", error)
      alert("Failed to save text")
    } finally {
      setIsSaving(false)
    }
  }

  const handleApprove = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/texts/${text.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, status: "approved" }),
      })

      if (!response.ok) {
        throw new Error("Failed to approve")
      }

      onSave()
    } catch (error) {
      console.error("[v0] Approve error:", error)
      alert("Failed to approve text")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Text</DialogTitle>
          <DialogDescription className="font-mono text-sm">{text.key}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="value">Value</Label>
            <Textarea
              id="value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={6}
              className="font-sans"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TextStatus)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            <p>Last updated: {new Date(text.updated_at).toLocaleString()}</p>
            {text.sources.figmaFileId && <p>Figma File: {text.sources.figmaFileId}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
          {status !== "approved" && (
            <Button onClick={handleApprove} disabled={isSaving} variant="default">
              {isSaving ? "Approving..." : "Approve"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
