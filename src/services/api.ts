import { CaseItem, AssetItem, AuthorizationItem, ReviewItem, Stats, MosaicArea } from '../types'

declare global {
  interface Window {
    api: any
  }
}

const api = window.api || {}

export const dialog = {
  selectFiles: (): Promise<string[]> => api.selectFiles?.() || Promise.resolve([]),
  selectDirectory: (): Promise<string> => api.selectDirectory?.() || Promise.resolve('')
}

export const caseApi = {
  create: (data: Partial<CaseItem>): Promise<string> => api.createCase?.(data),
  update: (id: string, data: Partial<CaseItem>): Promise<boolean> => api.updateCase?.(id, data),
  get: (id: string): Promise<CaseItem> => api.getCase?.(id),
  list: (filters?: any): Promise<CaseItem[]> => api.listCases?.(filters) || Promise.resolve([]),
  delete: (id: string): Promise<boolean> => api.deleteCase?.(id),
  updateStatus: (caseId: string, status: string, reviewer: string, reason: string): Promise<boolean> =>
    api.updateCaseStatus?.(caseId, status, reviewer, reason)
}

export const assetApi = {
  create: (data: Partial<AssetItem>): Promise<string> => api.createAsset?.(data),
  update: (id: string, data: Partial<AssetItem>): Promise<boolean> => api.updateAsset?.(id, data),
  get: (id: string): Promise<AssetItem> => api.getAsset?.(id),
  list: (caseId?: string): Promise<AssetItem[]> => api.listAssets?.(caseId) || Promise.resolve([]),
  delete: (id: string): Promise<boolean> => api.deleteAsset?.(id)
}

export const imageApi = {
  copyToStorage: (srcPath: string, caseId: string): Promise<{ original_path: string; thumbnail_path: string }> =>
    api.copyImageToStorage?.(srcPath, caseId),
  applyMosaic: (assetId: string, areas: MosaicArea[]): Promise<string> => api.applyMosaic?.(assetId, areas),
  applyWatermark: (assetId: string, text: string): Promise<string> => api.applyWatermark?.(assetId, text),
  addDisclaimer: (assetId: string, text: string): Promise<string> => api.addDisclaimer?.(assetId, text)
}

export const authApi = {
  create: (data: Partial<AuthorizationItem>): Promise<string> => api.createAuthorization?.(data),
  update: (id: string, data: Partial<AuthorizationItem>): Promise<boolean> =>
    api.updateAuthorization?.(id, data),
  get: (caseId: string): Promise<AuthorizationItem> => api.getAuthorization?.(caseId),
  listExpiring: (days: number): Promise<AuthorizationItem[]> =>
    api.listExpiringAuthorizations?.(days) || Promise.resolve([])
}

export const reviewApi = {
  create: (data: Partial<ReviewItem>): Promise<string> => api.createReview?.(data),
  list: (caseId: string): Promise<ReviewItem[]> => api.listReviews?.(caseId) || Promise.resolve([])
}

export const exportApi = {
  package: (caseIds: string[], channel: string, outputDir: string): Promise<string> =>
    api.exportPackage?.(caseIds, channel, outputDir)
}

export const statsApi = {
  get: (): Promise<Stats> => api.getStats?.() || Promise.resolve({ total: 0, pending: 0, approved: 0, rejected: 0, forbidden: 0, assets: 0, expiring: 0 })
}

export const fileUrl = (path: string) => {
  if (!path) return ''
  return 'file:///' + path.replace(/\\/g, '/').replace(/^\//, '')
}
