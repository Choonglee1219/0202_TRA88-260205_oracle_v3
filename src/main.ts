import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
import { html } from "lit";
import * as TEMPLATES from "./ui-templates";
import { appIcons, CONTENT_GRID_ID } from "./globals";
import { setupFinders } from "./setup/finders";
import { setupViewTemplates } from "./setup/templaters";
import { ViewCube } from "./ui-components/ViewCube";
import { Highlighter } from "./bim-components/Highlighter";
import { setupContextMenu } from "./ui-components/ContextMenu";

// 🎨Override the bim-label template to use a local SVG icon and apply custom colors
// @ts-ignore
BUI.Label.prototype.render = function () {
  const isSvgIcon = this.icon?.includes(".svg");
  const iconTemplate = isSvgIcon
    ? html`<div
          style="
            background-color: var(--bim-label--c, var(--bim-ui_main-base));
            -webkit-mask-image: url(${this.icon});
            mask-image: url(${this.icon});
            -webkit-mask-repeat: no-repeat;
            mask-repeat: no-repeat;
            -webkit-mask-size: 100% 100%;
            mask-size: 100% 100%;
            width: var(--bim-icon--fz, var(--bim-ui_size-sm));
            height: var(--bim-icon--fz, var(--bim-ui_size-sm));
          "
        ></div>`
    : BUI.html`<bim-icon .icon=${this.icon}></bim-icon>`;
  return html`<div class="parent" title=${this.textContent}>
    ${this.img ? html`<img src=${this.img} alt=${this.textContent || ""} />` : ""}
    ${!this.iconHidden && this.icon ? iconTemplate : ""}
    <p><slot></slot></p>
  </div>`;
};

// 🛫Interface Initialization
BUI.Manager.init();

// 🌐Components Setup
const components = new OBC.Components();

// 🌐Worlds Setup and Configuration
const worlds = components.get(OBC.Worlds);

const world = worlds.create<
  OBC.SimpleScene,
  OBC.OrthoPerspectiveCamera,
  OBF.PostproductionRenderer
>();

world.name = "Main";
world.scene = new OBC.SimpleScene(components);
world.scene.setup();
world.scene.three.background = null;

const viewport = BUI.Component.create<BUI.Viewport>(() => {
  return BUI.html`<bim-viewport></bim-viewport>`;
});

world.renderer = new OBF.PostproductionRenderer(components, viewport);
world.camera = new OBC.OrthoPerspectiveCamera(components);
world.camera.threePersp.near = 0.5;
world.camera.threePersp.far = 100000;
world.camera.threePersp.updateProjectionMatrix();
world.camera.controls.restThreshold = 0.05;

// --- 카메라 마우스 조작법 변경 ---
// Action 상수 (0: NONE, 1: ROTATE, 2: TRUCK(Pan), 4: SCREEN_PAN, 8: OFFSET, 16: DOLLY, 32: ZOOM)

world.camera.controls.mouseButtons.left = 0;
world.camera.controls.mouseButtons.middle = 2;
world.camera.controls.mouseButtons.right = 0;

window.addEventListener("keydown", (event) => {
  if (event.key === "Shift") {
    world.camera.controls.mouseButtons.middle = 1; // Shift + Middle = ROTATE
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "Shift") {
    world.camera.controls.mouseButtons.middle = 2; // Middle = TRUCK(Pan)
  }
});

// ---------------------------------

// 🧊 ViewCube Setup
if (!customElements.get("bim-view-cube")) {
  customElements.define("bim-view-cube", ViewCube);
}

const viewCube = document.createElement("bim-view-cube") as ViewCube;
viewCube.camera = world.camera.three;
viewCube.rightText = "Right";
viewCube.leftText = "Left";
viewCube.topText = "Top";
viewCube.bottomText = "Bottom";
viewCube.frontText = "Front";
viewCube.backText = "Back";

viewport.append(viewCube);

world.camera.controls.addEventListener("update", () => {
  viewCube.updateOrientation();
});

world.camera.projection.onChanged.add(() => {
  viewCube.camera = world.camera.three;
  viewCube.updateOrientation();
});

viewCube.addEventListener("frontclick", () => {
  world.camera.controls.rotateTo(0, Math.PI / 2, true);
});
viewCube.addEventListener("backclick", () => {
  world.camera.controls.rotateTo(Math.PI, Math.PI / 2, true);
});
viewCube.addEventListener("rightclick", () => {
  world.camera.controls.rotateTo(Math.PI / 2, Math.PI / 2, true);
});
viewCube.addEventListener("leftclick", () => {
  world.camera.controls.rotateTo(-Math.PI / 2, Math.PI / 2, true);
});
viewCube.addEventListener("topclick", () => {
  world.camera.controls.rotateTo(0, 0, true);
});
viewCube.addEventListener("bottomclick", () => {
  world.camera.controls.rotateTo(0, Math.PI, true);
});

const worldGrid = components.get(OBC.Grids).create(world);
worldGrid.material.uniforms.uColor.value = new THREE.Color(0x494b50);
worldGrid.material.uniforms.uSize1.value = 2;
worldGrid.material.uniforms.uSize2.value = 10;
worldGrid.visible = false;
worldGrid.three.position.y = -20;

const resizeWorld = () => {
  world.renderer?.resize();
  world.camera.updateAspect();
};

viewport.addEventListener("resize", resizeWorld);

world.dynamicAnchor = false;

components.init();

components.get(OBC.Raycasters).get(world);

// 🖼️Post-production Setup
const { postproduction } = world.renderer;
postproduction.enabled = true;
postproduction.style = OBF.PostproductionAspect.COLOR_PEN_SHADOWS;

const { aoPass, edgesPass } = world.renderer.postproduction;

edgesPass.enabled = true;
edgesPass.color = new THREE.Color(0x494b50);
edgesPass.width = 1;

const aoParameters = {
  radius: 0.25,
  distanceExponent: 1,
  thickness: 0.1,
  scale: 1,
  samples: 16,
  distanceFallOff: 1,
  screenSpaceRadius: true,
};

const pdParameters = {
  lumaPhi: 10,
  depthPhi: 2,
  normalPhi: 3,
  radius: 4,
  radiusExponent: 1,
  rings: 2,
  samples: 16,
};

aoPass.updateGtaoMaterial(aoParameters);
aoPass.updatePdMaterial(pdParameters);

// 🧩FragmentsManager Setup
const fragments = components.get(OBC.FragmentsManager);
fragments.init("/node_modules/@thatopen/fragments/dist/Worker/worker.mjs");

fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
  const isLod = "isLodMaterial" in material && material.isLodMaterial;
  if (isLod) {
    world.renderer!.postproduction.basePass.isolatedMaterials.push(material);
  }
  material.polygonOffset = true;
  material.polygonOffsetUnits = 4;
  material.polygonOffsetFactor = 2;
  // This logic is to apply a default transparency to the base model materials.
  // We must avoid overriding materials created by the Highlighter.
  const isHighlighterMaterial = !!material.userData.customId;
  if (!isHighlighterMaterial) {
    material.transparent = true;
    material.opacity = 0.5;
  }
});

// 📷Camera EventHandler
world.camera.projection.onChanged.add(() => {
  for (const [_, model] of fragments.list) {
    world.renderer!.postproduction.basePass.camera = world.camera.three;
    world.renderer!.postproduction.aoPass.camera = world.camera.three;
    model.useCamera(world.camera.three);
  }
});

world.camera.controls.addEventListener("rest", () => {
  fragments.core.update(true);
});

// 🚚IfcLoader Setup
const ifcLoader = components.get(OBC.IfcLoader);
await ifcLoader.setup({
  autoSetWasm: false,
  wasm: {
    absolute: true,
    path: "/node_modules/web-ifc/",
  },
  webIfc: {
    COORDINATE_TO_ORIGIN: false,  // 좌표 원점 조정 해제
  },
});

// ✅Highlighter Setup
const highlighter = new Highlighter(components);

highlighter.setup({
  world,
  selectMaterialDefinition: {
    color: new THREE.Color("#8fbc0c"),
    renderedFaces: 1,
    opacity: 0.3,
    transparent: true,
  },
});

// 🎨 Custom highlighter style for Spatial Entities
highlighter.styles.set("transparentCyan", {
  color: new THREE.Color("#00ffff"),
  renderedFaces: 1,
  opacity: 0.02,
  transparent: true,
});

const originalUpdateColors = highlighter.updateColors.bind(highlighter);
highlighter.updateColors = async () => {
  const hasSelection = !OBC.ModelIdMapUtils.isEmpty(highlighter.selection.select);
  if (hasSelection) {
    // 객체를 선택할 때: 외곽선을 해제 -> 색상 변경
    world.renderer!.postproduction.edgesPass.enabled = false;
    await originalUpdateColors();
  } else {
    // 객체를 해제할 때: 색상 복원 -> 외곽선 복원
    await originalUpdateColors();
    world.renderer!.postproduction.edgesPass.enabled = true;
  }
};

// // 🖱️Hoverer Setup
// const hoverer = components.get(OBF.Hoverer);
// hoverer.world = world;
// hoverer.enabled = true;
// hoverer.material = new THREE.MeshBasicMaterial({
//   color: new THREE.Color("#8fbc0c"),
//   polygonOffset: true,
//   polygonOffsetUnits: 4,
//   polygonOffsetFactor: 2,
//   transparent: true,
//   opacity: 0.2,
// });

// ✂️Clipper Setup
const clipper = components.get(OBC.Clipper);
viewport.ondblclick = () => {
  if (clipper.enabled) clipper.create(world);
};

window.addEventListener("keydown", (event) => {
  if (event.code === "Delete" || event.code === "Backspace") {
    clipper.delete(world);
  }
});

// 📐Length Measurement Setup
const lengthMeasurer = components.get(OBF.LengthMeasurement);
lengthMeasurer.world = world;
lengthMeasurer.color = new THREE.Color("#6528d7");

lengthMeasurer.list.onItemAdded.add((line) => {
  const center = new THREE.Vector3();
  line.getCenter(center);
  const radius = line.distance() / 3;
  const sphere = new THREE.Sphere(center, radius);
  world.camera.controls.fitToSphere(sphere, true);
});

viewport.addEventListener("dblclick", () => {
  lengthMeasurer.create();
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Delete" || event.code === "Backspace") {
    lengthMeasurer.delete();
  }
});

// 📐Area Measurement Setup
const areaMeasurer = components.get(OBF.AreaMeasurement);
areaMeasurer.world = world;
areaMeasurer.color = new THREE.Color("#6528d7");

areaMeasurer.list.onItemAdded.add((area) => {
  if (!area.boundingBox) return;
  const sphere = new THREE.Sphere();
  area.boundingBox.getBoundingSphere(sphere);
  world.camera.controls.fitToSphere(sphere, true);
});

viewport.addEventListener("dblclick", () => {
  areaMeasurer.create();
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Enter" || event.code === "NumpadEnter") {
    areaMeasurer.endCreation();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Delete" || event.code === "Backspace") {
    areaMeasurer.delete();
  }
});

// 📦 Ctrl + Drag: Box Selection
let selectionStart: THREE.Vector2 | null = null;
let selectionBox: HTMLDivElement | null = null;

const onPointerDown = (event: PointerEvent) => {
  // Ctrl + 좌클릭 조합일 때만 작동하도록 설정
  if (event.button !== 0 || !event.ctrlKey) return;

  const rect = viewport.getBoundingClientRect();
  selectionStart = new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top);

  selectionBox = document.createElement("div");
  selectionBox.style.position = "absolute";
  selectionBox.style.border = "1px solid rgba(143, 188, 12, 0.8)";
  selectionBox.style.backgroundColor = "rgba(143, 188, 12, 0.2)";
  selectionBox.style.pointerEvents = "none";
  selectionBox.style.zIndex = "999";
  selectionBox.style.left = `${selectionStart.x}px`;
  selectionBox.style.top = `${selectionStart.y}px`;
  selectionBox.style.width = "0px";
  selectionBox.style.height = "0px";

  viewport.append(selectionBox);

  world.camera.controls.enabled = false;

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
};

const onPointerMove = (event: PointerEvent) => {
  if (!selectionStart || !selectionBox) return;

  const rect = viewport.getBoundingClientRect();
  const current = new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top);

  const minX = Math.min(selectionStart.x, current.x);
  const minY = Math.min(selectionStart.y, current.y);
  const width = Math.abs(selectionStart.x - current.x);
  const height = Math.abs(selectionStart.y - current.y);

  selectionBox.style.left = `${minX}px`;
  selectionBox.style.top = `${minY}px`;
  selectionBox.style.width = `${width}px`;
  selectionBox.style.height = `${height}px`;
};

const onPointerUp = async (event: PointerEvent) => {
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);

  world.camera.controls.enabled = true;

  if (!selectionStart || !selectionBox) {
    selectionBox?.remove();
    selectionStart = null;
    selectionBox = null;
    return;
  }

  const rect = viewport.getBoundingClientRect();
  const end = new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top);

  const topLeft = new THREE.Vector2(Math.min(selectionStart.x, end.x), Math.min(selectionStart.y, end.y));
  const bottomRight = new THREE.Vector2(Math.max(selectionStart.x, end.x), Math.max(selectionStart.y, end.y));

  selectionBox.remove();
  selectionStart = null;
  selectionBox = null;

  // 박스 크기가 너무 작으면 단순 클릭으로 간주
  if (Math.abs(bottomRight.x - topLeft.x) < 5 && Math.abs(bottomRight.y - topLeft.y) < 5) {
    return;
  }

  const raycastTopLeft = new THREE.Vector2(topLeft.x + rect.left, topLeft.y + rect.top);
  const raycastBottomRight = new THREE.Vector2(bottomRight.x + rect.left, bottomRight.y + rect.top);

  const modelIdMap: OBC.ModelIdMap = {};

  for (const [, model] of fragments.list) {
    if (!model.object.visible) continue;

    const res = await (model as any).rectangleRaycast({
      camera: world.camera.three,
      dom: world.renderer!.three.domElement,
      topLeft: raycastTopLeft,
      bottomRight: raycastBottomRight,
      fullyIncluded: true,
    });

    if (res && res.localIds.length) {
      modelIdMap[model.modelId] = new Set(res.localIds);
    }
  }

  if (Object.keys(modelIdMap).length > 0) {
    await highlighter.highlightByID(
      highlighter.config.selectName,
      modelIdMap,
      true,
      false
    );
  } else {
    await highlighter.clear(highlighter.config.selectName);
  }
};

viewport.addEventListener("pointerdown", onPointerDown);

// 📌 Context Menu Setup
setupContextMenu(components, world, viewport);

// 🚚Model Load EventHandler
fragments.list.onItemSet.add(async ({ value: model }) => {
  const finder = components.get(OBC.ItemsFinder);
  for (const [_, query] of finder.list) {
    query.clearCache();
  }

  model.useCamera(world.camera.three);
  model.getClippingPlanesEvent = () => {
    return Array.from(world.renderer!.three.clippingPlanes) || [];
  };
  world.scene.three.add(model.object);
  await fragments.core.update(true);

  const classifier = components.get(OBC.Classifier);
  const hider = components.get(OBC.Hider);
  const categoryNames = ["IFCSPACE", "IFCSPATIALZONE", "IFCOPENINGELEMENT"];
  const categoriesRegex = categoryNames.map((cat) => new RegExp(`^${cat}$`));
  const items = await model.getItemsOfCategories(categoriesRegex);
  const localIds = Object.values(items).flat();
  const modelIdMap = { [model.modelId]: new Set(localIds) };
  classifier.addGroupItems("PermanentHidden", "HiddenItems", modelIdMap);
  
  await highlighter.highlightByID("transparentCyan", modelIdMap, false, false);
  await hider.set(false, modelIdMap);

  const boxer = components.get(OBC.BoundingBoxer);
  boxer.list.clear();
  boxer.addFromModels([new RegExp(`^${model.modelId}$`)]);
  const box = boxer.get();
  boxer.list.clear();

  if (!box.isEmpty()) {
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    world.camera.controls.fitToSphere(sphere, true);
  }
});

fragments.list.onItemDeleted.add(async () => {
  const finder = components.get(OBC.ItemsFinder);
  for (const [_, query] of finder.list) {
    query.clearCache();
  }
  await highlighter.clear("select");
  await fragments.core.update(true);
});

// 🔎Finder Setup - "src > setup > finders.ts"
setupFinders(components);

// 🔭ViewTemplater Setup - "src > setup > templaters.ts"
setupViewTemplates(components);

// 🖥️UI Layout Configuration
const [viewportSettings] = BUI.Component.create(TEMPLATES.viewportSettingsTemplate, {
  components,
  world,
});

viewport.append(viewportSettings);

const [viewportGrid] = BUI.Component.create(TEMPLATES.viewportGridTemplate, {
  components,
  world,
});

viewport.append(viewportGrid);

const viewportCardTemplate = () => BUI.html`
  <div class="dashboard-card" style="padding: 0px;">
    ${viewport}
  </div>
`;

// 🏁Content Grid Setup
const [contentGrid] = BUI.Component.create<
  BUI.Grid<TEMPLATES.ContentGridLayouts, TEMPLATES.ContentGridElements>,
  TEMPLATES.ContentGridState
>(TEMPLATES.contentGridTemplate, {
  components,
  id: CONTENT_GRID_ID,
  viewportTemplate: viewportCardTemplate,
});

const setInitialLayout = () => {
  if (window.location.hash) {
    const hash = window.location.hash.slice(
      1,
    ) as TEMPLATES.ContentGridLayouts[number];
    if (Object.keys(contentGrid.layouts).includes(hash)) {
      contentGrid.layout = hash;
    } else {
      contentGrid.layout = "Viewer";
      window.location.hash = "Viewer";
    }
  } else {
    window.location.hash = "Viewer";
    contentGrid.layout = "Viewer";
  }
};

setInitialLayout();

contentGrid.addEventListener("layoutchange", () => {
  window.location.hash = contentGrid.layout as string;
});

const contentGridIcons: Record<TEMPLATES.ContentGridLayouts[number], string> = {
  Viewer: appIcons.MODEL,
  BCFManager: appIcons.REF,
  Queries: appIcons.SEARCH,
  Properties: appIcons.EDIT,
  FullScreen: appIcons.FULL_SCREEN,
  ViewPoints: appIcons.CAMERA,
  IDSCheck: appIcons.IDS_CHECK,
  QuantityTable: appIcons.TABLE,
};

// 🏁App Grid Setup
type AppLayouts = ["App"];

type Sidebar = {
  name: "sidebar";
  state: TEMPLATES.GridSidebarState;
};

type ContentGrid = {
  name: "contentGrid";
  state: TEMPLATES.ContentGridState;
};

type AppGridElements = [Sidebar, ContentGrid];

const app = document.getElementById("app") as BUI.Grid<
  AppLayouts,
  AppGridElements
>;

app.elements = {
  sidebar: {
    template: TEMPLATES.gridSidebarTemplate,
    initialState: {
      grid: contentGrid,
      isCompact: true,
      layoutIcons: contentGridIcons,
    },
  },
  contentGrid,
};

contentGrid.addEventListener("layoutchange", () =>
  app.updateComponent.sidebar(),
);

app.layouts = {
  App: {
    template: `
      "sidebar contentGrid" 1fr
      /auto 1fr
    `,
  },
};

app.layout = "App";
