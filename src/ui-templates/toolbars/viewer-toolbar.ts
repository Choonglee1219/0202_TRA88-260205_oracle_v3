import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as FRAGS from "@thatopen/fragments";
import * as THREE from "three";
import { appIcons, tooltips } from "../../globals";
import { MeasurerUI } from "../../bim-components/Measurer/src";

export interface ViewerToolbarState {
  components: OBC.Components;
  world: OBC.World;
}

const originalColors = new Map<
  FRAGS.BIMMaterial,
  { color: number; transparent: boolean; opacity: number; depthWrite: boolean }
>();

export const setModelTransparent = (components: OBC.Components) => {
  if (originalColors.size > 0) return;
  const fragments = components.get(OBC.FragmentsManager);

  const materials = [...fragments.core.models.materials.list.values()];
  for (const material of materials) {
    if (material.userData.customId) continue;
    // save colors
    let color: number | undefined;
    if ("color" in material) {
      color = material.color.getHex();
    } else {
      color = material.lodColor.getHex();
    }

    originalColors.set(material, {
      color,
      transparent: material.transparent,
      opacity: material.opacity,
      depthWrite: material.depthWrite,
    });

    // set color
    material.transparent = true;
    material.needsUpdate = true;
    material.depthWrite = false;
    if ("color" in material) {
      material.opacity = 0.01;
      material.color.setColorName("cyan");
    } else {
      material.opacity = 0.01;
      material.lodColor.setColorName("grey");
    }
  }
};

export const restoreModelMaterials = () => {
  for (const [material, data] of originalColors) {
    const { color, transparent, opacity, depthWrite } = data;
    material.transparent = transparent;
    material.opacity = opacity;
    material.depthWrite = depthWrite;
    if ("color" in material) {
      material.color.setHex(color);
    } else {
      material.lodColor.setHex(color);
    }
    material.needsUpdate = true;
  }
  originalColors.clear();
};

export const viewerToolbarTemplate: BUI.StatefullComponent<
ViewerToolbarState
> = (state) => {
  const { components, world } = state;
  
  const highlighter = components.get(OBF.Highlighter);
  const hider = components.get(OBC.Hider);
  
  let hiddenItemsBtn: BUI.Button | undefined;

  const onShowAll = async ({ target }: { target: BUI.Button }) => {
    target.loading = true;
    await hider.set(true);
    const classifier = components.get(OBC.Classifier);
    const hiddenItemsGroup = classifier.list.get("PermanentHidden")?.get("HiddenItems");
    if (hiddenItemsGroup) {
      const hiddenItems = await hiddenItemsGroup.get();
      if (!OBC.ModelIdMapUtils.isEmpty(hiddenItems)) {
        await hider.set(false, hiddenItems);
      }
    }
    if (hiddenItemsBtn) hiddenItemsBtn.active = false;
    target.loading = false;
  };

  const onToggleGhost = () => {
    if (originalColors.size) {
      restoreModelMaterials();
      if (world.renderer instanceof OBF.PostproductionRenderer) {
        world.renderer.postproduction.edgesPass.enabled = true;
      }
    } else {
      setModelTransparent(components);
      if (world.renderer instanceof OBF.PostproductionRenderer) {
        world.renderer.postproduction.edgesPass.enabled = false;
      }
    }
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

    focusBtn = BUI.html`<bim-button tooltip-title=${tooltips.FOCUS.TITLE} tooltip-text=${tooltips.FOCUS.TEXT} icon=${appIcons.FOCUS} label="Focus" @click=${onFocus}></bim-button>`;
  }

  const onHide = async ({ target }: { target: BUI.Button }) => {
    const selection = highlighter.selection.select;
    if (OBC.ModelIdMapUtils.isEmpty(selection)) return;
    target.loading = true;
    await hider.set(false, selection);
    target.loading = false;
  };

  const onIsolate = async ({ target }: { target: BUI.Button }) => {
    const selection = highlighter.selection.select;
    if (OBC.ModelIdMapUtils.isEmpty(selection)) return;
    target.loading = true;
    await hider.isolate(selection);
    target.loading = false;
  };

  const colorInputId = BUI.Manager.newRandomId();
  const getColorValue = () => {
    const input = document.getElementById(
      colorInputId,
    ) as BUI.ColorInput | null;
    if (!input) return null;
    return input.color;
  };

  const onApplyColor = async ({ target }: { target: BUI.Button }) => {
    const colorValue = getColorValue();
    const selection = highlighter.selection.select;
    if (OBC.ModelIdMapUtils.isEmpty(selection) || !colorValue) return;
    const color = new THREE.Color(colorValue);
    const style = [...highlighter.styles.entries()].find(([, definition]) => {
      if (!definition) return false;
      return definition.color.getHex() === color.getHex();
    });
    target.loading = true;
    if (style) {
      const name = style[0];
      if (name === "select") {
        target.loading = false;
        return;
      }
      await highlighter.highlightByID(name, selection, false, false);
    } else {
      highlighter.styles.set(colorValue, {
        color,
        renderedFaces: FRAGS.RenderedFaces.ONE,
        opacity: 0.5,
        transparent: true,
      });
      await highlighter.highlightByID(colorValue, selection, false, false);
    }
    await highlighter.clear("select");
    target.loading = false;
  };

  const onClearColor = async ({ target }: { target: BUI.Button }) => {
    target.loading = true;
    await highlighter.clear();
    target.loading = false;
  };

  return BUI.html`
    <bim-toolbar>
      <bim-toolbar-section label="Visibility" icon=${appIcons.SHOW}>
        <bim-button tooltip-title=${tooltips.SHOW_ALL.TITLE} tooltip-text=${tooltips.SHOW_ALL.TEXT} icon=${appIcons.SHOW} label="Show All" @click=${onShowAll}></bim-button> 
        <bim-button tooltip-title=${tooltips.GHOST.TITLE} tooltip-text=${tooltips.GHOST.TEXT} icon=${appIcons.TRANSPARENT} label="Ghost" @click=${onToggleGhost}></bim-button>
        <bim-button ${BUI.ref((e) => { hiddenItemsBtn = e as BUI.Button; })} tooltip-title="Toggle Hidden Items" icon=${appIcons.MODEL} label="Space" @click=${onToggleHidden}></bim-button>
      </bim-toolbar-section> 
      <bim-toolbar-section label="Selection" icon=${appIcons.SELECT}>
        ${focusBtn}
        <bim-button tooltip-title=${tooltips.HIDE.TITLE} tooltip-text=${tooltips.HIDE.TEXT} icon=${appIcons.HIDE} label="Hide" @click=${onHide}></bim-button> 
        <bim-button tooltip-title=${tooltips.ISOLATE.TITLE} tooltip-text=${tooltips.ISOLATE.TEXT} icon=${appIcons.ISOLATE} label="Isolate" @click=${onIsolate}></bim-button>
        <bim-color-input id=${colorInputId} color="#FF0000"></bim-color-input>
        <bim-button icon=${appIcons.COLORIZE} tooltip-title="Apply Color" @click=${onApplyColor}></bim-button>
        <bim-button icon=${appIcons.CLEAR} tooltip-title="Clear Color" @click=${onClearColor}></bim-button>
      </bim-toolbar-section> 
      <bim-toolbar-section label="Measure" icon=${appIcons.RULER}>
        ${MeasurerUI(components)}
      </bim-toolbar-section>
    </bim-toolbar>
  `;
};
