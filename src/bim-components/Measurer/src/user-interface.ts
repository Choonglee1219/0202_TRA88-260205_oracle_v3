import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { Measurer } from "..";
import { appIcons, tooltips } from "../../../globals";

export function MeasurerUI(components: OBC.Components) {
  const measurer = components.get(Measurer);
  const lengthMeasurer = components.get(OBF.LengthMeasurement);
  const areaMeasurer = components.get(OBF.AreaMeasurement);

  const onMeasure = async ({ target }: { target: BUI.Button }) => {
    target.loading = true;
    await measurer.getMeasure();
    target.loading = false;
    BUI.ContextMenu.removeMenus();
  };

  const onClearAll = () => {
    lengthMeasurer.list.clear();
    areaMeasurer.list.clear();
    BUI.ContextMenu.removeMenus();
  };

  let lengthBtn: BUI.Button | undefined;
  let areaBtn: BUI.Button | undefined;

  // 단축키 연동 (M: Length, N: Area)
  if (!(window as any)._measurerHotkeyRegistered) {
    (window as any)._measurerHotkeyRegistered = true;
    window.addEventListener("keydown", (e) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      const key = e.key.toLowerCase();
      if (key === 'm') lengthBtn?.click();
      if (key === 'n') areaBtn?.click();
    });
  }

  return BUI.Component.create(() => {
    return BUI.html`
      <div style="display: flex; gap: 0.5rem;">
        <bim-button style="flex: 0;" tooltip-title=${tooltips.CLEARANCE.TITLE} tooltip-text=${tooltips.CLEARANCE.TEXT} icon=${appIcons.RULER} @click=${onMeasure}></bim-button>
        <bim-button style="flex: 0;" tooltip-title=${tooltips.CLEAR_MEASUREMENTS.TITLE} tooltip-text=${tooltips.CLEAR_MEASUREMENTS.TEXT} icon=${appIcons.CLEAR} @click=${onClearAll}></bim-button>
      </div>
    `;
  });
}
