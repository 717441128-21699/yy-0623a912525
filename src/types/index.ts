export interface CaseItem {
  id: string
  consultant?: string
  project_type: string
  body_part: string
  period?: string
  age_group?: string
  age?: number
  description?: string
  copy_points?: string
  status: 'pending' | 'approved' | 'rejected' | 'forbidden'
  created_at: string
  updated_at: string
  asset_count?: number
  last_review_status?: string
}

export interface AssetItem {
  id: string
  case_id: string
  original_path: string
  processed_path?: string
  thumbnail_path?: string
  asset_type: string
  phase?: string
  sort_order: number
  mosaic_applied: number
  watermark_applied: number
  disclaimer_applied: number
  created_at: string
}

export interface AuthorizationItem {
  id: string
  case_id: string
  customer_name?: string
  signed_date?: string
  expire_date?: string
  auth_scope?: string
  has_identity: number
  has_signature: number
  has_full_content: number
  notes?: string
  created_at: string
  project_type?: string
  body_part?: string
}

export interface ReviewItem {
  id: string
  case_id: string
  reviewer: string
  role?: string
  status: string
  reason?: string
  created_at: string
}

export interface Stats {
  total: number
  pending: number
  approved: number
  rejected: number
  forbidden: number
  assets: number
  expiring: number
}

export interface MosaicArea {
  x: number
  y: number
  width: number
  height: number
}
