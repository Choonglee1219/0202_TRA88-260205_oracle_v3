import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { Measurer } from "..";
import { appIcons } from "../../../globals";

export function MeasurerUI(components: OBC.Components) {
  const measurer = components.get(Measurer);

  const onMeasure = async ({ target }: { target: BUI.Button }) => {
    target.loading = true;
    await measurer.getMeasure();
    target.loading = false;
    BUI.ContextMenu.removeMenus();
  };

  return BUI.Component.create(() => {
    return BUI.html`
      <div style="display: flex; gap: 0.5rem;">
        <bim-button style="flex: 0;" tooltip-title="Clearance Check" tooltip-text="선택된 두 객체의 최소거리를 측정합니다." icon=${appIcons.RULER} label="Distance" @click=${onMeasure}></bim-button>
      </div>
    `;
  });
}
