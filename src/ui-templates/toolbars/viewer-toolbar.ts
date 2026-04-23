import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as FRAGS from "@thatopen/fragments";
import { appIcons, tooltips } from "../../globals";
import { MeasurerUI } from "../../bim-components/Measurer/src";
import { Colorize } from "../../ui-components/Colorize";
import { Highlighter } from "../../bim-components/Highlighter";
import { CustomCameraControl } from "../../bim-components/CustomCameraControl";

export interface ViewerToolbarState {
  components: OBC.Components;
  world: OBC.World;
}

const originalColors = new WeakMap<
  FRAGS.BIMMaterial,
  { color: number; transparent: boolean; opacity: number; depthWrite: boolean; isColor: boolean }
>();
let isGhostModeActive = false;

export const setModelTransparent = (components: OBC.Components) => {
  if (isGhostModeActive) return;
  isGhostModeActive = true;
  const worlds = components.get(OBC.Worlds);
  for (const world of worlds.list.values()) {
    if (world.renderer instanceof OBF.PostproductionRenderer) {
      world.renderer.postproduction.edgesPass.enabled = false;
    }
  }

  const fragments = components.get(OBC.FragmentsManager);
  for (const material of fragments.core.models.materials.list.values()) {
    if (material.userData.customId) continue;
    // save colors
    let color: number | undefined;
    let isColor = false;
    if ("color" in material) {
      color = material.color.getHex();
      isColor = true;
    } else {
      color = material.lodColor.getHex();
    }

    originalColors.set(material, {
      color,
      transparent: material.transparent,
      opacity: material.opacity,
      depthWrite: material.depthWrite,
      isColor,
    });

    // set color
    material.transparent = true;
    material.needsUpdate = true;
    material.depthWrite = false;
    if (isColor && "color" in material) {
      material.opacity = 0.01;
      material.color.set("#2FA4D7");
    } else if ("lodColor" in material) {
      material.opacity = 0.001;
      material.lodColor.set("#1c5e7a");
    }
  }
};

export const restoreModelMaterials = (components: OBC.Components) => {
  const worlds = components.get(OBC.Worlds);
  for (const world of worlds.list.values()) {
    if (world.renderer instanceof OBF.PostproductionRenderer) {
      world.renderer.postproduction.edgesPass.enabled = true;
    }
  }
  
  const fragments = components.get(OBC.FragmentsManager);
  for (const material of fragments.core.models.materials.list.values()) {
    const data = originalColors.get(material);
    if (data) {
      material.transparent = data.transparent;
      material.opacity = data.opacity;
      material.depthWrite = data.depthWrite;
      if (data.isColor && "color" in material) {
        material.color.setHex(data.color);
      } else if (!data.isColor && "lodColor" in material) {
        material.lodColor.setHex(data.color);
      }
      material.needsUpdate = true;
      originalColors.delete(material);
    }
  }
  isGhostModeActive = false;
};

// Context Menu 및 다른 곳에서 재사용할 수 있도록 핸들러 로직들을 분리
let lastHiddenSelection: OBC.ModelIdMap | null = null;
let isCurrentlyHidden = false;

const areModelIdMapsEqual = (a: OBC.ModelIdMap, b: OBC.ModelIdMap | null) => {
  if (!b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    const setA = a[key];
    const setB = b[key];
    if (!setB || setA.size !== setB.size) return false;
    for (const val of setA) {
      if (!setB.has(val)) return false;
    }
  }
  return true;
};

const cloneModelIdMap = (map: OBC.ModelIdMap) => {
  const clone: OBC.ModelIdMap = {};
  for (const key in map) {
    clone[key] = new Set(map[key]);
  }
  return clone;
};

// 단축키 연동을 위한 버튼 DOM 참조 변수
let showAllBtn: BUI.Button | undefined;
let ghostBtn: BUI.Button | undefined;
let hiddenItemsBtn: BUI.Button | undefined;
let focusBtnRef: BUI.Button | undefined;
let hideBtn: BUI.Button | undefined;
let isolateBtn: BUI.Button | undefined;
let isFlyModeActive = false; // Fly Mode 상태를 추적하기 위한 변수

if (!(window as any)._toolbarHotkeyRegistered) {
  (window as any)._toolbarHotkeyRegistered = true;
  window.addEventListener("keydown", (e) => {
    if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
    const key = e.key.toLowerCase();

    // Fly Mode가 켜져 있을 때는 이동 키(W, A, S, D)가 단축키로 작동하지 않도록 방지
    if (isFlyModeActive && ['w', 'a', 's', 'd'].includes(key)) {
      return;
    }

    if (key === 'a') showAllBtn?.click();
    if (key === 'g') ghostBtn?.click();
    if (key === 's') hiddenItemsBtn?.click();
    if (key === 'f') focusBtnRef?.click();
    if (key === 'h') hideBtn?.click();
    if (key === 'i') isolateBtn?.click();
  });
}

export const showAllItems = async (components: OBC.Components) => {
  const hider = components.get(OBC.Hider);
  await hider.set(true);
  const classifier = components.get(OBC.Classifier);
  const hiddenItemsGroup = classifier.list.get("PermanentHidden")?.get("HiddenItems");
  if (hiddenItemsGroup) {
    const hiddenItems = await hiddenItemsGroup.get();
    if (!OBC.ModelIdMapUtils.isEmpty(hiddenItems)) {
      await hider.set(false, hiddenItems);
    }
  }
  isCurrentlyHidden = false;
  lastHiddenSelection = null;
};

export const toggleGhostMode = (components: OBC.Components) => {
  if (isGhostModeActive) {
    restoreModelMaterials(components);
  } else {
    setModelTransparent(components);
  }
  lastHiddenSelection = null;
  isCurrentlyHidden = false;
};

export const hideSelection = async (components: OBC.Components) => {
  const highlighter = components.get(Highlighter);
  const hider = components.get(OBC.Hider);
  const selection = highlighter.selection.select;
  if (OBC.ModelIdMapUtils.isEmpty(selection)) return;

  if (areModelIdMapsEqual(selection, lastHiddenSelection) && isCurrentlyHidden) {
    await hider.set(true, selection); // 이미 숨긴 상태에서 또 누르면 다시 표시
    isCurrentlyHidden = false;
    lastHiddenSelection = null;
  } else {
    await hider.set(false, selection); // 처음 숨기는 경우
    isCurrentlyHidden = true;
    lastHiddenSelection = cloneModelIdMap(selection);
  }
};

export const isolateSelection = async (components: OBC.Components) => {
  const highlighter = components.get(Highlighter);
  const hider = components.get(OBC.Hider);
  const selection = highlighter.selection.select;
  if (OBC.ModelIdMapUtils.isEmpty(selection)) return;
  await hider.isolate(selection);
};

export const viewerToolbarTemplate: BUI.StatefullComponent<
ViewerToolbarState
> = (state) => {
  const { components, world } = state;
  
  const highlighter = components.get(Highlighter);
  const hider = components.get(OBC.Hider);
  
  const onShowAll = async ({ target }: { target: BUI.Button }) => {
    target.loading = true;
    await showAllItems(components);
    if (hiddenItemsBtn) hiddenItemsBtn.active = false;
    if (hideBtn) hideBtn.active = false;
    target.loading = false;
  };

  const onToggleGhost = () => {
    toggleGhostMode(components);
    if (ghostBtn) ghostBtn.active = isGhostModeActive;
    if (hideBtn) hideBtn.active = isCurrentlyHidden; // 고스트 모드가 켜지면 Hide 상태가 초기화되므로 동기화
  };

  const onToggleHidden = async ({ target }: { target: BUI.Button }) => {
    const classifier = components.get(OBC.Classifier);
    const hiddenItemsGroup = classifier.list.get("PermanentHidden")?.get("HiddenItems");
    if (!hiddenItemsGroup) return;
    const hiddenItems = await hiddenItemsGroup.get();
    if (OBC.ModelIdMapUtils.isEmpty(hiddenItems)) return;

    target.loading = true;
    const show = !target.active;
    await hider.set(show, hiddenItems);
    target.active = show;
    target.loading = false;
  };

  let focusBtn: BUI.TemplateResult | undefined;
  if (world.camera instanceof OBC.SimpleCamera) {
    const onFocus = async ({ target }: { target: BUI.Button }) => {
      if (!(world.camera instanceof OBC.SimpleCamera)) return;
      const selection = highlighter.selection.select;
      target.loading = true;
      await world.camera.fitToItems(
        OBC.ModelIdMapUtils.isEmpty(selection) ? undefined : selection,
      );
      target.loading = false;
    };

    focusBtn = BUI.html`<bim-button ${BUI.ref((e) => { focusBtnRef = e as BUI.Button; })} tooltip-title=${tooltips.FOCUS.TITLE} tooltip-text=${tooltips.FOCUS.TEXT} icon=${appIcons.FOCUS} label="Focus" @click=${onFocus}></bim-button>`;
  }

  const onHide = async ({ target }: { target: BUI.Button }) => {
    target.loading = true;
    await hideSelection(components);
    if (hideBtn) hideBtn.active = isCurrentlyHidden;
    target.loading = false;
  };

  const onIsolate = async ({ target }: { target: BUI.Button }) => {
    target.loading = true;
    await isolateSelection(components);
    target.loading = false;
  };

  const customCameraControl = components.get(CustomCameraControl as any) as CustomCameraControl;
  isFlyModeActive = customCameraControl.flyMode.isFlyMode;

  const onToggleFlyMode = () => {
    customCameraControl.flyMode.toggle();
  };

  const setupFlyModeBtn = (e?: Element) => {
    if (!e) return;
    const btn = e as BUI.Button;
    btn.active = customCameraControl.flyMode.isFlyMode;
    if ((btn as any)._flyModeListener) {
      customCameraControl.flyMode.onToggle.remove((btn as any)._flyModeListener);
    }
    (btn as any)._flyModeListener = (isFlyMode: boolean) => { 
      btn.active = isFlyMode; 
      isFlyModeActive = isFlyMode; // Fly Mode 상태 동기화
    };
    customCameraControl.flyMode.onToggle.add((btn as any)._flyModeListener);
  };

  return BUI.html`
    <bim-toolbar>
      <bim-toolbar-section label="Visibility" icon=${appIcons.SHOW}>
        <bim-button ${BUI.ref((e) => { showAllBtn = e as BUI.Button; })} tooltip-title=${tooltips.SHOW_ALL.TITLE} tooltip-text=${tooltips.SHOW_ALL.TEXT} icon=${appIcons.SHOW} label="Show All" @click=${onShowAll}></bim-button> 
        <bim-button ${BUI.ref((e) => { ghostBtn = e as BUI.Button; if(ghostBtn) ghostBtn.active = isGhostModeActive; })} tooltip-title=${tooltips.GHOST.TITLE} tooltip-text=${tooltips.GHOST.TEXT} icon=${appIcons.TRANSPARENT} label="Ghost" @click=${onToggleGhost}></bim-button>
        <bim-button ${BUI.ref((e) => { hiddenItemsBtn = e as BUI.Button; })} tooltip-title="Toggle Hidden Items (S)" icon=${appIcons.MODEL} label="Space" @click=${onToggleHidden}></bim-button>
      </bim-toolbar-section> 
      <bim-toolbar-section label="Selection" icon=${appIcons.SELECT}>
        ${focusBtn}
        <bim-button ${BUI.ref((e) => { hideBtn = e as BUI.Button; if(hideBtn) hideBtn.active = isCurrentlyHidden; })} tooltip-title=${tooltips.HIDE.TITLE} tooltip-text=${tooltips.HIDE.TEXT} icon=${appIcons.HIDE} label="Hide" @click=${onHide}></bim-button> 
        <bim-button ${BUI.ref((e) => { isolateBtn = e as BUI.Button; })} tooltip-title=${tooltips.ISOLATE.TITLE} tooltip-text=${tooltips.ISOLATE.TEXT} icon=${appIcons.ISOLATE} label="Isolate" @click=${onIsolate}></bim-button>
        ${Colorize(components)}
      </bim-toolbar-section> 
      <bim-toolbar-section label="Navigation" icon=${appIcons.COMPASS}>
        <bim-button ${BUI.ref(setupFlyModeBtn)} tooltip-title="Fly Mode (L)" icon=${appIcons.FLY} label="Fly Mode" @click=${onToggleFlyMode}></bim-button>
      </bim-toolbar-section>
      <bim-toolbar-section label="Measure" icon=${appIcons.RULER}>
        ${MeasurerUI(components)}
      </bim-toolbar-section>
    </bim-toolbar>
  `;
};
