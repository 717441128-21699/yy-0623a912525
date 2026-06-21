import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  selectFiles: () => ipcRenderer.invoke('dialog:selectFiles'),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  getPath: (name: string) => ipcRenderer.invoke('path:get', name),

  createCase: (data: any) => ipcRenderer.invoke('case:create', data),
  updateCase: (id: string, data: any) => ipcRenderer.invoke('case:update', id, data),
  getCase: (id: string) => ipcRenderer.invoke('case:get', id),
  listCases: (filters?: any) => ipcRenderer.invoke('case:list', filters),
  deleteCase: (id: string) => ipcRenderer.invoke('case:delete', id),

  createAsset: (data: any) => ipcRenderer.invoke('asset:create', data),
  updateAsset: (id: string, data: any) => ipcRenderer.invoke('asset:update', id, data),
  getAsset: (id: string) => ipcRenderer.invoke('asset:get', id),
  listAssets: (caseId?: string) => ipcRenderer.invoke('asset:list', caseId),
  deleteAsset: (id: string) => ipcRenderer.invoke('asset:delete', id),

  copyImageToStorage: (srcPath: string, caseId: string) =>
    ipcRenderer.invoke('image:copy', srcPath, caseId),
  applyMosaic: (assetId: string, areas: any[]) =>
    ipcRenderer.invoke('image:mosaic', assetId, areas),
  applyWatermark: (assetId: string, text: string) =>
    ipcRenderer.invoke('image:watermark', assetId, text),
  addDisclaimer: (assetId: string, text: string) =>
    ipcRenderer.invoke('image:disclaimer', assetId, text),

  createAuthorization: (data: any) => ipcRenderer.invoke('auth:create', data),
  updateAuthorization: (id: string, data: any) => ipcRenderer.invoke('auth:update', id, data),
  getAuthorization: (caseId: string) => ipcRenderer.invoke('auth:get', caseId),
  listExpiringAuthorizations: (days: number) => ipcRenderer.invoke('auth:expiring', days),

  createReview: (data: any) => ipcRenderer.invoke('review:create', data),
  listReviews: (caseId: string) => ipcRenderer.invoke('review:list', caseId),
  updateCaseStatus: (caseId: string, status: string, reviewer: string, reason: string) =>
    ipcRenderer.invoke('case:updateStatus', caseId, status, reviewer, reason),

  exportPackage: (caseIds: string[], channel: string, outputDir: string) =>
    ipcRenderer.invoke('export:package', caseIds, channel, outputDir),

  getStats: () => ipcRenderer.invoke('stats:get')
})
