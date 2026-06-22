import { ipcMain, dialog, app } from 'electron'
import fs from 'fs'
import { join, basename, extname } from 'path'
import { v4 as uuidv4 } from 'uuid'
import Jimp from 'jimp'
import archiver from 'archiver'
import dayjs from 'dayjs'

declare global {
  var db: any
  var storageDir: string
  var saveDb: () => void
}

function getDb() { return global.db }
function getStorageDir() { return global.storageDir }
function persist() { global.saveDb?.() }

function rowToObj(columns: string[], values: any[]): any {
  const obj: any = {}
  columns.forEach((col, i) => { obj[col] = values[i] })
  return obj
}

function queryOne(sql: string, params: any[] = []): any {
  const db = getDb()
  const stmt = db.prepare(sql)
  stmt.bind(params)
  if (stmt.step()) {
    const result = stmt.getAsObject()
    stmt.free()
    return result
  }
  stmt.free()
  return null
}

function queryAll(sql: string, params: any[] = []): any[] {
  const db = getDb()
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const results: any[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  return results
}

function run(sql: string, params: any[] = []) {
  const db = getDb()
  db.run(sql, params)
  persist()
}

export function registerIpcHandlers() {
  ipcMain.handle('dialog:selectFiles', async () => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp'] }]
    })
    return res.filePaths
  })

  ipcMain.handle('dialog:selectDirectory', async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return res.filePaths[0]
  })

  ipcMain.handle('path:get', (_e, name: string) => app.getPath(name as any))

  ipcMain.handle('case:create', (_e, data) => {
    const id = uuidv4()
    run(
      `INSERT INTO cases (id, consultant, project_type, body_part, period, age_group, age, description, copy_points, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.consultant || null, data.project_type, data.body_part, data.period || null, data.age_group || null,
        data.age || null, data.description || null, data.copy_points || null, data.status || 'pending']
    )
    return id
  })

  ipcMain.handle('case:update', (_e, id, data) => {
    const entries = Object.entries(data).filter(([k]) => k !== 'id')
    if (entries.length === 0) return true
    const fields = entries.map(([k]) => `${k} = ?`).join(', ')
    const values = entries.map(([, v]) => v ?? null)
    run(`UPDATE cases SET ${fields}, updated_at = datetime('now','localtime') WHERE id = ?`, [...values, id])
    return true
  })

  ipcMain.handle('case:get', (_e, id) => queryOne('SELECT * FROM cases WHERE id = ?', [id]))

  ipcMain.handle('case:list', (_e, filters) => {
    let sql = `SELECT c.*,
      (SELECT COUNT(*) FROM assets a WHERE a.case_id = c.id) as asset_count,
      (SELECT status FROM reviews r WHERE r.case_id = c.id ORDER BY created_at DESC LIMIT 1) as last_review_status
      FROM cases c WHERE 1=1`
    const params: any[] = []
    if (filters?.status) { sql += ' AND c.status = ?'; params.push(filters.status) }
    if (filters?.project_type) { sql += ' AND c.project_type = ?'; params.push(filters.project_type) }
    if (filters?.body_part) { sql += ' AND c.body_part = ?'; params.push(filters.body_part) }
    if (filters?.age_group) { sql += ' AND c.age_group = ?'; params.push(filters.age_group) }
    if (filters?.keyword) {
      sql += ' AND (c.description LIKE ? OR c.copy_points LIKE ?)'
      params.push(`%${filters.keyword}%`, `%${filters.keyword}%`)
    }
    sql += ' ORDER BY c.created_at DESC'
    return queryAll(sql, params)
  })

  ipcMain.handle('case:delete', (_e, id) => {
    run('DELETE FROM assets WHERE case_id = ?', [id])
    run('DELETE FROM authorizations WHERE case_id = ?', [id])
    run('DELETE FROM reviews WHERE case_id = ?', [id])
    run('DELETE FROM cases WHERE id = ?', [id])
    return true
  })

  ipcMain.handle('case:updateStatus', (_e, caseId, status, reviewer, reason) => {
    const id = uuidv4()
    run(`INSERT INTO reviews (id, case_id, reviewer, role, status, reason) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, caseId, reviewer, '院长/负责人', status, reason || ''])
    run(`UPDATE cases SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?`, [status, caseId])
    return true
  })

  ipcMain.handle('asset:create', (_e, data) => {
    const id = uuidv4()
    run(
      `INSERT INTO assets (id, case_id, original_path, processed_path, thumbnail_path, asset_type, phase, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.case_id, data.original_path, data.processed_path || null, data.thumbnail_path || null,
        data.asset_type || 'photo', data.phase || null, data.sort_order ?? 0]
    )
    return id
  })

  ipcMain.handle('asset:update', (_e, id, data) => {
    const entries = Object.entries(data).filter(([k]) => k !== 'id')
    if (entries.length === 0) return true
    const fields = entries.map(([k]) => `${k} = ?`).join(', ')
    const values = entries.map(([, v]) => v ?? null)
    run(`UPDATE assets SET ${fields} WHERE id = ?`, [...values, id])
    return true
  })

  ipcMain.handle('asset:get', (_e, id) => queryOne('SELECT * FROM assets WHERE id = ?', [id]))

  ipcMain.handle('asset:list', (_e, caseId) => {
    if (caseId) return queryAll('SELECT * FROM assets WHERE case_id = ? ORDER BY sort_order, created_at', [caseId])
    return queryAll('SELECT * FROM assets ORDER BY created_at DESC')
  })

  ipcMain.handle('asset:delete', (_e, id) => { run('DELETE FROM assets WHERE id = ?', [id]); return true })

  ipcMain.handle('image:copy', async (_e, srcPath: string, caseId: string) => {
    const storageDir = getStorageDir()
    const caseDir = join(storageDir, 'originals', caseId)
    if (!fs.existsSync(caseDir)) fs.mkdirSync(caseDir, { recursive: true })
    const ext = extname(srcPath).toLowerCase() || '.jpg'
    const fileName = `${uuidv4()}${ext}`
    const destPath = join(caseDir, fileName)
    fs.copyFileSync(srcPath, destPath)

    const thumbDir = join(caseDir, 'thumbs')
    if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true })
    const thumbPath = join(thumbDir, fileName)

    try {
      const img = await Jimp.read(destPath)
      img.cover(300, 300).quality(70).write(thumbPath)
    } catch (e) {
      fs.copyFileSync(destPath, thumbPath)
    }
    return { original_path: destPath, thumbnail_path: thumbPath }
  })

  ipcMain.handle('image:mosaic', async (_e, assetId: string, areas: any[]) => {
    const asset = queryOne('SELECT * FROM assets WHERE id = ?', [assetId])
    if (!asset) return false
    const storageDir = getStorageDir()
    const processedDir = join(storageDir, 'processed', asset.case_id)
    if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true })

    const src = asset.processed_path || asset.original_path
    const fileName = basename(src)
    const destPath = join(processedDir, `mosaic_${uuidv4()}_${fileName}`)

    try {
      const img = await Jimp.read(src)
      const w = img.getWidth()
      const h = img.getHeight()
      for (const area of areas) {
        const rx = Math.round((area.x / 100) * w)
        const ry = Math.round((area.y / 100) * h)
        const rw = Math.round((area.width / 100) * w)
        const rh = Math.round((area.height / 100) * h)
        const cell = Math.max(20, Math.round(Math.min(rw, rh) / 8))
        for (let yy = ry; yy < ry + rh && yy < h; yy += cell) {
          for (let xx = rx; xx < rx + rw && xx < w; xx += cell) {
            const cw = Math.min(cell, rx + rw - xx, w - xx)
            const ch = Math.min(cell, ry + rh - yy, h - yy)
            let r = 0, g = 0, b = 0, cnt = 0
            for (let y2 = yy; y2 < yy + ch; y2++) {
              for (let x2 = xx; x2 < xx + cw; x2++) {
                const color = Jimp.intToRGBA(img.getPixelColor(x2, y2))
                r += color.r; g += color.g; b += color.b; cnt++
              }
            }
            const avgColor = Jimp.rgbaToInt(Math.round(r / cnt), Math.round(g / cnt), Math.round(b / cnt), 255)
            for (let y2 = yy; y2 < yy + ch; y2++) {
              for (let x2 = xx; x2 < xx + cw; x2++) {
                img.setPixelColor(avgColor, x2, y2)
              }
            }
          }
        }
      }
      await img.writeAsync(destPath)
      run('UPDATE assets SET processed_path = ?, mosaic_applied = 1 WHERE id = ?', [destPath, assetId])
      return destPath
    } catch (e: any) {
      console.error('mosaic error', e)
      return null
    }
  })

  ipcMain.handle('image:watermark', async (_e, assetId: string, text: string) => {
    const asset = queryOne('SELECT * FROM assets WHERE id = ?', [assetId])
    if (!asset) return false
    const storageDir = getStorageDir()
    const processedDir = join(storageDir, 'processed', asset.case_id)
    if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true })

    const src = asset.processed_path || asset.original_path
    const fileName = basename(src)
    const destPath = join(processedDir, `wm_${uuidv4()}_${fileName}`)

    try {
      const img = await Jimp.read(src)
      const w = img.getWidth()
      const fontSize = Math.max(20, Math.round(w / 30))
      const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK)
      const textW = Jimp.measureText(font, text)
      const textH = Jimp.measureTextHeight(font, text, w)
      const x = w - textW - 20
      const y = img.getHeight() - textH - 20
      img.color([{ apply: 'darken' as any, params: [20] }])
      img.print(font, x, y, text)
      await img.writeAsync(destPath)
      run('UPDATE assets SET processed_path = ?, watermark_applied = 1 WHERE id = ?', [destPath, assetId])
      return destPath
    } catch (e) {
      console.error('watermark error', e)
      return null
    }
  })

  ipcMain.handle('image:disclaimer', async (_e, assetId: string, text: string) => {
    const asset = queryOne('SELECT * FROM assets WHERE id = ?', [assetId])
    if (!asset) return false
    const storageDir = getStorageDir()
    const processedDir = join(storageDir, 'processed', asset.case_id)
    if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true })

    const src = asset.processed_path || asset.original_path
    const fileName = basename(src)
    const destPath = join(processedDir, `disc_${uuidv4()}_${fileName}`)

    try {
      const img = await Jimp.read(src)
      const w = img.getWidth()
      const h = img.getHeight()
      const fontSize = Math.max(20, Math.round(w / 40))
      const barH = Math.max(48, fontSize * 3)
      const barY = h - barH
      for (let y = barY; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const color = Jimp.intToRGBA(img.getPixelColor(x, y))
          const newColor = Jimp.rgbaToInt(
            Math.round(color.r * 0.3),
            Math.round(color.g * 0.3),
            Math.round(color.b * 0.3 + 20),
            255
          )
          img.setPixelColor(newColor, x, y)
        }
      }
      const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE)
      const textW = Jimp.measureText(font, text)
      const textH = Jimp.measureTextHeight(font, text, w)
      img.print(font, Math.round((w - textW) / 2), barY + Math.round((barH - textH) / 2), text)
      await img.writeAsync(destPath)
      run('UPDATE assets SET processed_path = ?, disclaimer_applied = 1 WHERE id = ?', [destPath, assetId])
      return destPath
    } catch (e) {
      console.error('disclaimer error', e)
      return null
    }
  })

  ipcMain.handle('auth:create', (_e, data) => {
    const id = uuidv4()
    run(
      `INSERT INTO authorizations (id, case_id, customer_name, signed_date, expire_date, auth_scope, has_identity, has_signature, has_full_content, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.case_id, data.customer_name || null, data.signed_date || null, data.expire_date || null,
        data.auth_scope || null, data.has_identity ?? 0, data.has_signature ?? 0, data.has_full_content ?? 0, data.notes || null]
    )
    return id
  })

  ipcMain.handle('auth:update', (_e, id, data) => {
    const entries = Object.entries(data).filter(([k]) => k !== 'id')
    if (entries.length === 0) return true
    const fields = entries.map(([k]) => `${k} = ?`).join(', ')
    const values = entries.map(([, v]) => v ?? null)
    run(`UPDATE authorizations SET ${fields} WHERE id = ?`, [...values, id])
    return true
  })

  ipcMain.handle('auth:get', (_e, caseId) => queryOne('SELECT * FROM authorizations WHERE case_id = ?', [caseId]))

  ipcMain.handle('auth:expiring', (_e, days: number) => {
    const date = dayjs().add(days, 'day').format('YYYY-MM-DD')
    return queryAll(
      `SELECT a.*, c.project_type, c.body_part FROM authorizations a
       LEFT JOIN cases c ON c.id = a.case_id
       WHERE a.expire_date IS NOT NULL AND a.expire_date <= ? ORDER BY a.expire_date ASC`,
      [date]
    )
  })

  ipcMain.handle('review:create', (_e, data) => {
    const id = uuidv4()
    run(
      `INSERT INTO reviews (id, case_id, reviewer, role, status, reason) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.case_id, data.reviewer, data.role || null, data.status, data.reason || null]
    )
    return id
  })

  ipcMain.handle('review:list', (_e, caseId) =>
    queryAll('SELECT * FROM reviews WHERE case_id = ? ORDER BY created_at DESC', [caseId])
  )

  ipcMain.handle('export:package', async (_e, caseIds: string[], channel: string, outputDir: string) => {
    const timestamp = dayjs().format('YYYYMMDD_HHmmss')
    const zipPath = join(outputDir, `${channel}_package_${timestamp}.zip`)
    const output = fs.createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.pipe(output)

    for (const caseId of caseIds) {
      const c = queryOne('SELECT * FROM cases WHERE id = ?', [caseId])
      if (!c) continue
      const assets = queryAll('SELECT * FROM assets WHERE case_id = ?', [caseId])
      const folderName = `${c.project_type?.replace(/[\\/:*?"<>|]/g, '')}_${c.body_part?.replace(/[\\/:*?"<>|]/g, '')}_${caseId.slice(0, 6)}`

      for (const a of assets) {
        const path = a.processed_path || a.original_path
        if (path && fs.existsSync(path)) {
          archive.file(path, { name: `${folderName}/${basename(path)}` })
        }
      }
      const meta = {
        case_id: c.id,
        project_type: c.project_type,
        body_part: c.body_part,
        period: c.period,
        age_group: c.age_group,
        description: c.description,
        copy_points: c.copy_points,
        channel,
        exported_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
      }
      archive.append(JSON.stringify(meta, null, 2), { name: `${folderName}/meta.json` })
    }

    await archive.finalize()
    return zipPath
  })

  ipcMain.handle('stats:get', () => {
    const count = (sql: string, params: any[] = []) => {
      const row = queryOne(sql, params)
      return row ? (Object.values(row)[0] as number) : 0
    }
    return {
      total: count('SELECT COUNT(*) as c FROM cases'),
      pending: count(`SELECT COUNT(*) as c FROM cases WHERE status = 'pending'`),
      approved: count(`SELECT COUNT(*) as c FROM cases WHERE status = 'approved'`),
      rejected: count(`SELECT COUNT(*) as c FROM cases WHERE status = 'rejected'`),
      forbidden: count(`SELECT COUNT(*) as c FROM cases WHERE status = 'forbidden'`),
      assets: count('SELECT COUNT(*) as c FROM assets'),
      expiring: count(
        `SELECT COUNT(*) as c FROM authorizations WHERE expire_date IS NOT NULL AND expire_date <= date('now','+30 day')`
      )
    }
  })
}
