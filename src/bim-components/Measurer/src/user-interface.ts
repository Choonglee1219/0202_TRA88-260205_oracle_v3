import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { Measurer } from "..";

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
        <bim-button style="flex: 0;" label="Check" @click=${onMeasure}></bim-button>
      </div>
    `;
  });
}
