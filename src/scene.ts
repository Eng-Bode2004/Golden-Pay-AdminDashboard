import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { logoAspect, logoOutline } from "./logoOutline";
import type { Theme } from "./themes";

type Update = (seconds: number) => void;
interface Stage {
  group: THREE.Group;
  update: Update;
}

export interface SceneHandle {
  update(theme: Theme, animated: boolean): void;
  dispose(): void;
}

const inlineEnd = () => (document.documentElement.dir === "rtl" ? -1 : 1);

function createRenderer(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return { renderer, environment };
}

function metal(color: string, roughness = 0.24) {
  return new THREE.MeshStandardMaterial({ color, metalness: 1, roughness });
}

function emblemGeometry(depth: number) {
  // The traced contour is pixel-noisy; resampling it gives clean metal edges.
  const samples: THREE.Vector3[] = [];
  for (let i = 0; i + 1 < logoOutline.length; i += 6) {
    samples.push(
      new THREE.Vector3(logoOutline[i] - 0.5, (0.5 - logoOutline[i + 1]) / logoAspect, 0),
    );
  }
  const contour = new THREE.CatmullRomCurve3(samples, true, "centripetal").getPoints(420);
  const shape = new THREE.Shape(contour.map((point) => new THREE.Vector2(point.x, point.y)));
  const extruded = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.32,
    bevelSize: 0.008,
    bevelSegments: 3,
    curveSegments: 1,
  });
  const geometry = toCreasedNormals(extruded, 0.7);
  extruded.dispose();
  geometry.center();
  return geometry;
}

function glowTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.25, "rgba(255,255,255,.55)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function glowMaterial(color: string, size: number, opacity = 0.85) {
  return new THREE.PointsMaterial({
    color,
    size,
    map: glowTexture(),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function dust(color: string, count: number, spread: number) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i += 1) {
    positions[i] = (Math.random() - 0.5) * spread;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geometry, glowMaterial(color, 0.05));
}

/** Royal Gold: the brand emblem suspended inside gimballed gold rings. */
function vault(theme: Theme, aspect: number): Stage {
  const group = new THREE.Group();
  const rig = new THREE.Group();
  rig.position.set(inlineEnd() * Math.min(aspect * 2.9, 5.2), -0.5, -3);
  group.add(rig);

  const emblem = new THREE.Mesh(emblemGeometry(0.1), metal(theme.primary, 0.2));
  emblem.scale.setScalar(2.7);
  rig.add(emblem);

  const rings = [2.15, 2.65, 3.15].map((radius, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, index === 1 ? 0.032 : 0.016, 12, 160),
      metal(index === 1 ? theme.primary : theme.secondary, 0.32),
    );
    rig.add(ring);
    return ring;
  });

  const motes = dust(theme.primary, 240, 13);
  group.add(motes);

  return {
    group,
    update(t) {
      emblem.rotation.y = Math.sin(t * 0.32) * 0.55;
      emblem.rotation.x = Math.sin(t * 0.21) * 0.1;
      rings[0].rotation.set(1.2 + t * 0.14, t * 0.1, 0);
      rings[1].rotation.set(t * 0.09, 1 + t * 0.12, 0.3);
      rings[2].rotation.set(0.7, t * 0.06, t * 0.08);
      motes.rotation.y = t * 0.018;
    },
  };
}

/** Midnight Sapphire: a slowly turning network of connected nodes. */
function constellation(theme: Theme): Stage {
  const group = new THREE.Group();
  const count = 110;
  const nodes: THREE.Vector3[] = [];
  for (let i = 0; i < count; i += 1) {
    nodes.push(
      new THREE.Vector3().randomDirection().multiplyScalar(3.1 + Math.random() * 1.8),
    );
  }
  const links: number[] = [];
  nodes.forEach((a, i) => {
    for (let j = i + 1; j < count; j += 1) {
      if (a.distanceTo(nodes[j]) < 1.5) links.push(a.x, a.y, a.z, nodes[j].x, nodes[j].y, nodes[j].z);
    }
  });

  const web = new THREE.Group();
  const pointGeometry = new THREE.BufferGeometry().setFromPoints(nodes);
  web.add(new THREE.Points(pointGeometry, glowMaterial(theme.primary, 0.2)));
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(links, 3));
  web.add(
    new THREE.LineSegments(
      lineGeometry,
      new THREE.LineBasicMaterial({
        color: theme.secondary,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
  );
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.25, 1),
    new THREE.MeshStandardMaterial({
      color: theme.secondary,
      metalness: 0.9,
      roughness: 0.25,
      flatShading: true,
    }),
  );
  web.add(core);
  web.position.z = -1.5;
  group.add(web);
  group.add(dust(theme.primary, 160, 15));

  return {
    group,
    update(t) {
      web.rotation.y = t * 0.06;
      web.rotation.x = Math.sin(t * 0.09) * 0.2;
      core.rotation.y = -t * 0.22;
      core.rotation.z = t * 0.12;
    },
  };
}

/** Imperial Emerald: a rolling field of light. */
function waves(theme: Theme): Stage {
  const group = new THREE.Group();
  const columns = 110;
  const rows = 56;
  const positions = new Float32Array(columns * rows * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const field = new THREE.Points(geometry, glowMaterial(theme.primary, 0.13, 1));
  field.position.set(0, -1.2, -1);
  field.rotation.x = 0.1;
  group.add(field);

  return {
    group,
    update(t) {
      let cursor = 0;
      for (let row = 0; row < rows; row += 1) {
        const z = -row * 0.28 + 3.6;
        for (let column = 0; column < columns; column += 1) {
          const x = (column - columns / 2) * 0.24;
          positions[cursor] = x;
          positions[cursor + 1] =
            Math.sin(x * 0.42 + t * 0.55) * 0.42 +
            Math.cos(z * 0.55 + t * 0.4) * 0.38 +
            Math.sin((x + z) * 0.22 - t * 0.3) * 0.3;
          positions[cursor + 2] = z;
          cursor += 3;
        }
      }
      geometry.attributes.position.needsUpdate = true;
    },
  };
}

/** Royal Amethyst: faceted crystals drifting through the room. */
function crystals(theme: Theme, aspect: number): Stage {
  const group = new THREE.Group();
  const shards: { mesh: THREE.Mesh; speed: number; phase: number; base: THREE.Vector3 }[] = [];
  const shapes = [
    new THREE.OctahedronGeometry(1, 0),
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.TetrahedronGeometry(1, 0),
  ];
  for (let i = 0; i < 16; i += 1) {
    const mesh = new THREE.Mesh(
      shapes[i % shapes.length],
      new THREE.MeshPhysicalMaterial({
        color: i % 3 ? theme.primary : theme.secondary,
        metalness: 0.35,
        roughness: 0.08,
        clearcoat: 1,
        flatShading: true,
        transparent: true,
        opacity: 0.78,
      }),
    );
    const base = new THREE.Vector3(
      (Math.random() - 0.5) * 7 * aspect,
      (Math.random() - 0.5) * 6,
      -1 - Math.random() * 4,
    );
    mesh.scale.setScalar(0.25 + Math.random() * 0.65);
    mesh.position.copy(base);
    group.add(mesh);
    shards.push({ mesh, base, speed: 0.1 + Math.random() * 0.2, phase: Math.random() * 6.28 });
  }
  group.add(dust(theme.primary, 180, 14));

  return {
    group,
    update(t) {
      for (const { mesh, speed, phase, base } of shards) {
        mesh.rotation.x = t * speed + phase;
        mesh.rotation.y = t * speed * 0.7;
        mesh.position.y = base.y + Math.sin(t * speed * 2 + phase) * 0.4;
      }
    },
  };
}

/** Rose Gold: an open gyroscope of polished rings. */
function orbits(theme: Theme, aspect: number): Stage {
  const group = new THREE.Group();
  const rig = new THREE.Group();
  rig.position.set(inlineEnd() * Math.min(aspect * 2, 3.5), 0, -1.6);
  group.add(rig);

  const rings = Array.from({ length: 6 }, (_, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.1 + index * 0.46, index % 2 ? 0.02 : 0.05, 16, 170),
      metal(index % 2 ? theme.secondary : theme.primary, 0.18),
    );
    rig.add(ring);
    return ring;
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.58, 48, 32), metal(theme.primary, 0.1));
  rig.add(core);
  group.add(dust(theme.primary, 220, 14));

  return {
    group,
    update(t) {
      rings.forEach((ring, index) => {
        const direction = index % 2 ? -1 : 1;
        ring.rotation.x = 0.9 + direction * t * (0.1 + index * 0.025);
        ring.rotation.y = direction * t * (0.14 - index * 0.012);
      });
    },
  };
}

/** Black Platinum: a data city of metal towers over a receding grid. */
function skyline(theme: Theme, aspect: number): Stage {
  const group = new THREE.Group();
  const count = 150;
  const towers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.22, 1, 0.22),
    metal(theme.primary, 0.3),
    count,
  );
  const seeds = Array.from({ length: count }, () => ({
    x: (Math.random() - 0.5) * 16 * aspect,
    z: -Math.random() * 16,
    height: 0.3 + Math.random() * Math.random() * 3.4,
    phase: Math.random() * 6.28,
  }));
  group.add(towers);

  const grid = new THREE.GridHelper(44, 44, theme.primary, theme.secondary);
  const gridMaterial = grid.material as THREE.LineBasicMaterial;
  gridMaterial.transparent = true;
  gridMaterial.opacity = 0.2;
  grid.position.y = -2.2;
  group.add(grid);
  group.add(dust(theme.primary, 120, 15));

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();

  return {
    group,
    update(t) {
      seeds.forEach((seed, index) => {
        const height = seed.height * (0.82 + Math.sin(t * 0.45 + seed.phase) * 0.18);
        position.set(seed.x, -2.2 + height / 2, seed.z);
        scale.set(1, height, 1);
        towers.setMatrixAt(index, matrix.compose(position, rotation, scale));
      });
      towers.instanceMatrix.needsUpdate = true;
      grid.position.z = (t * 0.28) % 1;
    },
  };
}

function buildStage(theme: Theme, aspect: number): Stage {
  switch (theme.scene) {
    case "constellation":
      return constellation(theme);
    case "waves":
      return waves(theme);
    case "crystals":
      return crystals(theme, aspect);
    case "orbits":
      return orbits(theme, aspect);
    case "skyline":
      return skyline(theme, aspect);
    default:
      return vault(theme, aspect);
  }
}

function disposeGroup(group: THREE.Object3D) {
  group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    for (const item of [material].flat()) {
      (item as THREE.PointsMaterial | undefined)?.map?.dispose();
      item?.dispose();
    }
  });
}

/** Full-page animated background. One scene per theme. */
export function mountScene(
  canvas: HTMLCanvasElement,
  initialTheme: Theme,
  initialAnimated: boolean,
): SceneHandle {
  const { renderer, environment } = createRenderer(canvas);
  const scene = new THREE.Scene();
  scene.environment = environment;
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 80);
  camera.position.set(0, 0, 7);
  const key = new THREE.PointLight(initialTheme.primary, 26, 22);
  key.position.set(3, 3, 5);
  scene.add(key, new THREE.AmbientLight("#ffffff", 0.25));

  let animated = initialAnimated;
  let theme = initialTheme;
  let stage: Stage;
  const pointer = { x: 0, y: 0 };

  const aspect = () => camera.aspect;
  const load = (next: Theme) => {
    if (stage) {
      scene.remove(stage.group);
      disposeGroup(stage.group);
    }
    theme = next;
    key.color.set(next.primary);
    stage = buildStage(next, aspect());
    scene.add(stage.group);
  };

  const render = (seconds: number) => {
    stage.update(seconds);
    camera.position.x += (pointer.x * 0.5 - camera.position.x) * 0.035;
    camera.position.y += (-pointer.y * 0.3 - camera.position.y) * 0.035;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  };

  const resize = () => {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!animated) render(12);
  };
  resize();
  load(theme);

  let frame = 0;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    if (!document.hidden) render(performance.now() / 1000);
  };
  const start = () => {
    cancelAnimationFrame(frame);
    if (animated) tick();
    else render(12);
  };
  start();

  const onMove = (event: PointerEvent) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("resize", resize);

  return {
    update(nextTheme, nextAnimated) {
      const themeChanged = nextTheme.id !== theme.id;
      const motionChanged = nextAnimated !== animated;
      animated = nextAnimated;
      if (themeChanged) load(nextTheme);
      if (themeChanged || motionChanged) start();
    },
    dispose() {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", resize);
      disposeGroup(stage.group);
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

/** Polished extruded logo for the sign-in hero. Always brand gold. */
export function mountEmblem(canvas: HTMLCanvasElement, animated: boolean): () => void {
  const { renderer, environment } = createRenderer(canvas);
  const scene = new THREE.Scene();
  scene.environment = environment;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
  camera.position.z = 5;

  const emblem = new THREE.Group();
  const mesh = new THREE.Mesh(emblemGeometry(0.12), metal("#e6c67e", 0.17));
  mesh.scale.setScalar(2);
  emblem.add(mesh);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1.5, 0.012, 10, 140),
    metal("#f6e2ae", 0.3),
  );
  halo.rotation.x = 1.3;
  emblem.add(halo);
  scene.add(emblem);

  const key = new THREE.PointLight("#fff1cc", 18, 12);
  key.position.set(2, 2.2, 3);
  scene.add(key);

  const pointer = { x: 0, y: 0 };
  const onMove = (event: PointerEvent) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  const resize = () => {
    const size = canvas.clientWidth || 260;
    renderer.setSize(size, canvas.clientHeight || size, false);
  };
  resize();

  let frame = 0;
  const render = (seconds: number) => {
    mesh.rotation.y = seconds * 0.55;
    emblem.rotation.x = pointer.y * 0.22;
    emblem.rotation.z = -pointer.x * 0.12;
    halo.rotation.z = seconds * 0.4;
    renderer.render(scene, camera);
  };
  const tick = () => {
    frame = requestAnimationFrame(tick);
    if (!document.hidden) render(performance.now() / 1000);
  };
  if (animated) tick();
  else render(0.5);

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("pointermove", onMove);
    disposeGroup(scene);
    environment.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
