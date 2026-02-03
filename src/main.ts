import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
import { html } from "lit";
import * as TEMPLATES from "./ui-templates";
import { appIcons, CONTENT_GRID_ID } from "./globals";
import { setupFinders } from "./setup/finders";
import { setupViewTemplates } from "./setup/templaters";

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
world.camera.threePersp.near = 0.01;
world.camera.threePersp.updateProjectionMatrix();
world.camera.controls.restThreshold = 0.05;

const worldGrid = components.get(OBC.Grids).create(world);
worldGrid.material.uniforms.uColor.value = new THREE.Color(0x494b50);
worldGrid.material.uniforms.uSize1.value = 2;
worldGrid.material.uniforms.uSize2.value = 10;

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
postproduction.style = OBF.PostproductionAspect.COLOR_SHADOWS;

const { aoPass, edgesPass } = world.renderer.postproduction;

edgesPass.enabled = true;
edgesPass.color = new THREE.Color(0x494b50);

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
});

// ✅Highlighter Setup
const highlighter = components.get(OBF.Highlighter);
highlighter.setup({
  world,
  selectMaterialDefinition: {
    color: new THREE.Color("#bcf124"),
    renderedFaces: 1,
    opacity: 1,
    transparent: false,
  },
});

// 🖱️Hoverer Setup
const hoverer = components.get(OBF.Hoverer);
hoverer.world = world;
hoverer.enabled = true;
hoverer.material = new THREE.MeshBasicMaterial({
  color: new THREE.Color("#bcf124"),
  transparent: true,
  opacity: 0.2,
  depthTest: false,
});

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

// 🚚Model Load EventHandler
fragments.list.onItemSet.add(async ({ value: model }) => {
  model.useCamera(world.camera.three);
  model.getClippingPlanesEvent = () => {
    return Array.from(world.renderer!.three.clippingPlanes) || [];
  };
  world.scene.three.add(model.object);
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
  FullScreen: appIcons.FULLSCREEN,
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
