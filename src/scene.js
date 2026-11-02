import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { buildBasisVolume } from "./basis3d.js";
import { membraneCutGeometry } from "./membrane-cut.js";
import { lipidTailGeometry } from "./lipids.js";
import { recolorSourceColor } from "./palettes.js";
import {
  bezier,
  tangent,
  arcTable,
  arcT,
  frame,
  effectiveDepth,
  closestCurveT,
} from "./model.js";
const v = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const sphere = new T.SphereGeometry(1, 18, 12),
  cylinder = new T.CylinderGeometry(1, 1, 1, 12),
  dummy = new T.Object3D();
export class StudioScene {
  constructor(host, onSelect, onCamera, onCurve, onTransform) {
    this.host = host;
    this.onSelect = onSelect;
    this.onCamera = onCamera;
    this.onCurve = onCurve;
    this.onTransform = onTransform;
    this.scene = new T.Scene();
    this.camera = new T.OrthographicCamera(-22, 22, 16, -16, 0.1, 600);
    this.ortho = this.camera;
    this.perspective = new T.PerspectiveCamera(42, 1, 0.1, 600);
    this.camera.position.set(20, 14, 32);
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.setClearColor("#f4f7fa");
    host.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Driedimensionale illustratiescène",
    );
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 2, 0);
    this.controls.enableDamping = false;
    this.controls.minZoom = 0.3;
    this.controls.maxZoom = 8;
    this.controls.addEventListener("end", () =>
      this.onCamera?.(this.getCamera()),
    );
    this.scene.add(new T.HemisphereLight(0xffffff, 0x8892a6, 2.3));
    const light = new T.DirectionalLight(0xffffff, 3);
    light.position.set(-10, 20, 25);
    this.scene.add(light);
    this.root = new T.Group();
    this.scene.add(this.root);
    this.clip = new T.Plane();
    this.ray = new T.Raycaster();
    this.pointer = new T.Vector2();
    this.groups = new Map();
    this.textures = new Map();
    this.volumeAssets = new Map();
    this.glbs = new Map();
    this.mode = "select";
    this.gizmo = new TransformControls(this.camera, this.renderer.domElement);
    this.gizmo.setSize(0.7);
    this.scene.add(this.gizmo.getHelper());
    this.gizmo.addEventListener("dragging-changed", (e) => {
      this.controls.enabled = !e.value;
      if (!e.value && this.selected) {
        const g = this.groups.get(this.selected);
        if (g) {
          if (this.mode === "hinge") {
            const item = this.project.items.find((i) => i.id === this.selected),
              arm = this.gizmo.object;
            if (item && arm)
              this.onHinge?.(item.id, T.MathUtils.radToDeg(arm.rotation.z));
          } else
            this.onTransform?.(
              this.selected,
              g.position.toArray(),
              g.rotation.z,
              [g.rotation.x, g.rotation.y, g.rotation.z],
            );
        }
      }
    });
    this.gizmo.addEventListener("mouseDown", () => (this.skipPick = true));
    this.resize = new ResizeObserver(() => this.size());
    this.resize.observe(host);
    this.bind();
    this.size();
    this.animate();
  }
  size() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.camera.left = (-13 * w) / h;
    this.camera.right = (13 * w) / h;
    this.camera.top = 13;
    this.camera.bottom = -13;
    this.perspective.aspect = w / h;
    this.perspective.updateProjectionMatrix();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
  getCamera() {
    return {
      position: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      zoom: this.camera.zoom,
      projection: this.camera.isPerspectiveCamera
        ? "perspective"
        : "orthographic",
      mode: this.cameraMode,
      anchorId: this.anchorId,
    };
  }
  setCamera(c) {
    this.cameraMode = c.mode || "follow";
    const chosen =
      c.projection === "perspective" ? this.perspective : this.ortho;
    if (this.camera !== chosen) {
      this.camera = chosen;
      this.controls.object = chosen;
      this.gizmo.camera = chosen;
      this.size();
    }
    this.anchorId = c.anchorId;
    this.camera.position.fromArray(c.position);
    this.controls.target.fromArray(c.target);
    this.camera.zoom = c.zoom;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }
  focus(id) {
    const g = this.groups.get(id);
    if (!g) return;
    this.anchorId = id;
    this.cameraMode = "follow";
    const delta = g.position.clone().sub(this.controls.target);
    this.camera.position.add(delta);
    this.controls.target.copy(g.position);
    this.controls.update();
    this.onCamera?.(this.getCamera());
  }
  setMode(mode) {
    this.mode = mode;
    this.gizmo.detach();
    this.gizmo.showX = true;
    this.gizmo.showY = true;
    this.gizmo.showZ = true;
    if (mode === "move") {
      const i = this.project.items.find((i) => i.id === this.selected);
      if (i && !i.anchored) {
        this.gizmo.setMode("translate");
        this.gizmo.attach(this.groups.get(i.id));
      }
    }
    if (mode === "rotate") {
      const item = this.project.items.find((i) => i.id === this.selected),
        group = this.groups.get(this.selected);
      if (group) {
        this.gizmo.setMode("rotate");
        if (item.anchored) {
          this.gizmo.showX = false;
          this.gizmo.showZ = false;
        }
        this.gizmo.attach(group);
      }
    }
    if (mode === "hinge") {
      const i = this.project.items.find((i) => i.id === this.selected);
      if (i?.kind === "igg") {
        const arm = this.groups
          .get(i.id)
          ?.children.find(
            (c) =>
              c.userData.domain ===
              ((i.domain || "right") === "left" ? "Fab links" : "Fab rechts"),
          );
        if (arm) {
          this.gizmo.setMode("rotate");
          this.gizmo.showX = false;
          this.gizmo.showY = false;
          this.gizmo.attach(arm);
        }
      }
    }
    this.updateHandles();
  }
  select(id) {
    this.selected = id;
    this.setMode(this.mode);
    this.outline?.removeFromParent();
    this.outline?.geometry.dispose();
    this.outline?.material.dispose();
    this.outline = null;
    if (id && this.groups.has(id)) {
      this.outline = new T.BoxHelper(this.groups.get(id), 0x008e93);
      this.scene.add(this.outline);
    }
  }
  material(color, extra = {}) {
    return new T.MeshStandardMaterial({
      color,
      roughness: 0.65,
      metalness: 0,
      ...extra,
    });
  }
  ellipsoid(parent, pos, scale, color) {
    const mesh = new T.Mesh(sphere, this.material(color));
    mesh.position.fromArray(pos);
    mesh.scale.fromArray(scale);
    parent.add(mesh);
    return mesh;
  }
  rod(parent, a, b, r, color) {
    const start = v(...a),
      end = v(...b),
      dir = end.clone().sub(start);
    const mesh = new T.Mesh(cylinder, this.material(color));
    mesh.position.copy(start.add(end).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(v(0, 1, 0), dir.clone().normalize());
    mesh.scale.set(r, dir.length(), r);
    parent.add(mesh);
    return mesh;
  }
  clear() {
    this.gizmo.detach();
    this.root.traverse((o) => {
      if (o.userData.labelTexture) o.userData.labelTexture.dispose();
    });
    this.outline?.removeFromParent();
    this.root.traverse((o) => {
      if (
        !o.userData.sharedGeometry &&
        o.geometry &&
        o.geometry !== sphere &&
        o.geometry !== cylinder
      )
        o.geometry.dispose();
      if (o.material) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      }
    });
    this.root.clear();
    this.groups.clear();
  }
  build(p) {
    this.project = p;
    this.clear();
    this.renderer.setClearColor(p.style.background);
    this.table = arcTable(p.curve);
    this.membrane(p);
    for (const item of p.items) this.addItem(item, p);
    this.updateHandles();
    this.select(this.selected);
  }
  membrane(p) {
    const group = new T.Group();
    this.root.add(group);
    this.membraneGroup = group;
    const N = 120,
      D = 30,
      head = [],
      tails = [],
      surfaces = [[], []];
    const pores = p.items
      .filter((i) => i.visible && i.anchored && i.kind === "channel")
      .map((i) => ({
        s: i.s * this.table.length,
        v: effectiveDepth(p, i),
        r: 1.25 * i.scale,
      }));
    const hole = (s, z) =>
      pores.some((q) => (s - q.s) ** 2 + (z - q.v) ** 2 < q.r * q.r);
    const point = (u, z, side) => {
      const a = bezier(p.curve, u),
        t = tangent(p.curve, u);
      return [
        a[0] - ((t[1] * p.thickness) / 2) * side,
        a[1] + ((t[0] * p.thickness) / 2) * side,
        z,
      ];
    };
    for (let i = 0; i < N; i++) {
      const u = arcT(this.table, i / N),
        un = arcT(this.table, (i + 1) / N);
      for (let j = 0; j < D; j++) {
        const z = -p.depth / 2 + (j / D) * p.depth,
          zn = z + p.depth / D,
          s = ((i + 0.5) / N) * this.table.length;
        /* Remove every intersecting cell: membrane never spans the lumen. */ const margin =
          Math.hypot(this.table.length / N, p.depth / D) / 2;
        if (
          pores.some(
            (q) =>
              (s - q.s) ** 2 + ((z + zn) / 2 - q.v) ** 2 < (q.r + margin) ** 2,
          )
        )
          continue;
        for (const [k, side] of [-1, 1].entries()) {
          const a = point(u, z, side),
            b = point(un, z, side),
            c = point(un, zn, side),
            d = point(u, zn, side);
          surfaces[k].push(...a, ...b, ...c, ...a, ...c, ...d);
        }
      }
    }
    for (const vertices of surfaces) {
      const geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
      geo.computeVertexNormals();
      group.add(
        new T.Mesh(
          geo,
          this.material(p.style.head, {
            side: T.DoubleSide,
            clippingPlanes: [this.clip],
          }),
        ),
      );
    }
    const step = 0.65,
      nu = Math.floor(this.table.length / step),
      nv = Math.floor(p.depth / step);
    for (let i = 0; i <= nu; i++) {
      const s = (i / nu) * this.table.length,
        u = arcT(this.table, i / nu),
        pos = bezier(p.curve, u),
        tan = tangent(p.curve, u);
      for (let j = 0; j <= nv; j++) {
        const z = -p.depth / 2 + (j / nv) * p.depth;
        if (
          hole(s, z) ||
          pores.some((q) => (s - q.s) ** 2 + (z - q.v) ** 2 < (q.r + 0.3) ** 2)
        )
          continue;
        for (const side of [-1, 1]) {
          head.push({
            pos: [
              pos[0] - tan[1] * p.thickness * 0.5 * side,
              pos[1] + tan[0] * p.thickness * 0.5 * side,
              z,
            ],
            scale: [0.22, 0.185, 0.22],
            angle: 0,
          });
          tails.push({
            pos: [
              pos[0] - tan[1] * p.thickness * 0.38 * side,
              pos[1] + tan[0] * p.thickness * 0.38 * side,
              z,
            ],
            scale: [1, p.thickness * 0.35, 1],
            angle: Math.atan2(tan[1], tan[0]) + (side < 0 ? Math.PI : 0),
          });
        }
      }
    }
    const addInstances = (geo, list, color, stableColor = false) => {
      // Thin cartoon tails must retain their style colour under bright scene lights.
      const mat = stableColor
        ? new T.MeshBasicMaterial({ color, clippingPlanes: [this.clip] })
        : this.material(color, { clippingPlanes: [this.clip] });
      /* Fade with membrane depth; clipping remains geometry-independent. */ mat.onBeforeCompile =
        (shader) => {
          shader.uniforms.fadeStrength = { value: p.fade };
          shader.uniforms.membraneDepth = { value: p.depth };
          shader.vertexShader =
            "varying float membraneZ;\n" +
            shader.vertexShader.replace(
              "#include <worldpos_vertex>",
              "#include <worldpos_vertex>\n vec4 memP=vec4(transformed,1.0);\n #ifdef USE_INSTANCING\n memP=instanceMatrix*memP;\n #endif\n membraneZ=(modelMatrix*memP).z;",
            );
          shader.fragmentShader =
            "varying float membraneZ; uniform float fadeStrength; uniform float membraneDepth;\n" +
            shader.fragmentShader.replace(
              "#include <opaque_fragment>",
              "diffuseColor.a*=1.0-fadeStrength*clamp((-membraneZ/membraneDepth)+0.5,0.0,1.0);\n#include <opaque_fragment>",
            );
        };
      mat.transparent = p.fade > 0;
      mat.depthWrite = p.fade === 0;
      const mesh = new T.InstancedMesh(geo, mat, list.length);
      list.forEach((o, i) => {
        dummy.position.fromArray(o.pos);
        dummy.scale.fromArray(o.scale);
        dummy.rotation.set(0, 0, o.angle);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      group.add(mesh);
    };
    addInstances(sphere, head, p.style.head);
    addInstances(lipidTailGeometry(), tails, p.style.tail, true);
    // One continuous camera-plane intersection, rather than individual bright slabs.
    this.cap = new T.Mesh(
      new T.BufferGeometry(),
      new T.MeshBasicMaterial({
        color: new T.Color(p.style.tail).lerp(
          new T.Color(p.style.core || "#D9EAF6"),
          0.35,
        ),
        side: T.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    this.cap.userData.cutKey = null;
    group.add(this.cap);
    this.pores = pores;
  }
  addItem(item, p) {
    const g = new T.Group();
    g.userData.id = item.id;
    g.visible = item.visible;
    this.groups.set(item.id, g);
    this.root.add(g);
    const s = p.style,
      c =
        item.color ||
        {
          hla: s.hla,
          hla2: s.hla,
          tcr: s.receptor,
          igg: s.antibody,
          channel: s.channel,
          pd1: s.receptor,
          pdl1: s.hla,
        }[item.kind] ||
        s.receptor;
    const domain = (par, x, y, z, rx, ry, rz, color = c) =>
      this.ellipsoid(par, [x, y, z], [rx, ry, rz], color);
    if (item.kind === "igg") {
      for (const x of [-0.47, 0.47]) {
        domain(g, x, 1.7, 0, 0.48, 1.65, 0.47);
        this.rod(g, [x, 2.8, 0], [x, 4.2, 0], 0.13, c);
      }
      for (const side of [-1, 1]) {
        const arm = new T.Group();
        arm.userData.domain = side < 0 ? "Fab links" : "Fab rechts";
        arm.userData.side = side;
        const content = new T.Group();
        arm.add(content);
        this.poseArm(arm, item);
        g.add(arm);
        for (const x of [-0.42, 0.42]) {
          domain(content, x, 1.1, 0, 0.45, 1.1, 0.43);
          domain(content, x, 3.1, 0, 0.48, 1.05, 0.45);
        }
      }
      if (item.hinge) {
        const pivot = item.pivot || [0, 4.2, 0];
        domain(g, ...pivot, 0.14, 0.14, 0.14, "#008e93");
      }
    } else if (item.kind === "channel") {
      const radius = 1.6;
      const wall = new T.Mesh(
        new T.CylinderGeometry(radius, radius, 4, 48, 1, true),
        this.material(c, { side: T.DoubleSide, clippingPlanes: [this.clip] }),
      );
      g.add(wall);
      const inner = new T.Mesh(
        new T.CylinderGeometry(1.2, 1.2, 4, 48, 1, true),
        this.material(s.head, {
          side: T.DoubleSide,
          clippingPlanes: [this.clip],
        }),
      );
      g.add(inner);
      for (const y of [-2, 2]) {
        const ring = new T.Mesh(
          new T.RingGeometry(1.2, radius, 48),
          this.material(c, { side: T.DoubleSide, clippingPlanes: [this.clip] }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        g.add(ring);
      }
    } else if (item.kind === "hla" || item.kind === "hla2") {
      const parts = item.kind === "hla2" ? [-0.6, 0.6] : [0];
      for (const x of parts) {
        this.rod(g, [x, -1.6, 0], [x, 1.65, 0], 0.17, c);
        domain(g, x, 2.5, 0, 0.68, 1, 0.6);
      }
      if (item.kind === "hla")
        domain(g, -1.05, 2.9, 0, 0.52, 0.75, 0.5, s.tail);
      for (const z of [-0.65, 0.65]) {
        domain(g, 0, 4.4, z, 1.48, 0.52, 0.4);
      }
      const pts = [];
      for (let i = 0; i < 14; i++)
        pts.push(v(-1.45 + i * 0.225, 4.65 + Math.sin(i * 1.4) * 0.25, 0));
      const peptide = new T.Mesh(
        new T.TubeGeometry(new T.CatmullRomCurve3(pts), 60, 0.13, 8, false),
        this.material("#ffc72c"),
      );
      g.add(peptide);
    } else if (item.kind === "tcr") {
      for (const x of [-0.65, 0.65]) {
        this.rod(g, [x, -1.7, 0], [x, 1.4, 0], 0.17, c);
        domain(g, x, 2.2, 0, 0.57, 1, 0.58);
        domain(g, x, 4.25, 0, 0.6, 1.05, 0.6);
      }
      for (const x of [-1.45, 1.45]) {
        this.rod(g, [x, -1.5, 0], [x, 0.7, 0], 0.16, s.tail);
        domain(g, x, 1.15, 0, 0.35, 0.65, 0.35, s.head);
      }
    } else if (item.kind === "pd1" || item.kind === "pdl1") {
      this.rod(g, [0, -1.6, 0], [0, 1.3, 0], 0.16, c);
      domain(g, 0, 2.2, 0, 0.65, 1.1, 0.6);
      if (item.kind === "pdl1") domain(g, 0, 4.1, 0, 0.6, 1, 0.55);
    } else if (item.kind === "structure") this.structure(g, item, p);
    else if (item.kind === "svg3d") {
      const key =
        item.url + "|" + item.representation + "|" + (item.volumeDepth || 1);
      if (!this.volumeAssets.has(key)) {
        this.onStatus?.("3D-volume opbouwen: " + item.name);
        const promise = fetch(item.url)
          .then((r) => r.text())
          .then((text) =>
            buildBasisVolume(text, {
              mode: item.representation === "relief" ? "relief" : "volume",
              depthScale: item.volumeDepth || 1,
            }),
          );
        this.volumeAssets.set(key, promise);
        promise.catch(() => this.volumeAssets.delete(key));
      }
      this.volumeAssets
        .get(key)
        .then((asset) => {
          if (this.groups.get(item.id) !== g) return;
          const model = asset.clone(true);
          model.traverse((o) => {
            if (o.isMesh) {
              o.userData.sharedGeometry = true;
              o.material = o.material.clone();
              if (o.material.color && !o.material.map)
                o.material.color.set(
                  item.color ||
                    recolorSourceColor(
                      "#" + o.material.color.getHexString(),
                      p.style,
                    ),
                );
            }
          });
          g.add(model);
          model.traverse((o) => {
            if (o.userData.isLabel) o.visible = p.labelsVisible !== false;
          });
          g.userData.volumeInfo = asset.userData;
          this.onAssetReady?.(item.id, asset.userData);
          this.onStatus?.(
            `${item.name}: ${asset.userData.shapeCount} ruimtelijke vormen`,
          );
        })
        .catch((error) => this.onError?.("3D-omzetting: " + error.message));
    } else if (item.kind === "svg") {
      const key = sourceImageURL(item.url, p.labelsVisible !== false);
      if (this.textures.has(key)) {
        this.addPlane(g, this.textures.get(key), item);
      } else {
        new T.TextureLoader().load(
          key,
          (tex) => {
            tex.colorSpace = T.SRGBColorSpace;
            this.textures.set(key, tex);
            if (this.groups.get(item.id) === g) this.addPlane(g, tex, item);
          },
          undefined,
          () => this.onError?.("SVG kon niet worden geladen."),
        );
      }
    } else if (item.kind === "glb") {
      if (this.glbs.has(item.url))
        this.addGLB(g, this.glbs.get(item.url), item, p);
      else
        new GLTFLoader().load(
          item.url,
          (data) => {
            const model = data.scene;
            const box = new T.Box3().setFromObject(model),
              size = box.getSize(v()),
              center = box.getCenter(v());
            model.position.sub(center);
            const norm = new T.Group();
            norm.add(model);
            norm.scale.setScalar(5 / Math.max(size.x, size.y, size.z));
            this.glbs.set(item.url, norm);
            if (this.groups.get(item.id) === g) this.addGLB(g, norm, item, p);
          },
          undefined,
          () => this.onError?.("GLB laden mislukt."),
        );
    } else if (item.kind === "arrow") {
      const dir = v(item.dx || 4, item.dy || 2, 0);
      g.add(
        new T.ArrowHelper(
          dir.clone().normalize(),
          v(),
          dir.length(),
          c,
          0.65,
          0.4,
        ),
      );
    }
    if (
      item.representation === "surface" &&
      !["structure", "svg", "svg3d", "glb", "arrow", "channel"].includes(
        item.kind,
      )
    ) {
      /* Explicit schematic lobulated variant, not a PDB-derived surface. */ const meshes =
        [];
      g.traverse((m) => {
        if (m.isMesh) meshes.push(m);
      });
      for (const mesh of meshes) {
        if (mesh.geometry !== sphere) continue;
        for (let k = 0; k < 14; k++) {
          const z = 1 - (2 * (k + 0.5)) / 14,
            phi = k * 2.39996,
            rr = Math.sqrt(1 - z * z);
          const bump = new T.Mesh(sphere, mesh.material);
          bump.position.set(
            Math.cos(phi) * rr * 0.85,
            z * 0.85,
            Math.sin(phi) * rr * 0.85,
          );
          bump.scale.setScalar(0.24);
          mesh.add(bump);
        }
      }
    }
    if (item.label && !["svg", "svg3d"].includes(item.kind)) {
      const sprite = this.label(item.name, s.label);
      sprite.position.set(
        0,
        item.kind === "label"
          ? 0
          : item.kind === "igg"
            ? 8.5
            : item.kind === "channel"
              ? 3
              : 6.1,
        0,
      );
      g.add(sprite);
    }
    this.pose(g, item, p);
    g.traverse((o) => {
      if (o.userData.isLabel) o.visible = p.labelsVisible !== false;
    });
  }
  addGLB(g, source, item, p) {
    const model = source.clone(true);
    model.traverse((o) => {
      if (o.material) {
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        const styled = materials.map((m) => {
          const c = m.clone();
          if (item.color && c.color) c.color.set(item.color);
          return c;
        });
        o.material = Array.isArray(o.material) ? styled : styled[0];
      }
    });
    g.add(model);
  }
  addPlane(g, tex, item) {
    const image = tex.image,
      aspect = (image.width || 1) / (image.height || 1);
    const m = new T.Mesh(
      new T.PlaneGeometry(7 * aspect, 7),
      new T.MeshBasicMaterial({
        map: tex,
        transparent: true,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    g.add(m);
  }
  structure(g, item, p) {
    const atoms = item.atoms || [],
      colors = ["#2167ae", "#ff5a36", "#93c94d", "#a890d3", "#ffc72c"];
    const chains = [...new Set(atoms.map((a) => a.chain))];
    if (item.representation === "backbone") {
      for (const chain of chains) {
        let points = [],
          last = null;
        const flush = () => {
          if (points.length > 1)
            g.add(
              new T.Mesh(
                new T.TubeGeometry(
                  new T.CatmullRomCurve3(points),
                  Math.min(points.length * 3, 2500),
                  0.09,
                  6,
                  false,
                ),
                this.material(colors[chains.indexOf(chain) % colors.length]),
              ),
            );
          points = [];
        };
        for (const a of atoms.filter(
          (a) => a.chain === chain && (a.name === "CA" || a.name === "P"),
        )) {
          const pos = v(a.x, a.y, a.z);
          if (last && pos.distanceTo(last) > 0.65) flush();
          points.push(pos);
          last = pos;
        }
        flush();
      }
    } else {
      const mesh = new T.InstancedMesh(
        sphere,
        this.material("#ffffff"),
        atoms.length,
      );
      atoms.forEach((a, i) => {
        const r =
          { C: 0.17, N: 0.155, O: 0.152, S: 0.18, P: 0.18, H: 0.12 }[
            a.element
          ] || 0.17;
        dummy.position.set(a.x, a.y, a.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(r);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(
          i,
          new T.Color(
            item.color || colors[chains.indexOf(a.chain) % colors.length],
          ),
        );
      });
      g.add(mesh);
    }
  }
  label(text, color) {
    const c = document.createElement("canvas");
    const measure = c.getContext("2d");
    measure.font = "60px Calibri, Arial";
    c.width = Math.min(
      1400,
      Math.max(128, Math.ceil(measure.measureText(text).width + 40)),
    );
    c.height = 100;
    const ctx = c.getContext("2d");
    ctx.font = "60px Calibri, Arial";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText(text, c.width / 2, 70, c.width - 30);
    const tex = new T.CanvasTexture(c);
    const sprite = new T.Sprite(
      new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
    );
    sprite.scale.set((c.width / 100) * 1.1, 1.1, 1);
    sprite.renderOrder = 10;
    sprite.userData.labelTexture = tex;
    sprite.userData.isLabel = true;
    return sprite;
  }
  pose(g, item, p) {
    if (item.anchored) {
      const f = frame(p, item, this.table);
      g.position.fromArray(f.position);
      g.rotation.set(0, item.rotation, f.angle);
    } else {
      g.position.set(item.x, item.y, effectiveDepth(p, item));
      g.rotation.set(item.rotationX || 0, item.rotationY || 0, item.rotation);
    }
    g.scale.setScalar(item.scale);
    g.visible = item.visible;
  }
  poseArm(arm, item) {
    const side = arm.userData.side,
      chosen = (item.domain || "right") === (side < 0 ? "left" : "right");
    const angle = chosen ? T.MathUtils.degToRad(item.hinge) : 0;
    const pivot = chosen ? v(...(item.pivot || [0, 4.2, 0])) : v(0, 4.2, 0);
    arm.position.copy(pivot);
    arm.rotation.z = angle;
    const content = arm.children[0];
    if (content) {
      content.position.copy(v(0, 4.2, 0).sub(pivot));
      content.rotation.z = side * 0.62;
    }
  }
  updateFrame(p) {
    this.project = p;
    for (const item of p.items) {
      const g = this.groups.get(item.id);
      if (!g) continue;
      this.pose(g, item, p);
      if (item.kind === "igg")
        g.children
          .filter((c) => c.userData.domain)
          .forEach((arm) => this.poseArm(arm, item));
    }
    this.setCamera(p.camera);
  }
  applyAnimation(p) {
    const signature = (doc) =>
      JSON.stringify(
        doc.items
          .filter((i) => i.kind === "channel")
          .map((i) => [i.id, i.s, effectiveDepth(doc, i), i.scale, i.visible]),
      );
    if (signature(p) !== signature(this.project)) {
      this.membraneGroup.traverse((o) => {
        if (o.geometry && o.geometry !== sphere && o.geometry !== cylinder)
          o.geometry.dispose();
        o.material?.dispose();
      });
      this.membraneGroup.removeFromParent();
      this.membrane(p);
    }
    this.updateFrame(p);
  }
  updateHandles() {
    if (!this.project) return;
    this.handles?.traverse((o) => {
      if (o.geometry && o.geometry !== sphere) o.geometry.dispose();
      o.material?.dispose();
    });
    this.handles?.removeFromParent();
    this.handles = new T.Group();
    this.root.add(this.handles);
    if (this.mode !== "curve") return;
    this.project.curve.forEach((p, i) => {
      const m = new T.Mesh(
        sphere,
        new T.MeshBasicMaterial({
          color: i % 3 === 0 ? 0x007a80 : 0xff9a5e,
          depthTest: false,
        }),
      );
      m.position.set(p[0], p[1], 0);
      m.scale.setScalar(0.34);
      m.userData.handle = i;
      m.renderOrder = 20;
      this.handles.add(m);
    });
    const points = this.project.curve.map((p) => v(...p, 0));
    const geo = new T.BufferGeometry().setFromPoints(points);
    this.handles.add(
      new T.Line(
        geo,
        new T.LineBasicMaterial({ color: 0x008e93, depthTest: false }),
      ),
    );
    this.handles.add(
      new T.Line(
        new T.BufferGeometry().setFromPoints(
          Array.from({ length: 201 }, (_, i) =>
            v(...bezier(this.project.curve, i / 200), 0),
          ),
        ),
        new T.LineBasicMaterial({ color: 0x008e93, depthTest: false }),
      ),
    );
  }
  intersect(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.camera);
  }
  bind() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("dblclick", (e) => {
      if (this.mode !== "curve") return;
      this.intersect(e);
      const point = this.ray.ray.intersectPlane(
        new T.Plane(v(0, 0, 1), 0),
        v(),
      );
      if (point)
        this.onAddCurve?.(
          closestCurveT(this.project.curve, [point.x, point.y]),
        );
    });
    let down = null,
      drag = null;
    canvas.addEventListener("pointerdown", (e) => {
      down = [e.clientX, e.clientY];
      if (this.mode !== "curve") return;
      this.intersect(e);
      const hit = this.ray
        .intersectObjects(this.handles.children)
        .find((h) => h.object.userData.handle !== undefined);
      if (hit) {
        drag = hit.object.userData.handle;
        this.controls.enabled = false;
        canvas.setPointerCapture(e.pointerId);
        this.onCurve?.(null, "start");
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (drag === null) return;
      this.intersect(e);
      const p = this.ray.ray.intersectPlane(new T.Plane(v(0, 0, 1), 0), v());
      if (p) this.onCurve?.([drag, p.x, p.y], "move");
    });
    canvas.addEventListener("pointerup", (e) => {
      if (drag !== null) {
        drag = null;
        this.controls.enabled = true;
        this.onCurve?.(null, "end");
        return;
      }
      if (this.skipPick) {
        this.skipPick = false;
        return;
      }
      if (
        !down ||
        Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5 ||
        this.gizmo.dragging
      )
        return;
      if (this.mode === "curve") return;
      this.intersect(e);
      const hits = this.ray.intersectObjects([...this.groups.values()], true);
      for (const h of hits) {
        let o = h.object;
        while (o && !o.userData.id) o = o.parent;
        if (o) {
          this.onSelect(
            o.userData.id,
            this.mode === "hinge"
              ? this.groups
                  .get(o.userData.id)
                  .worldToLocal(h.point.clone())
                  .toArray()
              : null,
          );
          break;
        }
      }
    });
  }
  animate() {
    this.animation = requestAnimationFrame(() => this.animate());
    if (!this.suspended) this.render();
  }
  updateClipping() {
    if (this.project) {
      const normal = this.camera.position
        .clone()
        .sub(this.controls.target)
        .normalize();
      this.clip.setFromNormalAndCoplanarPoint(
        normal.clone().negate(),
        this.controls.target,
      );
      this.membraneGroup.traverse((o) => {
        if (o.material && o.material.clippingPlanes)
          o.material.clippingPlanes = this.project.cut ? [this.clip] : [];
      });
      for (const i of this.project.items.filter((i) => i.kind === "channel"))
        this.groups.get(i.id)?.traverse((o) => {
          if (o.material?.clippingPlanes)
            o.material.clippingPlanes = this.project.cut ? [this.clip] : [];
        });
      if (this.cap) {
        const n = normal;
        const usable = this.project.cut && Math.abs(n.z) > 0.15;
        this.cap.visible = usable;
        const key = [
          ...n.toArray(),
          ...this.controls.target.toArray(),
          this.project.depth,
          this.project.thickness,
        ].join("|");
        if (usable && this.cap.userData.cutKey !== key) {
          this.cap.geometry.dispose();
          this.cap.geometry = membraneCutGeometry(
            this.project,
            this.table,
            n,
            this.controls.target,
            this.pores,
          );
          this.cap.userData.cutKey = key;
        }
      }
      this.outline?.update();
    }
  }
  render() {
    this.updateClipping();
    this.renderer.render(this.scene, this.camera);
  }
  async waitForAssets() {
    const tasks = this.project.items
      .filter((i) => i.kind === "svg3d")
      .map((i) =>
        this.volumeAssets.get(
          i.url + "|" + i.representation + "|" + (i.volumeDepth || 1),
        ),
      )
      .filter(Boolean);
    await Promise.all(tasks);
  }
  dispose() {
    cancelAnimationFrame(this.animation);
    this.resize.disconnect();
    this.controls.dispose();
    this.gizmo.dispose();
    this.clear();
    for (const tex of this.textures.values()) tex.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function sourceImageURL(url, labels) {
  if (labels || !url?.startsWith("data:image/svg+xml;base64,")) return url;
  try {
    const bytes = Uint8Array.from(atob(url.split(",")[1]), (c) =>
        c.charCodeAt(0),
      ),
      text = new TextDecoder().decode(bytes),
      doc = new DOMParser().parseFromString(text, "image/svg+xml");
    for (const n of doc.querySelectorAll("text,tspan")) n.remove();
    return (
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        new XMLSerializer().serializeToString(doc.documentElement),
      )
    );
  } catch {
    return url;
  }
}
