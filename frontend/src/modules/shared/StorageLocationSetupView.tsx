import React, { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { useToast } from "../../context/ToastContext";
import { useConfirmation } from "../../context/ConfirmationContext";
import {
  StorageLocationItem,
  StorageLocationPayload,
} from "../../services/api/admin/adminStorageLocationService";

interface StorageLocationSetupViewProps {
  role: "admin" | "seller";
  fetchLocationsApi: (params?: any) => Promise<{ success: boolean; data: StorageLocationItem[] }>;
  createLocationApi: (data: StorageLocationPayload) => Promise<{ success: boolean; data: any }>;
  updateLocationApi: (id: string, data: Partial<StorageLocationPayload>) => Promise<{ success: boolean; data: any }>;
  deleteLocationApi: (id: string) => Promise<{ success: boolean; message: string }>;
}

type TabType = "city" | "warehouse" | "room" | "rack" | "all";

interface ParsedImportRow {
  level: "city" | "warehouse" | "room" | "rack";
  name: string;
  city: string;
  warehouse?: string;
  room?: string;
  rackNumber?: string;
  code?: string;
  isValid: boolean;
  error?: string;
}

export default function StorageLocationSetupView({
  role,
  fetchLocationsApi,
  createLocationApi,
  updateLocationApi,
  deleteLocationApi,
}: StorageLocationSetupViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("city");
  const [locations, setLocations] = useState<StorageLocationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  // Import / Export state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ total: 0, current: 0, success: 0, failed: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [code, setCode] = useState("");

  const { showToast } = useToast();
  const confirmation = useConfirmation();

  // Load all locations
  const loadLocations = async () => {
    setLoading(true);
    try {
      const res = await fetchLocationsApi();
      if (res.success && Array.isArray(res.data)) {
        setLocations(res.data);
      }
    } catch (err: any) {
      console.error("Failed to load locations", err);
      showToast(err.message || "Failed to load storage locations", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  // Derived lists
  const cities = useMemo(() => {
    const cityItems = locations.filter((l) => l.level === "city" || l.city);
    const unique = Array.from(new Set(cityItems.map((c) => c.city || c.name))).filter(Boolean);
    return unique.sort();
  }, [locations]);

  const warehousesForSelectedCity = useMemo(() => {
    if (!selectedCity) return [];
    const whItems = locations.filter(
      (l) => (l.level === "warehouse" || l.warehouse) && l.city === selectedCity
    );
    const unique = Array.from(
      new Set(whItems.map((w) => w.warehouse || (w.level === "warehouse" ? w.name : "")))
    ).filter(Boolean);
    return unique.sort();
  }, [locations, selectedCity]);

  const roomsForSelectedWarehouse = useMemo(() => {
    if (!selectedCity || !selectedWarehouse) return [];
    const roomItems = locations.filter(
      (l) =>
        (l.level === "room" || l.room) &&
        l.city === selectedCity &&
        l.warehouse === selectedWarehouse
    );
    const unique = Array.from(
      new Set(roomItems.map((r) => r.room || (r.level === "room" ? r.name : "")))
    ).filter(Boolean);
    return unique.sort();
  }, [locations, selectedCity, selectedWarehouse]);

  // Filtered table data for the active tab
  const tableData = useMemo(() => {
    return locations.filter((loc) => {
      if (activeTab !== "all" && loc.level !== activeTab) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        loc.name?.toLowerCase().includes(q) ||
        loc.city?.toLowerCase().includes(q) ||
        loc.warehouse?.toLowerCase().includes(q) ||
        loc.room?.toLowerCase().includes(q) ||
        loc.rackNumber?.toLowerCase().includes(q) ||
        loc.code?.toLowerCase().includes(q)
      );
    });
  }, [locations, activeTab, search]);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    return {
      city: locations.filter((l) => l.level === "city").length,
      warehouse: locations.filter((l) => l.level === "warehouse").length,
      room: locations.filter((l) => l.level === "room").length,
      rack: locations.filter((l) => l.level === "rack").length,
      all: locations.length,
    };
  }, [locations]);

  // Reset form
  const handleReset = () => {
    setEditId(null);
    setName("");
    setCode("");
    // Keep selections if continuing in same parent context
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    handleReset();
    setSearch("");
  };

  // Submit create or update
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast(`Please enter ${activeTab} name`, "error");
      return;
    }

    if (activeTab === "warehouse" && !selectedCity) {
      showToast("Please select a City for this Warehouse", "error");
      return;
    }

    if (activeTab === "room") {
      if (!selectedCity) {
        showToast("Please select a City", "error");
        return;
      }
      if (!selectedWarehouse) {
        showToast("Please select a Warehouse", "error");
        return;
      }
    }

    if (activeTab === "rack") {
      if (!selectedCity) {
        showToast("Please select a City", "error");
        return;
      }
      if (!selectedWarehouse) {
        showToast("Please select a Warehouse", "error");
        return;
      }
      if (!selectedRoom) {
        showToast("Please select a Room", "error");
        return;
      }
    }

    if (activeTab === "all") {
      showToast("Please select a specific tab (City, Warehouse, Room, or Rack) to add a location", "info");
      return;
    }

    setSubmitting(true);
    try {
      const payload: StorageLocationPayload = {
        level: activeTab,
        name: name.trim(),
        code: code.trim(),
        city: activeTab === "city" ? name.trim() : selectedCity,
        warehouse: activeTab === "warehouse" ? name.trim() : selectedWarehouse,
        room: activeTab === "room" ? name.trim() : selectedRoom,
        rackNumber: activeTab === "rack" ? name.trim() : undefined,
      };

      if (editId) {
        await updateLocationApi(editId, payload);
        showToast(`${activeTab.toUpperCase()} updated successfully`, "success");
      } else {
        await createLocationApi(payload);
        showToast(`${activeTab.toUpperCase()} added successfully`, "success");
      }

      handleReset();
      await loadLocations();
    } catch (err: any) {
      showToast(err.message || "Failed to save location", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Edit item
  const handleEdit = (item: StorageLocationItem) => {
    if (item.level) {
      setActiveTab(item.level);
    }
    setEditId(item._id);
    setName(item.name || item.rackNumber || item.room || item.warehouse || item.city || "");
    setCode(item.code || "");
    if (item.city) setSelectedCity(item.city);
    if (item.warehouse) setSelectedWarehouse(item.warehouse);
    if (item.room) setSelectedRoom(item.room);
    showToast(`Editing ${item.level?.toUpperCase() || "location"} "${item.name || item.city}"`, "info");
  };

  // Delete item with cascade confirmation
  const handleDelete = (item: StorageLocationItem) => {
    const isParent = item.level === "city" || item.level === "warehouse" || item.level === "room";
    const warningMsg = isParent
      ? `Are you sure you want to delete this ${item.level} "${item.name}"? Note: All associated nested warehouses, rooms, and racks under it will also be deleted!`
      : `Are you sure you want to delete Rack "${item.name}"?`;

    confirmation.openConfirmation({
      title: `Confirm Delete ${item.level.toUpperCase()}`,
      message: warningMsg,
      onConfirm: async () => {
        try {
          await deleteLocationApi(item._id);
          showToast(`${item.level} deleted successfully`, "success");
          if (editId === item._id) handleReset();
          await loadLocations();
        } catch (err: any) {
          showToast(err.message || "Failed to delete item", "error");
        }
      },
      confirmText: "Delete",
      confirmButtonClass: "bg-red-600 hover:bg-red-700 text-white",
    });
  };

  // Export storage locations to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      if (locations.length === 0) {
        showToast("No locations available to export", "info");
        return;
      }

      // Sheet 1: All Locations
      const allRows = locations.map((loc, idx) => ({
        "SL": idx + 1,
        "Level": loc.level.toUpperCase(),
        "City Name": loc.city || (loc.level === "city" ? loc.name : ""),
        "Warehouse Name": loc.warehouse || (loc.level === "warehouse" ? loc.name : ""),
        "Warehouse Code": loc.code || "",
        "Room Name": loc.room || (loc.level === "room" ? loc.name : ""),
        "Rack Number": loc.rackNumber || (loc.level === "rack" ? loc.name : ""),
        "Item Name": loc.name,
        "Status": loc.isActive !== false ? "Active" : "Inactive",
      }));

      // Sheet 2: Cities
      const cityRows = locations
        .filter((l) => l.level === "city")
        .map((c, idx) => ({
          "SL": idx + 1,
          "City Name": c.name || c.city,
        }));

      // Sheet 3: Warehouses
      const whRows = locations
        .filter((l) => l.level === "warehouse")
        .map((w, idx) => ({
          "SL": idx + 1,
          "City": w.city,
          "Warehouse Name": w.name || w.warehouse,
          "Warehouse Code": w.code || "",
        }));

      // Sheet 4: Rooms
      const roomRows = locations
        .filter((l) => l.level === "room")
        .map((r, idx) => ({
          "SL": idx + 1,
          "City": r.city,
          "Warehouse": r.warehouse,
          "Room Name": r.name || r.room,
        }));

      // Sheet 5: Racks
      const rackRows = locations
        .filter((l) => l.level === "rack")
        .map((rk, idx) => ({
          "SL": idx + 1,
          "City": rk.city,
          "Warehouse": rk.warehouse,
          "Room": rk.room,
          "Rack Number": rk.name || rk.rackNumber,
        }));

      const wb = XLSX.utils.book_new();

      const wsAll = XLSX.utils.json_to_sheet(allRows);
      XLSX.utils.book_append_sheet(wb, wsAll, "All Locations");

      if (cityRows.length > 0) {
        const wsCity = XLSX.utils.json_to_sheet(cityRows);
        XLSX.utils.book_append_sheet(wb, wsCity, "Cities");
      }
      if (whRows.length > 0) {
        const wsWH = XLSX.utils.json_to_sheet(whRows);
        XLSX.utils.book_append_sheet(wb, wsWH, "Warehouses");
      }
      if (roomRows.length > 0) {
        const wsRoom = XLSX.utils.json_to_sheet(roomRows);
        XLSX.utils.book_append_sheet(wb, wsRoom, "Rooms");
      }
      if (rackRows.length > 0) {
        const wsRack = XLSX.utils.json_to_sheet(rackRows);
        XLSX.utils.book_append_sheet(wb, wsRack, "Rack Numbers");
      }

      const dateStr = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `Storage_Locations_All_${role}_${dateStr}.xlsx`);
      showToast("All storage locations exported to Excel successfully!", "success");
    } catch (err: any) {
      console.error("Export error:", err);
      showToast(err.message || "Failed to export Excel", "error");
    }
  };

  // Export only current active tab table data to Excel
  const handleExportCurrentTab = () => {
    try {
      if (tableData.length === 0) {
        showToast(`No ${activeTab} data to export`, "info");
        return;
      }

      let exportRows: any[] = [];
      if (activeTab === "city") {
        exportRows = tableData.map((item, idx) => ({
          "SL": idx + 1,
          "City Name": item.name || item.city,
        }));
      } else if (activeTab === "warehouse") {
        exportRows = tableData.map((item, idx) => ({
          "SL": idx + 1,
          "City": item.city,
          "Warehouse Name": item.name || item.warehouse,
          "Warehouse Code": item.code || "-",
        }));
      } else if (activeTab === "room") {
        exportRows = tableData.map((item, idx) => ({
          "SL": idx + 1,
          "City": item.city,
          "Warehouse": item.warehouse,
          "Room Name": item.name || item.room,
        }));
      } else if (activeTab === "rack") {
        exportRows = tableData.map((item, idx) => ({
          "SL": idx + 1,
          "City": item.city,
          "Warehouse": item.warehouse,
          "Room": item.room,
          "Rack Number": item.name || item.rackNumber,
        }));
      } else if (activeTab === "all") {
        exportRows = tableData.map((item, idx) => {
          const parts = [item.city, item.warehouse, item.room, item.rackNumber || (item.level === "rack" ? item.name : "")].filter(Boolean);
          return {
            "SL": idx + 1,
            "Level": item.level.toUpperCase(),
            "City": item.city || (item.level === "city" ? item.name : "-"),
            "Warehouse": item.warehouse || (item.level === "warehouse" ? item.name : "-"),
            "Room": item.room || (item.level === "room" ? item.name : "-"),
            "Rack Number": item.rackNumber || (item.level === "rack" ? item.name : "-"),
            "Full Storage Path": parts.join(" ➔ "),
            "Code": item.code || "-",
          };
        });
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const sheetTitle = `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} List`;
      XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

      const dateStr = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `${activeTab.toUpperCase()}_Master_${dateStr}.xlsx`);
      showToast(`${sheetTitle} exported successfully!`, "success");
    } catch (err: any) {
      console.error("Export current tab error:", err);
      showToast(err.message || "Failed to export data", "error");
    }
  };

  // Download Sample Template for Bulk Import
  const handleDownloadSampleTemplate = () => {
    try {
      const sampleRows = [
        {
          "Level": "city",
          "City Name": "Mumbai",
          "Warehouse Name": "",
          "Warehouse Code": "",
          "Room Name": "",
          "Rack Number": "",
        },
        {
          "Level": "warehouse",
          "City Name": "Mumbai",
          "Warehouse Name": "Mumbai Central Warehouse (MC-01)",
          "Warehouse Code": "MC-01",
          "Room Name": "",
          "Rack Number": "",
        },
        {
          "Level": "room",
          "City Name": "Mumbai",
          "Warehouse Name": "Mumbai Central Warehouse (MC-01)",
          "Warehouse Code": "",
          "Room Name": "Room A",
          "Rack Number": "",
        },
        {
          "Level": "rack",
          "City Name": "Mumbai",
          "Warehouse Name": "Mumbai Central Warehouse (MC-01)",
          "Warehouse Code": "",
          "Room Name": "Room A",
          "Rack Number": "Rack 1",
        },
        {
          "Level": "rack",
          "City Name": "Delhi",
          "Warehouse Name": "Okhla Warehouse (OW-01)",
          "Warehouse Code": "OW-01",
          "Room Name": "Room 101",
          "Rack Number": "Rack R1",
        },
      ];

      const instructions = [
        { "Instructions": "1. 'Level' can be 'city', 'warehouse', 'room', or 'rack'." },
        { "Instructions": "2. For 'city': Fill 'City Name'." },
        { "Instructions": "3. For 'warehouse': Fill 'City Name', 'Warehouse Name', and optionally 'Warehouse Code'." },
        { "Instructions": "4. For 'room': Fill 'City Name', 'Warehouse Name', and 'Room Name'." },
        { "Instructions": "5. For 'rack': Fill 'City Name', 'Warehouse Name', 'Room Name', and 'Rack Number'." },
        { "Instructions": "6. Note: If parent cities/warehouses/rooms don't exist yet, our bulk importer will automatically create them for you!" },
      ];

      const wb = XLSX.utils.book_new();
      const wsData = XLSX.utils.json_to_sheet(sampleRows);
      const wsInfo = XLSX.utils.json_to_sheet(instructions);

      XLSX.utils.book_append_sheet(wb, wsData, "Template");
      XLSX.utils.book_append_sheet(wb, wsInfo, "Instructions");

      XLSX.writeFile(wb, "Storage_Location_Import_Template.xlsx");
      showToast("Sample template downloaded!", "success");
    } catch (err: any) {
      console.error("Template error:", err);
      showToast(err.message || "Failed to download template", "error");
    }
  };

  // Helper to normalize keys
  const normalizeKey = (k: string) => k.toLowerCase().replace(/[\s_-]+/g, "").trim();

  // Read and parse uploaded Excel file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (!rawJson || rawJson.length === 0) {
          showToast("Uploaded sheet contains no data rows", "error");
          setParsedRows([]);
          return;
        }

        const parsed: ParsedImportRow[] = [];

        rawJson.forEach((row) => {
          const map: Record<string, string> = {};
          Object.keys(row).forEach((k) => {
            map[normalizeKey(k)] = String(row[k] ?? "").trim();
          });

          const levelRaw = map["level"] || "";
          const cityName = map["cityname"] || map["city"] || "";
          const warehouseName = map["warehousename"] || map["warehouse"] || "";
          const roomName = map["roomname"] || map["room"] || "";
          const rackName = map["racknumber"] || map["rack"] || map["rackname"] || "";
          const codeVal = map["warehousecode"] || map["code"] || "";

          let inferredLevel: "city" | "warehouse" | "room" | "rack" = "city";
          const lvl = levelRaw.toLowerCase();
          if (lvl.includes("rack") || (!lvl && rackName)) {
            inferredLevel = "rack";
          } else if (lvl.includes("room") || (!lvl && roomName)) {
            inferredLevel = "room";
          } else if (lvl.includes("warehouse") || (!lvl && warehouseName)) {
            inferredLevel = "warehouse";
          } else if (lvl.includes("city") || (!lvl && cityName)) {
            inferredLevel = "city";
          }

          let nameVal = "";
          let isValid = true;
          let error = "";

          if (inferredLevel === "city") {
            nameVal = cityName;
            if (!nameVal) {
              isValid = false;
              error = "City name is required";
            }
          } else if (inferredLevel === "warehouse") {
            nameVal = warehouseName;
            if (!cityName) {
              isValid = false;
              error = "City is required for warehouse";
            } else if (!nameVal) {
              isValid = false;
              error = "Warehouse name is required";
            }
          } else if (inferredLevel === "room") {
            nameVal = roomName;
            if (!cityName || !warehouseName) {
              isValid = false;
              error = "City and Warehouse are required for room";
            } else if (!nameVal) {
              isValid = false;
              error = "Room name is required";
            }
          } else if (inferredLevel === "rack") {
            nameVal = rackName;
            if (!cityName || !warehouseName || !roomName) {
              isValid = false;
              error = "City, Warehouse, and Room are required for rack";
            } else if (!nameVal) {
              isValid = false;
              error = "Rack number is required";
            }
          }

          parsed.push({
            level: inferredLevel,
            name: nameVal,
            city: cityName,
            warehouse: warehouseName,
            room: roomName,
            rackNumber: rackName,
            code: codeVal,
            isValid,
            error,
          });
        });

        setParsedRows(parsed);
      } catch (err: any) {
        console.error("Excel parse error:", err);
        showToast(err.message || "Failed to parse Excel file", "error");
      }
    };
    reader.readAsBinaryString(file);
  };

  // Execute bulk import
  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      showToast("No valid rows to import", "error");
      return;
    }

    setIsImporting(true);
    setImportProgress({ total: validRows.length, current: 0, success: 0, failed: 0 });

    let successCount = 0;
    let failedCount = 0;

    // Order: city -> warehouse -> room -> rack
    const levelOrder: Record<string, number> = { city: 1, warehouse: 2, room: 3, rack: 4 };
    const sorted = [...validRows].sort((a, b) => (levelOrder[a.level] || 99) - (levelOrder[b.level] || 99));

    const createdCities = new Set(cities);
    const createdWarehouses = new Set(locations.filter(l => l.level === "warehouse").map(w => `${w.city}||${w.warehouse || w.name}`));
    const createdRooms = new Set(locations.filter(l => l.level === "room").map(r => `${r.city}||${r.warehouse}||${r.room || r.name}`));

    for (let i = 0; i < sorted.length; i++) {
      const row = sorted[i];

      try {
        if (row.city && !createdCities.has(row.city)) {
          await createLocationApi({
            level: "city",
            name: row.city,
            city: row.city,
          });
          createdCities.add(row.city);
        }

        if (row.city && row.warehouse && !createdWarehouses.has(`${row.city}||${row.warehouse}`)) {
          await createLocationApi({
            level: "warehouse",
            name: row.warehouse,
            city: row.city,
            warehouse: row.warehouse,
            code: row.code || "",
          });
          createdWarehouses.add(`${row.city}||${row.warehouse}`);
        }

        if (row.city && row.warehouse && row.room && !createdRooms.has(`${row.city}||${row.warehouse}||${row.room}`)) {
          await createLocationApi({
            level: "room",
            name: row.room,
            city: row.city,
            warehouse: row.warehouse,
            room: row.room,
          });
          createdRooms.add(`${row.city}||${row.warehouse}||${row.room}`);
        }

        const isCityTarget = row.level === "city";
        const isWarehouseTarget = row.level === "warehouse";
        const isRoomTarget = row.level === "room";

        if (!isCityTarget && !isWarehouseTarget && !isRoomTarget) {
          await createLocationApi({
            level: "rack",
            name: row.name,
            city: row.city,
            warehouse: row.warehouse,
            room: row.room,
            rackNumber: row.name,
          });
        }

        successCount++;
      } catch (err: any) {
        console.error("Row import failed:", row, err);
        failedCount++;
      }

      setImportProgress({
        total: sorted.length,
        current: i + 1,
        success: successCount,
        failed: failedCount,
      });
    }

    setIsImporting(false);
    showToast(`Bulk import completed: ${successCount} imported successfully${failedCount > 0 ? `, ${failedCount} failed` : ""}`, successCount > 0 ? "success" : "error");

    await loadLocations();
    setShowImportModal(false);
    setImportFile(null);
    setParsedRows([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-[var(--primary-color)]/10 p-2.5 rounded-xl text-[var(--primary-color)]">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Storage Location Setup</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage physical inventory locations: City ➔ Warehouse ➔ Room ➔ Rack Number
            </p>
          </div>
        </div>

        {/* Level Quick Badges & Excel Actions */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold shadow-sm transition-all"
            title="Export all storage locations to Excel"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Export to Excel</span>
          </button>

          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-[var(--primary-color)]/10 text-[var(--primary-color)] hover:bg-[var(--primary-color)]/20 border border-[var(--primary-color)]/30 rounded-lg text-xs font-semibold shadow-sm transition-all"
            title="Import storage locations in bulk from Excel"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <span>Bulk Import</span>
          </button>

          <div className="flex items-center gap-2 bg-gray-100/80 p-1 rounded-xl text-xs font-medium border border-gray-200">
            <span className="px-2 py-1 bg-white text-gray-700 rounded-lg shadow-sm font-semibold">
              {role === "admin" ? "Admin Master" : "Seller Master"}
            </span>
            <span className="text-gray-500 px-2">Total Locations: {locations.length}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6 pb-3 border-b border-gray-200">
        <button
          type="button"
          onClick={() => handleTabChange("city")}
          style={activeTab === "city" ? { backgroundColor: "var(--primary-color)", color: "#ffffff" } : {}}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "city"
              ? "text-white shadow-md shadow-[var(--primary-color)]/20"
              : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
          }`}
        >
          <span className={activeTab === "city" ? "force-text-white" : ""}>1. Cities</span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-all ${
              activeTab === "city"
                ? "bg-white text-[var(--primary-color)] shadow-sm"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {tabCounts.city}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("warehouse")}
          style={activeTab === "warehouse" ? { backgroundColor: "var(--primary-color)", color: "#ffffff" } : {}}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "warehouse"
              ? "text-white shadow-md shadow-[var(--primary-color)]/20"
              : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
          }`}
        >
          <span className={activeTab === "warehouse" ? "force-text-white" : ""}>2. Warehouses</span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-all ${
              activeTab === "warehouse"
                ? "bg-white text-[var(--primary-color)] shadow-sm"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {tabCounts.warehouse}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("room")}
          style={activeTab === "room" ? { backgroundColor: "var(--primary-color)", color: "#ffffff" } : {}}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "room"
              ? "text-white shadow-md shadow-[var(--primary-color)]/20"
              : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
          }`}
        >
          <span className={activeTab === "room" ? "force-text-white" : ""}>3. Rooms</span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-all ${
              activeTab === "room"
                ? "bg-white text-[var(--primary-color)] shadow-sm"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {tabCounts.room}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("rack")}
          style={activeTab === "rack" ? { backgroundColor: "var(--primary-color)", color: "#ffffff" } : {}}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "rack"
              ? "text-white shadow-md shadow-[var(--primary-color)]/20"
              : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
          }`}
        >
          <span className={activeTab === "rack" ? "force-text-white" : ""}>4. Rack Numbers</span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-all ${
              activeTab === "rack"
                ? "bg-white text-[var(--primary-color)] shadow-sm"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {tabCounts.rack}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("all")}
          style={activeTab === "all" ? { backgroundColor: "var(--primary-color)", color: "#ffffff" } : {}}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "all"
              ? "text-white shadow-md shadow-[var(--primary-color)]/20"
              : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
          }`}
        >
          <span className={activeTab === "all" ? "force-text-white flex items-center gap-1" : "flex items-center gap-1"}>
            <span>📍</span> All Locations
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-all ${
              activeTab === "all"
                ? "bg-white text-[var(--primary-color)] shadow-sm"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {tabCounts.all}
          </span>
        </button>
      </div>


      {/* Main Grid: Form Left, Table Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Card or Overview Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-fit">
          {activeTab === "all" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <span>📍</span> Storage Hierarchy
                </h2>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-semibold">
                  All Locations
                </span>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                Storage locations are structured hierarchically:
                <br />
                <span className="font-semibold text-gray-700">City ➔ Warehouse ➔ Room ➔ Rack Number</span>
              </p>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg text-xs font-semibold text-blue-900">
                  <span className="flex items-center gap-2"><span>🏙️</span> Cities</span>
                  <span className="bg-blue-200/80 px-2 py-0.5 rounded-full text-blue-900">{tabCounts.city}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-amber-50/60 border border-amber-100 rounded-lg text-xs font-semibold text-amber-900">
                  <span className="flex items-center gap-2"><span>🏭</span> Warehouses</span>
                  <span className="bg-amber-200/80 px-2 py-0.5 rounded-full text-amber-900">{tabCounts.warehouse}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-purple-50/60 border border-purple-100 rounded-lg text-xs font-semibold text-purple-900">
                  <span className="flex items-center gap-2"><span>🚪</span> Rooms</span>
                  <span className="bg-purple-200/80 px-2 py-0.5 rounded-full text-purple-900">{tabCounts.room}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-emerald-50/60 border border-emerald-100 rounded-lg text-xs font-semibold text-emerald-900">
                  <span className="flex items-center gap-2"><span>📦</span> Rack Numbers</span>
                  <span className="bg-emerald-200/80 px-2 py-0.5 rounded-full text-emerald-900">{tabCounts.rack}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-700 mb-2">Quick Add Location:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTabChange("city")}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors text-center"
                  >
                    + Add City
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange("warehouse")}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors text-center"
                  >
                    + Add Warehouse
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange("room")}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors text-center"
                  >
                    + Add Room
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange("rack")}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors text-center"
                  >
                    + Add Rack
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
                <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <span>{editId ? "✏️ Edit" : "➕ Add New"}</span>
                  <span className="capitalize">{activeTab}</span>
                </h2>
                {editId && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded text-xs font-medium">
                    Edit Mode
                  </span>
                )}
              </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* City selector if on warehouse, room, or rack tab */}
            {activeTab !== "city" && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Select City <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCity}
                  onChange={(e) => {
                    setSelectedCity(e.target.value);
                    setSelectedWarehouse("");
                    setSelectedRoom("");
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)] focus:outline-none"
                  required
                >
                  <option value="">-- Choose City --</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {cities.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No cities found. Please add a City in Tab 1 first!
                  </p>
                )}
              </div>
            )}

            {/* Warehouse selector if on room or rack tab */}
            {(activeTab === "room" || activeTab === "rack") && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Select Warehouse <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedWarehouse}
                  onChange={(e) => {
                    setSelectedWarehouse(e.target.value);
                    setSelectedRoom("");
                  }}
                  disabled={!selectedCity}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)] focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  required
                >
                  <option value="">
                    {selectedCity ? "-- Choose Warehouse --" : "-- Select City First --"}
                  </option>
                  {warehousesForSelectedCity.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Room selector if on rack tab */}
            {activeTab === "rack" && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Select Room <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  disabled={!selectedWarehouse}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)] focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  required
                >
                  <option value="">
                    {selectedWarehouse ? "-- Choose Room --" : "-- Select Warehouse First --"}
                  </option>
                  {roomsForSelectedWarehouse.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Primary Name Field */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                {activeTab === "city" && "City Name"}
                {activeTab === "warehouse" && "Warehouse Name / Title"}
                {activeTab === "room" && "Room Name / Number"}
                {activeTab === "rack" && "Rack Number / Identifier"}
                <span className="text-red-500"> *</span>
              </label>
              <input
                type="text"
                placeholder={
                  activeTab === "city"
                    ? "e.g. Mumbai, Delhi, Bangalore"
                    : activeTab === "warehouse"
                    ? "e.g. Mumbai Central Warehouse (MC-01)"
                    : activeTab === "room"
                    ? "e.g. Room A, Room 101"
                    : "e.g. Rack 1, Rack 101, Rack A"
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)] focus:outline-none"
                required
              />
            </div>

            {/* Optional Code for warehouse */}
            {activeTab === "warehouse" && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                  Warehouse Code <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. MC-01, AW-02"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)] focus:outline-none"
                />
              </div>
            )}

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors font-medium"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-[var(--primary-color)] text-white rounded-lg text-sm hover:bg-[var(--primary-dark)] transition-all font-medium shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? "Saving..." : editId ? "Update Location" : `Add ${activeTab}`}
              </button>
            </div>
          </form>
            </div>
          )}
        </div>

        {/* Table / List Card */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {/* Table Header & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-800 capitalize">
                {activeTab} Master List
              </h2>
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-semibold">
                {tableData.length}
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <input
                  type="text"
                  placeholder={
                    activeTab === "city"
                      ? "Search cities..."
                      : activeTab === "warehouse"
                      ? "Search warehouses..."
                      : activeTab === "room"
                      ? "Search rooms..."
                      : "Search rack numbers..."
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary-color)] focus:outline-none"
                />
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              <button
                type="button"
                onClick={handleExportCurrentTab}
                className="p-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-medium transition-all shadow-sm flex items-center gap-1.5"
                title={`Export ${activeTab} list to Excel`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span className="hidden md:inline">Export</span>
              </button>

              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="p-2 text-[var(--primary-color)] bg-[var(--primary-color)]/10 hover:bg-[var(--primary-color)]/20 border border-[var(--primary-color)]/30 rounded-lg text-xs font-medium transition-all shadow-sm flex items-center gap-1.5"
                title="Bulk Import from Excel"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <span className="hidden md:inline">Import</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 font-semibold text-xs uppercase tracking-wider border-y border-gray-200">
                  <th className="px-4 py-3">SL</th>
                  {activeTab === "city" && <th className="px-4 py-3">City Name</th>}
                  {activeTab === "warehouse" && (
                    <>
                      <th className="px-4 py-3">City</th>
                      <th className="px-4 py-3">Warehouse Name</th>
                      <th className="px-4 py-3">Code</th>
                    </>
                  )}
                  {activeTab === "room" && (
                    <>
                      <th className="px-4 py-3">City</th>
                      <th className="px-4 py-3">Warehouse</th>
                      <th className="px-4 py-3">Room Name</th>
                    </>
                  )}
                  {activeTab === "rack" && (
                    <>
                      <th className="px-4 py-3">City</th>
                      <th className="px-4 py-3">Warehouse</th>
                      <th className="px-4 py-3">Room</th>
                      <th className="px-4 py-3">Rack Number</th>
                    </>
                  )}
                  {activeTab === "all" && (
                    <>
                      <th className="px-4 py-3">Level</th>
                      <th className="px-4 py-3">City</th>
                      <th className="px-4 py-3">Warehouse</th>
                      <th className="px-4 py-3">Room</th>
                      <th className="px-4 py-3">Rack Number</th>
                      <th className="px-4 py-3">Full Location Path</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin"></div>
                        <span>Loading storage locations...</span>
                      </div>
                    </td>
                  </tr>
                ) : tableData.length > 0 ? (
                  tableData.map((item, idx) => (
                    <tr
                      key={item._id}
                      className="hover:bg-gray-50/80 transition-colors group"
                    >
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs align-middle">{idx + 1}</td>
                      {activeTab === "city" && (
                        <td className="px-4 py-3 font-medium text-gray-800 align-middle">
                          <div className="flex items-center gap-2">
                            <span className="text-base">🏙️</span>
                            <span>{item.name || item.city}</span>
                          </div>
                        </td>
                      )}
                      {activeTab === "warehouse" && (
                        <>
                          <td className="px-4 py-3 text-gray-600 align-middle">{item.city}</td>
                          <td className="px-4 py-3 font-medium text-gray-800 align-middle">
                            <div className="flex items-center gap-2">
                              <span className="text-base">🏭</span>
                              <span>{item.name || item.warehouse}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 font-mono align-middle">
                            {item.code || "-"}
                          </td>
                        </>
                      )}
                      {activeTab === "room" && (
                        <>
                          <td className="px-4 py-3 text-gray-600 align-middle">{item.city}</td>
                          <td className="px-4 py-3 text-gray-600 align-middle">{item.warehouse}</td>
                          <td className="px-4 py-3 font-medium text-gray-800 align-middle">
                            <div className="flex items-center gap-2">
                              <span className="text-base">🚪</span>
                              <span>{item.name || item.room}</span>
                            </div>
                          </td>
                        </>
                      )}
                      {activeTab === "rack" && (
                        <>
                          <td className="px-4 py-3 text-gray-600 text-xs align-middle">{item.city}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs align-middle">{item.warehouse}</td>
                          <td className="px-4 py-3 text-gray-600 text-xs align-middle">{item.room}</td>
                          <td className="px-4 py-3 font-semibold text-blue-600 align-middle">
                            <div className="flex items-center gap-1.5">
                              <span>📦</span>
                              <span>{item.name || item.rackNumber}</span>
                            </div>
                          </td>
                        </>
                      )}
                      {activeTab === "all" && (
                        <>
                          <td className="px-4 py-3 align-middle">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                              item.level === "city"
                                ? "bg-blue-100 text-blue-700 border border-blue-200"
                                : item.level === "warehouse"
                                ? "bg-amber-100 text-amber-700 border border-amber-200"
                                : item.level === "room"
                                ? "bg-purple-100 text-purple-700 border border-purple-200"
                                : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                            }`}>
                              {item.level}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 text-xs font-medium align-middle">
                            {item.city || (item.level === "city" ? item.name : "-")}
                          </td>
                          <td className="px-4 py-3 text-gray-700 text-xs font-medium align-middle">
                            {item.warehouse || (item.level === "warehouse" ? item.name : "-")}
                          </td>
                          <td className="px-4 py-3 text-gray-700 text-xs font-medium align-middle">
                            {item.room || (item.level === "room" ? item.name : "-")}
                          </td>
                          <td className="px-4 py-3 text-gray-700 text-xs font-medium align-middle">
                            {item.rackNumber || (item.level === "rack" ? item.name : "-")}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100/90 text-gray-800 rounded-lg text-xs font-medium border border-gray-200">
                              <span className="text-gray-400">📍</span>
                              <span>
                                {[
                                  item.city || (item.level === "city" ? item.name : ""),
                                  item.warehouse || (item.level === "warehouse" ? item.name : ""),
                                  item.room || (item.level === "room" ? item.name : ""),
                                  item.rackNumber || (item.level === "rack" ? item.name : ""),
                                ].filter(Boolean).join(" ➔ ")}
                              </span>
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--primary-color)]/30 text-[var(--primary-color)] hover:bg-[var(--primary-color)]/10 transition-colors"
                            title="Edit"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      No {activeTab} locations found. Use the form on the left to add one!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--primary-color)]/10 text-[var(--primary-color)] flex items-center justify-center font-bold">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Bulk Import Storage Locations</h3>
                  <p className="text-xs text-gray-500">Upload an Excel (.xlsx, .xls) file to add multiple locations at once</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!isImporting) {
                    setShowImportModal(false);
                    setImportFile(null);
                    setParsedRows([]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }
                }}
                disabled={isImporting}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Instructions & Template download */}
              <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-blue-900 flex items-center gap-1.5">
                    <span>💡</span> Need the Excel format?
                  </h4>
                  <p className="text-xs text-blue-700">
                    Download our sample Excel template containing sample rows and column structure for cities, warehouses, rooms, and racks.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleTemplate}
                  className="px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <span>Download Sample Template</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="storage-bulk-upload-input"
                  disabled={isImporting}
                />
                <label
                  htmlFor="storage-bulk-upload-input"
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    importFile
                      ? "border-[var(--primary-color)] bg-[var(--primary-color)]/5"
                      : "border-gray-300 hover:border-[var(--primary-color)]/50 hover:bg-gray-50/50"
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 mb-2">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                  </div>
                  {importFile ? (
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{importFile.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {(importFile.size / 1024).toFixed(1)} KB • Click or drop another file to replace
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Click to select an Excel file or drag & drop</p>
                      <p className="text-xs text-gray-400 mt-1">Supports .xlsx, .xls, .csv</p>
                    </div>
                  )}
                </label>
              </div>

              {/* Import Progress Bar */}
              {isImporting && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                    <span>Importing locations...</span>
                    <span>
                      {importProgress.current} / {importProgress.total} (
                      {Math.round((importProgress.current / (importProgress.total || 1)) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-[var(--primary-color)] h-2.5 rounded-full transition-all duration-200"
                      style={{
                        width: `${Math.round((importProgress.current / (importProgress.total || 1)) * 100)}%`,
                      }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                    <span className="text-emerald-600 font-medium">Success: {importProgress.success}</span>
                    {importProgress.failed > 0 && (
                      <span className="text-red-500 font-medium">Failed: {importProgress.failed}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Rows Preview */}
              {parsedRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-gray-800">Preview Data</h4>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
                        Total {parsedRows.length} Rows
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-medium">
                        Valid: {parsedRows.filter((r) => r.isValid).length}
                      </span>
                      {parsedRows.some((r) => !r.isValid) && (
                        <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-md font-medium">
                          Invalid: {parsedRows.filter((r) => !r.isValid).length}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase sticky top-0">
                        <tr>
                          <th className="px-3 py-2 font-semibold">#</th>
                          <th className="px-3 py-2 font-semibold">Level</th>
                          <th className="px-3 py-2 font-semibold">City</th>
                          <th className="px-3 py-2 font-semibold">Warehouse</th>
                          <th className="px-3 py-2 font-semibold">Room</th>
                          <th className="px-3 py-2 font-semibold">Rack</th>
                          <th className="px-3 py-2 font-semibold">Code</th>
                          <th className="px-3 py-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parsedRows.map((row, idx) => (
                          <tr key={idx} className={row.isValid ? "hover:bg-gray-50" : "bg-red-50/40"}>
                            <td className="px-3 py-2 text-gray-500 font-mono">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                row.level === "city"
                                  ? "bg-blue-100 text-blue-700"
                                  : row.level === "warehouse"
                                  ? "bg-amber-100 text-amber-700"
                                  : row.level === "room"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}>
                                {row.level}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-medium text-gray-800">{row.city || "-"}</td>
                            <td className="px-3 py-2 text-gray-600">{row.warehouse || "-"}</td>
                            <td className="px-3 py-2 text-gray-600">{row.room || "-"}</td>
                            <td className="px-3 py-2 text-gray-600">{row.rackNumber || "-"}</td>
                            <td className="px-3 py-2 text-gray-500 font-mono">{row.code || "-"}</td>
                            <td className="px-3 py-2">
                              {row.isValid ? (
                                <span className="text-emerald-600 font-medium flex items-center gap-1">
                                  ✓ Ready
                                </span>
                              ) : (
                                <span className="text-red-500 font-medium" title={row.error}>
                                  ⚠ {row.error || "Invalid"}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <button
                type="button"
                onClick={() => {
                  setImportFile(null);
                  setParsedRows([]);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                disabled={isImporting || parsedRows.length === 0}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-40"
              >
                Clear File
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportFile(null);
                    setParsedRows([]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  disabled={isImporting}
                  className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={isImporting || parsedRows.filter((r) => r.isValid).length === 0}
                  className="px-6 py-2 bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white rounded-lg text-xs font-semibold shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <span>
                        Import {parsedRows.filter((r) => r.isValid).length} Locations
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
