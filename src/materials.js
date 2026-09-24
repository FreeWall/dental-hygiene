import * as THREE from 'three';

const GLSL_COMMON = /* glsl */ `
float dh_hash(vec3 p){ p = fract(p*0.3183099 + vec3(0.71,0.113,0.419)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(dh_hash(i), dh_hash(i+vec3(1,0,0)), f.x), mix(dh_hash(i+vec3(0,1,0)), dh_hash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(dh_hash(i+vec3(0,0,1)), dh_hash(i+vec3(1,0,1)), f.x), mix(dh_hash(i+vec3(0,1,1)), dh_hash(i+vec3(1,1,1)), f.x), f.y), f.z);
}
vec3 dh_s2l(vec3 c){ return pow(max(c, vec3(0.0)), vec3(2.2)); }
// bump mapping z výšky zadané v mm (Mikkelsen)
vec3 dh_perturb(vec3 surf_pos, vec3 surf_norm, float hgt, float faceDir){
  vec3 vSigmaX = dFdx(surf_pos); vec3 vSigmaY = dFdy(surf_pos);
  vec2 dHdxy = vec2(dFdx(hgt), dFdy(hgt));
  vec3 R1 = cross(vSigmaY, surf_norm); vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDir;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`;

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

function patch(mat, { uniforms, vertHead, vertBody, fragHead, fragColor, fragRough, fragNormal, fragEmissive }) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${vertHead}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${vertBody}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}\n${fragHead}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${fragColor}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${fragRough}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${fragNormal}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${fragEmissive}`);
  };
  const key = 'dh-' + hashStr(vertHead + vertBody + fragHead + fragColor + fragRough + fragNormal + fragEmissive);
  mat.customProgramCacheKey = () => key;
  mat.userData.uniforms = uniforms;
  return mat;
}

export function createToothMaterial() {
  const uniforms = {
    uDisclose: { value: 0 },
    uReveal: { value: 0 },
    uWet: { value: 0 },
    uStain: { value: new THREE.Vector3(0.42, 0.28, 0.14) },
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0, envMapIntensity: 0.9 });
  return patch(mat, {
    uniforms,
    vertHead: `attribute vec4 aDirt; attribute vec4 aCare; attribute float aH;
      varying vec4 vDirt; varying vec4 vCare; varying float vH; varying vec3 vLocal;`,
    vertBody: `vDirt = aDirt; vCare = aCare; vH = aH; vLocal = position;
      transformed += objectNormal * (aDirt.z * 0.55 + aDirt.w * 0.3 + aDirt.x * 0.07);`,
    fragHead: `uniform float uDisclose; uniform float uReveal; uniform float uWet; uniform vec3 uStain;
      varying vec4 vDirt; varying vec4 vCare; varying float vH; varying vec3 vLocal;`,
    fragColor: `
      float n1 = vnoise(vLocal*1.3);
      float n2 = vnoise(vLocal*3.1 + 7.0);
      float n3 = vnoise(vLocal*8.0 + 3.0);
      vec3 enamel = mix(vec3(0.88,0.78,0.6), vec3(0.95,0.92,0.84), smoothstep(-0.05, 0.6, vH));
      enamel = mix(enamel, vec3(0.80,0.84,0.88), smoothstep(0.82, 1.08, vH) * 0.4);
      enamel = mix(vec3(0.82,0.72,0.55), enamel, smoothstep(-0.14, 0.02, vH));
      enamel *= 0.95 + 0.08 * n1;
      vec3 col = enamel;
      float plaque = vDirt.x; float stain = vDirt.y; float cs = vDirt.z; float cb = vDirt.w;
      float caries = vCare.w;
      vec3 cariesCol = mix(vec3(0.96,0.95,0.9), vec3(0.24,0.15,0.08), smoothstep(0.35, 0.85, caries));
      col = mix(col, cariesCol, smoothstep(0.05, 0.35, caries));
      float st = smoothstep(0.03, 0.5, stain * (0.75 + 0.5 * n2));
      col = mix(col, uStain * (0.75 + 0.5 * n3), st * 0.92);
      float csA = smoothstep(0.03, 0.22, cs * (0.7 + 0.6 * n2));
      col = mix(col, vec3(0.80,0.72,0.50) * (0.78 + 0.35 * n3), csA);
      float cbA = smoothstep(0.03, 0.22, cb * (0.7 + 0.6 * n2));
      col = mix(col, vec3(0.24,0.18,0.10) * (0.8 + 0.4 * n3), cbA);
      vec3 plNat = vec3(0.93,0.9,0.74);
      vec3 plDis = mix(vec3(0.93,0.2,0.47), vec3(0.4,0.14,0.62), vCare.z);
      float pA = smoothstep(0.02, 0.5, plaque * (0.7 + 0.6 * n3));
      col = mix(col, mix(plNat, plDis, uDisclose), pA * mix(0.5, 0.93, uDisclose));
      col = mix(col, plDis * 0.85, uDisclose * csA * 0.3);
      float fl = vCare.y;
      col = mix(col, col * vec3(1.03, 0.97, 0.8), fl * 0.35);
      diffuseColor.rgb = dh_s2l(col);
    `,
    fragRough: `
      float pol = vCare.x;
      roughnessFactor = mix(0.42, 0.13, pol);
      roughnessFactor = mix(roughnessFactor, 0.7, st * 0.6);
      roughnessFactor = mix(roughnessFactor, 0.92, max(csA, cbA));
      roughnessFactor = mix(roughnessFactor, 0.85, pA);
      roughnessFactor = mix(roughnessFactor, 0.1, fl * 0.7);
      roughnessFactor = max(0.06, roughnessFactor - uWet * 0.2);
    `,
    fragNormal: `
      float bh = max(csA, cbA) * (n2 * 0.25 + n3 * 0.12) + pA * n3 * 0.03 + caries * n3 * 0.05;
      normal = dh_perturb(-vViewPosition, normal, bh, faceDirection);
    `,
    fragEmissive: `
      float remain = clamp(csA + cbA + st + pA, 0.0, 1.0);
      totalEmissiveRadiance += vec3(1.0, 0.42, 0.04) * uReveal * remain * 0.9;
      totalEmissiveRadiance += diffuseColor.rgb * 0.05 * (1.0 - remain);
    `,
  });
}

export function createGumMaterial() {
  const uniforms = { uInflam: { value: 0.3 }, uWet: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0, envMapIntensity: 0.8 });
  return patch(mat, {
    uniforms,
    vertHead: `attribute vec3 aGum; attribute float aBlood; varying vec3 vGum; varying float vBlood; varying vec3 vLocal;`,
    vertBody: `vGum = aGum; vBlood = aBlood; vLocal = position;
      transformed += objectNormal * aGum.z * 0.35;`,
    fragHead: `uniform float uInflam; uniform float uWet; varying vec3 vGum; varying float vBlood; varying vec3 vLocal;`,
    fragColor: `
      float md = vGum.x;
      float g1 = vnoise(vLocal * 2.4);
      float g2 = vnoise(vLocal * 0.55 + 3.0);
      vec3 attached = vec3(0.88, 0.53, 0.53);
      vec3 mucosa = vec3(0.8, 0.37, 0.4);
      vec3 col = mix(attached, mucosa, smoothstep(3.5, 6.5, md));
      col *= 0.92 + 0.12 * g2;
      float vein = 1.0 - abs(vnoise(vLocal * vec3(0.35, 0.9, 0.35) + 11.0) * 2.0 - 1.0);
      col = mix(col, vec3(0.66, 0.16, 0.22), smoothstep(0.965, 1.0, vein) * smoothstep(5.0, 8.0, md) * 0.3);
      float inf = uInflam * (1.0 - smoothstep(0.2, 2.6, abs(md)));
      inf = max(inf, uInflam * vGum.y * (1.0 - smoothstep(0.0, 3.5, md)));
      col = mix(col, vec3(0.8, 0.18, 0.22), clamp(inf, 0.0, 1.0) * 0.8);
      float bl = clamp(vBlood, 0.0, 1.0);
      col = mix(col, vec3(0.5, 0.02, 0.04) * (0.8 + 0.4 * g1), bl * 0.92);
      col *= 1.0 - smoothstep(8.0, 14.5, md) * 0.88;
      diffuseColor.rgb = dh_s2l(col);
    `,
    fragRough: `
      roughnessFactor = mix(0.38, 0.24, smoothstep(3.5, 6.5, md));
      roughnessFactor = mix(roughnessFactor, 0.12, bl);
      roughnessFactor = max(0.08, roughnessFactor - uWet * 0.15);
    `,
    fragNormal: `
      float gh = g1 * 0.08 * (1.0 - smoothstep(3.0, 5.0, md)) * (1.0 - inf * 0.8) + vnoise(vLocal * 7.0) * 0.02;
      normal = dh_perturb(-vViewPosition, normal, gh, faceDirection);
    `,
    fragEmissive: `totalEmissiveRadiance += diffuseColor.rgb * 0.06 * (1.0 - smoothstep(8.0, 14.0, md));`,
  });
}

export function createSoftTissueMaterial({ base, papillae = 0.0, ridges = 0.0, rough = 0.45 }) {
  const uniforms = { uWet: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: rough, metalness: 0, envMapIntensity: 0.7 });
  const b = base.map((v) => v.toFixed(3)).join(',');
  return patch(mat, {
    uniforms,
    vertHead: `varying vec3 vLocal;`,
    vertBody: `vLocal = position;`,
    fragHead: `uniform float uWet; varying vec3 vLocal;`,
    fragColor: `
      float t1 = vnoise(vLocal * 1.8);
      float t2 = vnoise(vLocal * 0.4 + 5.0);
      float t3 = vnoise(vLocal * 5.5 + 2.0);
      vec3 col = vec3(${b}) * (0.9 + 0.16 * t2);
      col = mix(col, vec3(0.93, 0.78, 0.76), ${papillae.toFixed(2)} * smoothstep(0.62, 0.9, t3) * 0.45);
      col *= 1.0 - smoothstep(14.0, 30.0, -vLocal.z) * 0.85;
      diffuseColor.rgb = dh_s2l(col);
    `,
    fragRough: `roughnessFactor = max(0.1, ${rough.toFixed(2)} - uWet * 0.15 + t3 * 0.1);`,
    fragNormal: `
      float th = t3 * ${papillae.toFixed(2)} * 0.12 + t1 * 0.05 + ${ridges.toFixed(2)} * 0.0;
      normal = dh_perturb(-vViewPosition, normal, th, faceDirection);
    `,
    fragEmissive: `totalEmissiveRadiance += diffuseColor.rgb * 0.05;`,
  });
}
