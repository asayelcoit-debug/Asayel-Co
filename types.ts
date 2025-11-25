
export type Unit = string;

export interface InventoryItem {
  id: string;
  code: string; // Was category
  brand: string; // New field
  name: string;
  unit: Unit;
  minQuantity?: number; // Admin defined lower bound
  maxQuantity?: number; // Admin defined upper bound
}

export interface InventoryEntry {
  itemId: string;
  quantity: number | null;
  notes?: string;
  flagged?: boolean; // If AI flagged it as suspicious
}

export type InventoryStatus = 'active' | 'submitted' | 'approved';

export interface Site {
  id: string;
  name: string;
}

export interface InventorySession {
  id: string;
  siteId: string; // Link to Site
  siteName: string; // Denormalized for display convenience
  startDate: string;
  endDate: string;
  status: InventoryStatus;
  entries: Record<string, InventoryEntry>; // Keyed by itemId
  items: InventoryItem[]; // Items specific to this session
}

export type UserRole = 'admin' | 'supervisor' | null;
