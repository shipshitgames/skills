import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import manifest from '../assets/assets.json'

/**
 * The manifest is the single source of truth. This loader is the ONLY place that
 * touches the filesystem/network for content. Systems ask the catalog for an id
 * and get back a ready-to-use texture/model + its metadata (scale, frames, anchor).
 *
 * This will move into @shipshitgames/engine; scourge-survivors proves the shape. Today the game
 * uses per-file Vite imports (src/game/spriteAssets.ts) — the manifest replaces that.
 */

// --- manifest types (mirror reference/assets.json) -----------------------------
export type AssetType = 'sprite' | 'sprite-anim' | 'texture' | 'model' | 'audio'

export interface LicenseRecord {
  tool: string
  plan: string
  date: string // ISO; when the asset was generated under that plan tier
  kind: string
  scope?: string
  rig?: string
}

export interface AssetEntry {
  id: string
  type: AssetType
  path: string
  dimensions?: [number, number]
  anchor?: [number, number]
  scale?: [number, number]
  flashScale?: number
  views?: Record<string, { path: string; scale: [number, number] }>
  frames?: number
  frameSize?: [number, number]
  fps?: number
  loop?: boolean
  colorSpace?: 'srgb' | 'linear'
  wrap?: 'repeat' | 'clamp'
  repeat?: [number, number]
  optimized?: boolean
  compression?: { geometry?: string; textures?: string }
  animations?: string[]
  category?: 'sfx' | 'music' | 'voice'
  volume?: number
  license: LicenseRecord
}

interface Manifest { version: number; assets: AssetEntry[] }

// Resolve manifest-relative paths through Vite so hashing/bundling works.
const fileUrls = import.meta.glob('../assets/**/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const urlFor = (path: string) => {
  const key = `../assets/${path}`
  const url = fileUrls[key]
  if (!url) throw new Error(`[assets] '${path}' is in the manifest but the file is missing on disk`)
  return url
}

export class AssetCatalog {
  private byId = new Map<string, AssetEntry>()
  private textures = new Map<string, THREE.Texture>()
  private gltf: GLTFLoader

  constructor() {
    const m = manifest as Manifest
    for (const a of m.assets) {
      if (this.byId.has(a.id)) throw new Error(`[assets] duplicate id '${a.id}'`)
      this.byId.set(a.id, a)
    }
    const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/v1/decoders/')
    const ktx2 = new KTX2Loader().setTranscoderPath('https://unpkg.com/three/examples/jsm/libs/basis/')
    this.gltf = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2)
  }

  entry(id: string): AssetEntry {
    const e = this.byId.get(id)
    if (!e) throw new Error(`[assets] unknown id '${id}' — register it in assets.json`)
    return e
  }

  /** Load a still texture or a single named view of a multi-view sprite. */
  texture(id: string, view?: string): THREE.Texture {
    const e = this.entry(id)
    const path = view ? this.requireView(e, view).path : e.path
    const cacheKey = `${id}:${view ?? ''}`
    let tex = this.textures.get(cacheKey)
    if (!tex) {
      tex = new THREE.TextureLoader().load(urlFor(path))
      tex.colorSpace = e.colorSpace === 'linear' ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace
      tex.minFilter = THREE.LinearFilter
      tex.magFilter = THREE.LinearFilter
      if (e.wrap === 'repeat') {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping
        if (e.repeat) tex.repeat.set(e.repeat[0], e.repeat[1])
      }
      this.textures.set(cacheKey, tex)
    }
    return tex
  }

  /** The number the game multiplies into Sprite.scale — comes from the manifest, never inline. */
  spriteScale(id: string, view?: string): [number, number] {
    const e = this.entry(id)
    if (view) return this.requireView(e, view).scale
    return e.scale ?? [1, 1]
  }

  async model(id: string): Promise<THREE.Group> {
    const e = this.entry(id)
    if (e.type !== 'model') throw new Error(`[assets] '${id}' is not a model`)
    if (!e.optimized) console.warn(`[assets] model '${id}' is not marked optimized — run gltf-transform before shipping`)
    const gltf = await this.gltf.loadAsync(urlFor(e.path))
    return gltf.scene
  }

  private requireView(e: AssetEntry, view: string) {
    const v = e.views?.[view]
    if (!v) throw new Error(`[assets] '${e.id}' has no view '${view}'`)
    return v
  }
}
