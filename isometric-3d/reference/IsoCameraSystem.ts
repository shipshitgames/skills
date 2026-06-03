import * as THREE from 'three'

// Standalone reference for the orthographic iso camera rig. In a real game these
// constants live in constants.ts and ctx/sys are the GameContext + GameSystems.
const ISO_PITCH = Math.atan(1 / Math.SQRT2) // ~35.264 deg — true iso angle
const ISO_YAW = Math.PI / 4 // 45 deg — facing a board corner
const CAM_DIST = 30 // boom length in world units
const ZOOM_MIN = 8
const ZOOM_MAX = 40
const PAN_SPEED = 1.0

interface CameraCtx {
  container: HTMLElement
  camera: THREE.OrthographicCamera
  zoom: number // frustum half-height; ortho zoom changes this, never position
}

/**
 * Pan / zoom / rotate rig for an OrthographicCamera framing a tile board.
 * The camera orbits a ground `target` at a fixed iso pitch; yaw snap-rotates 90.
 */
export class IsoCameraSystem {
  private readonly target = new THREE.Vector3()
  private yaw = ISO_YAW
  private readonly offset = new THREE.Vector3()

  constructor(private ctx: CameraCtx) {
    this.apply()
    this.resize()
  }

  /** Recompute camera position from target + yaw + fixed iso pitch. */
  private apply() {
    const r = Math.cos(ISO_PITCH) * CAM_DIST
    this.offset.set(
      Math.sin(this.yaw) * r,
      Math.sin(ISO_PITCH) * CAM_DIST,
      Math.cos(this.yaw) * r,
    )
    this.ctx.camera.position.copy(this.target).add(this.offset)
    this.ctx.camera.lookAt(this.target)
  }

  /** Pan in screen-aligned ground axes (input rotated by current yaw). */
  panBy(dx: number, dz: number) {
    const s = Math.sin(this.yaw)
    const c = Math.cos(this.yaw)
    this.target.x += (dx * c - dz * s) * PAN_SPEED
    this.target.z += (dx * s + dz * c) * PAN_SPEED
    this.apply()
  }

  /** Wheel delta -> change frustum size (true ortho zoom, not a dolly). */
  zoomBy(delta: number) {
    this.ctx.zoom = THREE.MathUtils.clamp(this.ctx.zoom + delta, ZOOM_MIN, ZOOM_MAX)
    this.resize()
  }

  /** Snap-rotate 90 deg, keeping the iso look (classic tactics camera). */
  rotate(dir: 1 | -1) {
    this.yaw += (dir * Math.PI) / 2
    this.apply()
  }

  /** Rebuild the frustum from live aspect + zoom. Call on resize AND after zoom. */
  resize() {
    const cam = this.ctx.camera
    const aspect = this.ctx.container.clientWidth / this.ctx.container.clientHeight
    const h = this.ctx.zoom
    cam.left = -h * aspect
    cam.right = h * aspect
    cam.top = h
    cam.bottom = -h
    cam.updateProjectionMatrix()
  }
}
