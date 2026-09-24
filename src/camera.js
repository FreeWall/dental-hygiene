import * as THREE from 'three';

/** Kamera obíhající kolem cíle. yaw kolem osy Y (0 = zepředu), pitch nahoru/dolů. */
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.target = new THREE.Vector3(0, -8, 10);
    this.targetGoal = this.target.clone();
    this.yaw = 0;
    this.pitch = 0;
    this.dist = 100;
    this.goal = { yaw: 0, pitch: 0, dist: 100 };
    this.minDist = 18;
    this.maxDist = 220;
    this.shake = 0;
    this.aspectFactor = 1;
  }

  set(view, instant = false) {
    this.targetGoal.copy(view.target);
    this.goal.yaw = view.yaw;
    this.goal.pitch = view.pitch;
    this.goal.dist = view.dist;
    // nejkratší cesta pro yaw
    while (this.goal.yaw - this.yaw > Math.PI) this.goal.yaw -= Math.PI * 2;
    while (this.goal.yaw - this.yaw < -Math.PI) this.goal.yaw += Math.PI * 2;
    if (instant) {
      this.target.copy(this.targetGoal);
      this.yaw = this.goal.yaw;
      this.pitch = this.goal.pitch;
      this.dist = this.goal.dist;
    }
  }

  rotate(dx, dy) {
    this.goal.yaw -= dx * 0.006;
    this.goal.pitch = THREE.MathUtils.clamp(this.goal.pitch + dy * 0.006, -1.45, 1.45);
  }

  zoom(f) {
    this.goal.dist = THREE.MathUtils.clamp(this.goal.dist * f, this.minDist, this.maxDist);
  }

  pan(dx, dy, viewportH) {
    const cam = this.camera;
    const scale = (2 * this.dist * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / viewportH;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    this.targetGoal.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
  }

  focus(point, dist) {
    this.targetGoal.copy(point);
    if (dist) this.goal.dist = dist;
  }

  update(dt) {
    const k = 1 - Math.exp(-dt * 7);
    this.target.lerp(this.targetGoal, k);
    this.yaw += (this.goal.yaw - this.yaw) * k;
    this.pitch += (this.goal.pitch - this.pitch) * k;
    this.dist += (this.goal.dist - this.dist) * k;
    const d = this.dist * this.aspectFactor;
    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      this.target.x + d * Math.sin(this.yaw) * cp,
      this.target.y + d * Math.sin(this.pitch),
      this.target.z + d * Math.cos(this.yaw) * cp,
    );
    this.camera.lookAt(this.target);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 3);
      const s = this.shake * 1.2;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.updateMatrixWorld();
  }
}
