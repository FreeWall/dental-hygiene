import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Renderer, osvětlení (operační světlo) a prostředí. */
export class Stage {
  constructor(canvas) {
    const lowEnd = (navigator.hardwareConcurrency ?? 8) <= 4;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowEnd ? 1.5 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;

    this.camera = new THREE.PerspectiveCamera(38, 1, 1, 2000);
    this.scene.add(this.camera);

    this.hemi = new THREE.HemisphereLight(0xfff6ee, 0x5a2a2a, 0.45);
    this.scene.add(this.hemi);

    // operační světlo – sleduje kameru, svítí shora do úst
    this.lamp = new THREE.SpotLight(0xfff4e6, 5.5, 0, Math.PI / 4.2, 0.7, 0);
    this.lamp.castShadow = true;
    this.lamp.shadow.mapSize.set(lowEnd ? 1024 : 2048, lowEnd ? 1024 : 2048);
    this.lamp.shadow.bias = -0.0004;
    this.lamp.shadow.normalBias = 0.3;
    this.lamp.shadow.camera.near = 20;
    this.lamp.shadow.camera.far = 600;
    this.scene.add(this.lamp, this.lamp.target);

    this.fill = new THREE.DirectionalLight(0xffe8e0, 0.5);
    this.scene.add(this.fill, this.fill.target);

    // tmavé pozadí – ústní dutina / ordinace v šeru
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(600, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {},
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec3 vDir;
          void main(){
            float back = 1.0 - smoothstep(-0.9, 0.2, vDir.z);
            vec3 warm = vec3(0.075, 0.03, 0.035);
            vec3 deep = vec3(0.018, 0.008, 0.01);
            vec3 c = mix(warm, deep, back);
            c *= 0.75 + 0.25 * smoothstep(-1.0, 0.6, vDir.y);
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    );
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    this.scene.add(dome);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.width = w;
    this.height = h;
  }

  updateLights(target) {
    const cam = this.camera;
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const dist = cam.position.distanceTo(target);
    this.lamp.position.copy(cam.position).addScaledVector(up, dist * 0.45).addScaledVector(right, dist * 0.03);
    this.lamp.position.addScaledVector(new THREE.Vector3().subVectors(cam.position, target).normalize(), 60);
    this.lamp.target.position.copy(target);
    this.fill.position.copy(cam.position).addScaledVector(up, -dist * 0.4).addScaledVector(right, -dist * 0.5);
    this.fill.target.position.copy(target);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
