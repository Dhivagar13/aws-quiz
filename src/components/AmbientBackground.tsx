import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

type AmbientBackgroundProps = {
  /** 0.25-1 density scale for attractor points + tube detail. [inferred] default 1. */
  density?: number;
  /** Override prefers-reduced-motion for tests / projector mode. */
  forceReducedMotion?: boolean;
};

export default function AmbientBackground({ density = 1, forceReducedMotion }: AmbientBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;
    let disposed = false;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 900);
    camera.position.set(10, 6, 68);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: "high-performance",
        alpha: false,
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    // [inferred] College projector perf: cap DPR 1.5 desktop, 1.25 small screens.
    let isSmallScreen = false;
    try {
      isSmallScreen =
        window.innerWidth < 768 ||
        (typeof window.matchMedia === "function" &&
          window.matchMedia("(max-width: 768px)").matches);
    } catch {
      isSmallScreen = false;
    }
    const dprCap = isSmallScreen ? 1.25 : 1.5;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 1);
    renderer.toneMapping = THREE.NoToneMapping;

    let composer: EffectComposer;
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));

      const bloom = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        1.5,
        0.75,
        0.1
      );
      composer.addPass(bloom);

      const FinalShader = {
        uniforms: {
          tDiffuse: { value: null },
        },
        vertexShader: `
          varying vec2 vUv;
          void main(){
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D tDiffuse;
          varying vec2 vUv;

          vec3 aces(vec3 x){
            const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
            return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0);
          }

          void main(){
            vec2 center = vUv - 0.5;

            float ca = 0.0015;
            vec3 hdr;
            hdr.r = texture2D(tDiffuse, vUv + center * ca).r;
            hdr.g = texture2D(tDiffuse, vUv              ).g;
            hdr.b = texture2D(tDiffuse, vUv - center * ca).b;

            vec3 ldr = aces(hdr * 1.15);

            float v = 1.0 - dot(center * 1.3, center * 1.3);
            ldr *= smoothstep(0.0, 1.0, v);

            gl_FragColor = vec4(clamp(ldr, 0.0, 1.0), 1.0);
          }
        `,
      };
      const finalPass = new ShaderPass(FinalShader);
      composer.addPass(finalPass);
    } catch {
      // Fallback to direct renderer if postprocessing fails on device
      composer = null as unknown as EffectComposer;
    }

    const rotGroup = new THREE.Group();
    scene.add(rotGroup);

    // 3D Spinning Circles / Orbital Rings Group
    const circleGroup = new THREE.Group();
    rotGroup.add(circleGroup);

    // 1. Spinning Torus Ring
    const torusGeo = new THREE.TorusGeometry(26, 0.16, 16, 120);
    const torusMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.0, 1.0, 0.25),
      transparent: true,
      opacity: 0.7,
    });
    const torusMesh = new THREE.Mesh(torusGeo, torusMat);
    torusMesh.rotation.x = Math.PI / 2;
    circleGroup.add(torusMesh);

    // 2. Spinning Inner Tech Ring
    const ringGeo = new THREE.RingGeometry(18, 18.3, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.2, 0.9, 0.4),
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    circleGroup.add(ringMesh);

    // 3. Spinning Orbit Particle Points Circle
    const circlePointsCount = 200;
    const circlePts: THREE.Vector3[] = [];
    for (let i = 0; i < circlePointsCount; i++) {
      const theta = (i / circlePointsCount) * Math.PI * 2;
      circlePts.push(new THREE.Vector3(Math.cos(theta) * 32, 0, Math.sin(theta) * 32));
    }
    const circlePtsGeo = new THREE.BufferGeometry().setFromPoints(circlePts);
    const circlePtsMat = new THREE.PointsMaterial({
      color: new THREE.Color(0.0, 1.0, 0.35),
      size: 0.55,
      transparent: true,
      opacity: 0.85,
    });
    const circlePointsMesh = new THREE.Points(circlePtsGeo, circlePtsMat);
    circleGroup.add(circlePointsMesh);

    // Chaotic Attractor Differential Equations
    const Ap = 0.95,
      Bp = 0.7,
      Cp = 0.6,
      Dp = 3.5,
      Ep = 0.25,
      Fp = 0.1;
    // [inferred] Density scaling: prop 0.25-1 * 0.5 on small screens keeps
    // projector + mobile GPUs smooth. Desktop full N 14000, mobile ~7000.
    const clampedDensity = Math.min(Math.max(density, 0.25), 1);
    const effectiveDensity = clampedDensity * (isSmallScreen ? 0.5 : 1);
    const DT = 0.008,
      N = Math.max(3500, Math.floor(14000 * effectiveDensity)),
      S = 17.0;
    const tubularSegments = isSmallScreen ? 3000 : 6000;

    function deriv(x: number, y: number, z: number): [number, number, number] {
      return [
        (z - Bp) * x - Dp * y,
        Dp * x + (z - Bp) * y,
        Cp + Ap * z - Math.pow(z, 3) / 3 - (x * x + y * y) * (1 + Ep * z) + Fp * z * Math.pow(x, 3),
      ];
    }

    function rk4(x: number, y: number, z: number): [number, number, number] {
      const [k1x, k1y, k1z] = deriv(x, y, z);
      const [k2x, k2y, k2z] = deriv(x + k1x * DT * 0.5, y + k1y * DT * 0.5, z + k1z * DT * 0.5);
      const [k3x, k3y, k3z] = deriv(x + k2x * DT * 0.5, y + k2y * DT * 0.5, z + k2z * DT * 0.5);
      const [k4x, k4y, k4z] = deriv(x + k3x * DT, y + k3y * DT, z + k3z * DT);
      return [
        x + ((k1x + 2 * k2x + 2 * k3x + k4x) * DT) / 6,
        y + ((k1y + 2 * k2y + 2 * k3y + k4y) * DT) / 6,
        z + ((k1z + 2 * k2z + 2 * k3z + k4z) * DT) / 6,
      ];
    }

    let sx = 0.1,
      sy = 0,
      sz = 0;
    for (let i = 0; i < 8000; i++) [sx, sy, sz] = rk4(sx, sy, sz);

    const rawPts: THREE.Vector3[] = [];
    const velMags: number[] = [];
    let px = sx,
      py = sy,
      pz = sz;
    for (let i = 0; i < N; i++) {
      const [nx, ny, nz] = rk4(px, py, pz);
      velMags.push(Math.hypot(nx - px, ny - py, nz - pz) / DT);
      rawPts.push(new THREE.Vector3(nx * S, ny * S, nz * S));
      [px, py, pz] = [nx, ny, nz];
    }

    const centroid = new THREE.Vector3();
    rawPts.forEach((p) => centroid.add(p));
    centroid.divideScalar(rawPts.length);
    const pts = rawPts.map((p) => p.clone().sub(centroid));
    const maxV = Math.max(...velMags);
    const nVel = velMags.map((v) => v / maxV);

    const PAL = [
      new THREE.Color(0.0, 0.15, 0.02),
      new THREE.Color(0.0, 0.45, 0.08),
      new THREE.Color(0.0, 0.85, 0.2),
      new THREE.Color(0.4, 1.0, 0.5),
      new THREE.Color(0.0, 0.85, 0.2),
      new THREE.Color(0.0, 0.45, 0.08),
      new THREE.Color(0.0, 0.15, 0.02),
    ];

    function palSample(t: number) {
      const s = t * (PAL.length - 1);
      const i = Math.min(Math.floor(s), PAL.length - 2);
      return new THREE.Color().copy(PAL[i]).lerp(PAL[i + 1], s - i);
    }

    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);

    function attachColour(geo: THREE.BufferGeometry, nPoints: number | null, useVel: boolean) {
      const uv = geo.attributes.uv;
      const cnt = uv ? uv.count : (nPoints ?? N);
      const cA = new Float32Array(cnt * 3);
      const pA = new Float32Array(cnt);
      for (let i = 0; i < cnt; i++) {
        const t = uv ? uv.getX(i) : i / Math.max(cnt - 1, 1);
        pA[i] = t;
        const idx = Math.min(Math.floor(t * (N - 1)), N - 1);
        const c = palSample(t);
        const vb = useVel ? 0.45 + nVel[idx] * 1.4 : 1.0;
        cA[i * 3] = c.r * vb;
        cA[i * 3 + 1] = c.g * vb;
        cA[i * 3 + 2] = c.b * vb;
      }
      geo.setAttribute("aColor", new THREE.BufferAttribute(cA, 3));
      geo.setAttribute("aProgress", new THREE.BufferAttribute(pA, 1));
    }

    function makeSyntaxMat(charsX: number, charsY: number, flowSpeed: number, energyMod: number) {
      return new THREE.ShaderMaterial({
        uniforms: {
          u_time: { value: 0 },
          u_fadeIn: { value: 0 },
          u_charsX: { value: charsX },
          u_charsY: { value: charsY },
          u_flowSpeed: { value: flowSpeed },
        },
        vertexShader: `
          attribute vec3 aColor;
          attribute float aProgress;
          varying vec3 vColor;
          varying vec2 vUv;
          varying float vEnergy;
          uniform float u_time;

          void main(){
            vUv = uv;
            vColor = aColor;

            float p1=pow(fract(aProgress*3.0  -u_time*0.140),24.0);
            float p2=pow(fract(aProgress*6.5  -u_time*0.231),30.0)*0.60;
            float p3=pow(fract(aProgress*11.0 +u_time*0.083),38.0)*0.36;
            float p4=pow(fract(aProgress*19.5 -u_time*0.397),46.0)*0.50;
            vEnergy = (p1+p2+p3+p4) * ${energyMod.toFixed(2)};

            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float u_time;
          uniform float u_fadeIn;
          uniform float u_charsX;
          uniform float u_charsY;
          uniform float u_flowSpeed;

          varying vec3 vColor;
          varying vec2 vUv;
          varying float vEnergy;

          void main() {
            vec2 gridPos = vec2(vUv.x * u_charsX, vUv.y * u_charsY);
            gridPos.x -= u_time * u_flowSpeed;

            vec2 gridId = floor(gridPos);
            vec2 gridUv = fract(gridPos);

            float bounds = step(0.2, gridUv.x) * step(gridUv.x, 0.8) * step(0.2, gridUv.y) * step(gridUv.y, 0.8);
            if (bounds < 0.5) discard;

            float wordId = floor(gridPos.x / 18.0);
            float wordActive = step(0.65, fract(sin(wordId * 123.456) * 789.123));

            float charIndexInWord = gridPos.x - wordId * 18.0;
            float wordLen = 3.0 + floor(fract(sin(wordId * 987.654) * 321.123) * 7.0);
            float inWord = step(charIndexInWord, wordLen);

            if (wordActive * inWord < 0.5) discard;

            vec2 pxPos = gridUv * vec2(3.0, 5.0);
            vec2 pxId = floor(pxPos);
            vec2 pxUv = fract(pxPos);

            float pGap = step(0.1, pxUv.x) * step(pxUv.x, 0.9) * step(0.1, pxUv.y) * step(pxUv.y, 0.9);
            if (pGap < 0.5) discard;

            float digitType = step(0.5, fract(sin(dot(gridId, vec2(12.9898, 78.233))) * 43758.5453));
            float charPixel = 0.0;

            if (digitType > 0.5) {
              charPixel = (pxId.x == 1.0 || pxId.y == 0.0 || (pxId.x == 0.0 && pxId.y == 3.0)) ? 1.0 : 0.0;
            } else {
              charPixel = (pxId.x == 0.0 || pxId.x == 2.0 || pxId.y == 0.0 || pxId.y == 4.0) ? 1.0 : 0.0;
              if (pxId.x == 1.0 && pxId.y > 0.0 && pxId.y < 4.0) charPixel = 0.0;
            }

            if (charPixel < 0.5) discard;

            float pulse = vEnergy * 4.5;
            float baseBright = 1.2;

            vec3 finalCol = vColor * (baseBright + pulse);
            float a = u_fadeIn;

            gl_FragColor = vec4(finalCol, a);
          }
        `,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        side: THREE.DoubleSide,
      });
    }

    const allMats: THREE.ShaderMaterial[] = [];

    const coreGeo = new THREE.TubeGeometry(curve, tubularSegments, 0.04, 4, false);
    attachColour(coreGeo, null, true);
    const coreMat = makeSyntaxMat(2500.0, 4.0, 15.0, 1.2);
    allMats.push(coreMat);
    rotGroup.add(new THREE.Mesh(coreGeo, coreMat));

    const midGeo = new THREE.TubeGeometry(curve, tubularSegments, 0.12, 6, false);
    attachColour(midGeo, null, true);
    const midMat = makeSyntaxMat(3500.0, 6.0, 10.0, 0.9);
    allMats.push(midMat);
    rotGroup.add(new THREE.Mesh(midGeo, midMat));

    const outerGeo = new THREE.TubeGeometry(curve, tubularSegments, 0.25, 8, false);
    attachColour(outerGeo, null, false);
    const cArr = outerGeo.attributes.aColor.array as Float32Array;
    for (let i = 0; i < cArr.length; i++) cArr[i] *= 0.35;
    outerGeo.attributes.aColor.needsUpdate = true;

    const outerMat = makeSyntaxMat(5000.0, 10.0, 6.0, 0.5);
    allMats.push(outerMat);
    rotGroup.add(new THREE.Mesh(outerGeo, outerMat));

    let mouseX = 0;
    let mouseY = 0;
    function handlePointerMove(e: PointerEvent) {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    }
    window.addEventListener("pointermove", handlePointerMove);

    function handleResize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (composer) composer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);

    const clock = new THREE.Clock();
    // [inferred] Reduced-motion: freeze all orbital motion together so no
    // single ring appears stuck while others move. Still renders + fades.
    // Guarded + live-synced so WebGL and CSS pause together.
    function getReducedMotion(): boolean {
      try {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches === true;
      } catch {
        return false;
      }
    }
    let prefersReducedMotion = forceReducedMotion ?? getReducedMotion();
    let reducedMq: MediaQueryList | null = null;
    const onReducedMotionChange = (e: MediaQueryListEvent) => {
      if (forceReducedMotion === undefined) prefersReducedMotion = e.matches === true;
    };
    try {
      reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (typeof reducedMq.addEventListener === "function") {
        reducedMq.addEventListener("change", onReducedMotionChange);
      } else {
        (reducedMq as unknown as { addListener?: (cb: (e: MediaQueryListEvent) => void) => void }).addListener?.(
          onReducedMotionChange
        );
      }
    } catch {
      reducedMq = null;
    }

    function animate() {
      if (disposed) return;
      animId = requestAnimationFrame(animate);
      try {
        const t = clock.getElapsedTime();
        // Freeze simulated time when reduced motion is requested; fade still progresses.
        const st = prefersReducedMotion ? 0 : t;
        const fade = Math.min(1.0, t / 3.0);

        for (const mat of allMats) {
          mat.uniforms.u_time.value = st;
          mat.uniforms.u_fadeIn.value = fade;
        }

        // Attractor 3D rotation
        rotGroup.rotation.y = st * 0.072 + mouseX * 0.15;
        rotGroup.rotation.x = Math.sin(st * 0.053) * 0.4 + 0.28 + mouseY * 0.12;
        rotGroup.rotation.z = Math.sin(st * 0.039) * 0.17;

        // Spinning circles rotation
        circleGroup.rotation.y = st * 0.25;
        circleGroup.rotation.z = Math.sin(st * 0.15) * 0.25;
        // Each ring keeps its own opposing delta on a VISIBLE axis.
        // Torus/Ring are rotationally symmetric about local Z, so a Z spin
        // is invisible; continuous spin lives on Y (tumbling) with tilt
        // wobble on X. Points counter-rotate against the group for depth.
        torusMesh.rotation.y = st * 0.3;
        torusMesh.rotation.x = Math.PI / 2 + Math.sin(st * 0.2) * 0.15;
        ringMesh.rotation.y = -st * 0.45;
        ringMesh.rotation.x = Math.PI / 2 + Math.sin(st * 0.18) * 0.12;
        circlePointsMesh.rotation.y = -st * 0.2;

        if (composer) {
          try {
            composer.render();
          } catch {
            renderer.render(scene, camera);
          }
        } else {
          renderer.render(scene, camera);
        }
      } catch {
        try {
          renderer.render(scene, camera);
        } catch {
          // Keep loop alive; next frame already scheduled.
        }
      }
    }

    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", handleResize);
      try {
        if (reducedMq) {
          if (typeof reducedMq.removeEventListener === "function") {
            reducedMq.removeEventListener("change", onReducedMotionChange);
          } else {
            (reducedMq as unknown as { removeListener?: (cb: (e: MediaQueryListEvent) => void) => void }).removeListener?.(
              onReducedMotionChange
            );
          }
        }
      } catch {
        // Listener cleanup is best-effort.
      }
      if (composer) composer.dispose();
      renderer.dispose();
      torusGeo.dispose();
      torusMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      circlePtsGeo.dispose();
      circlePtsMat.dispose();
      coreGeo.dispose();
      midGeo.dispose();
      outerGeo.dispose();
      coreMat.dispose();
      midMat.dispose();
      outerMat.dispose();
    };
  }, [density, forceReducedMotion]);

  if (webglFailed) {
    return (
      <>
        <div
          className="three-bg-canvas"
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse at 50% 45%, rgba(0,255,65,0.16) 0%, rgba(0,60,20,0.28) 42%, #000000 78%)",
          }}
        />
        <div id="hud" aria-hidden="true">
          <div className="corner" id="c-tl">
            <svg viewBox="0 0 20 20" fill="none">
              <path d="M1 19V1H19" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="corner" id="c-tr">
            <svg viewBox="0 0 20 20" fill="none">
              <path d="M1 19V1H19" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="corner" id="c-bl">
            <svg viewBox="0 0 20 20" fill="none">
              <path d="M1 19V1H19" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="corner" id="c-br">
            <svg viewBox="0 0 20 20" fill="none">
              <path d="M1 19V1H19" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <canvas ref={canvasRef} className="three-bg-canvas" aria-hidden="true" />
      <div id="hud" aria-hidden="true">
        <div className="corner" id="c-tl">
          <svg viewBox="0 0 20 20" fill="none">
            <path d="M1 19V1H19" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
        <div className="corner" id="c-tr">
          <svg viewBox="0 0 20 20" fill="none">
            <path d="M1 19V1H19" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
        <div className="corner" id="c-bl">
          <svg viewBox="0 0 20 20" fill="none">
            <path d="M1 19V1H19" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
        <div className="corner" id="c-br">
          <svg viewBox="0 0 20 20" fill="none">
            <path d="M1 19V1H19" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>

        {/* HUD Spinning Circle Reticle */}
        <div className="spinning-circle-container">
          <div className="spinning-circle ring-outer" />
          <div className="spinning-circle ring-inner" />
          <div className="spinning-circle ring-radar" />
        </div>
      </div>
    </>
  );
}
