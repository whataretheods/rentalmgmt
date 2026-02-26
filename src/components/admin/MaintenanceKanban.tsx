"use client"

import { useState, useEffect, useCallback } from "react"
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd"
import { MaintenanceCard, type MaintenanceRequestData } from "./MaintenanceCard"
import { toast } from "sonner"

const STATUS_COLUMNS = [
  { id: "submitted", label: "Submitted", color: "bg-yellow-100 border-yellow-300" },
  { id: "acknowledged", label: "Acknowledged", color: "bg-blue-100 border-blue-300" },
  { id: "in_progress", label: "In Progress", color: "bg-orange-100 border-orange-300" },
  { id: "resolved", label: "Resolved", color: "bg-green-100 border-green-300" },
] as const

interface Unit {
  id: string
  unitNumber: string
}

export default function MaintenanceKanban() {
  const [requests, setRequests] = useState<MaintenanceRequestData[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [unitFilter, setUnitFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const fetchRequests = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (unitFilter) params.set("unitId", unitFilter)
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)

      const qs = params.toString()
      const res = await fetch(`/api/admin/maintenance${qs ? `?${qs}` : ""}`)
      if (res.ok) {
        const data = await res.json()
        setRequests(data.requests)
      }
    } catch {
      toast.error("Failed to load maintenance requests")
    } finally {
      setLoading(false)
    }
  }, [unitFilter, dateFrom, dateTo])

  // Fetch units for filter dropdown
  useEffect(() => {
    async function fetchUnits() {
      try {
        const res = await fetch("/api/admin/units")
        if (res.ok) {
          const data = await res.json()
          setUnits(data.units || [])
        }
      } catch {
        // non-critical
      }
    }
    fetchUnits()
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  function getColumnRequests(status: string) {
    return requests.filter((r) => r.status === status)
  }

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return

    const newStatus = result.destination.droppableId
    const oldStatus = result.source.droppableId
    if (newStatus === oldStatus) return

    const requestId = result.draggableId

    // Optimistic update
    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId ? { ...r, status: newStatus } : r
      )
    )

    try {
      const res = await fetch(`/api/maintenance/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      // Refetch to get fully updated data
      fetchRequests()
    } catch {
      // Revert optimistic update
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId ? { ...r, status: oldStatus } : r
        )
      )
      toast.error("Failed to update request status")
    }
  }

  function clearFilters() {
    setUnitFilter("")
    setDateFrom("")
    setDateTo("")
  }

  const hasFilters = unitFilter || dateFrom || dateTo

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Loading maintenance requests...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 bg-white rounded-lg border p-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Unit</label>
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="rounded-md border bg-transparent px-2 py-1.5 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">All units</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                Unit {u.unitNumber}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-md border bg-transparent px-2 py-1.5 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-md border bg-transparent px-2 py-1.5 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-blue-600 hover:underline pb-1.5"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Kanban board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map((col) => {
            const colRequests = getColumnRequests(col.id)
            return (
              <div
                key={col.id}
                className="flex-shrink-0 w-72"
              >
                {/* Column header */}
                <div
                  className={`rounded-t-lg border-b-2 px-3 py-2 ${col.color}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">
                      {col.label}
                    </span>
                    <span className="text-xs font-medium text-gray-500 bg-white/70 rounded-full px-2 py-0.5">
                      {colRequests.length}
                    </span>
                  </div>
                </div>

                {/* Droppable area */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[200px] space-y-2 rounded-b-lg border border-t-0 p-2 transition-colors ${
                        snapshot.isDraggingOver
                          ? "bg-gray-50"
                          : "bg-gray-50/30"
                      }`}
                    >
                      {colRequests.map((request, index) => (
                        <Draggable
                          key={request.id}
                          draggableId={request.id}
                          index={index}
                        >
                          {(dragProvided) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                            >
                              <MaintenanceCard request={request} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>
    </div>
  )
}
