import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { appIcons } from "../../globals";
import { queriesList } from "../../ui-components";

export interface QueriesPanelState {
  components: OBC.Components;
  isAdmin: boolean;
}

export const queriesPanelTemplate: BUI.StatefullComponent<QueriesPanelState> = (
  state,
) => {
  const { components, isAdmin } = state;
  const finder = components.get(OBC.ItemsFinder);

  const [element] = queriesList({ components });

  let customBtn: BUI.TemplateResult | undefined;
  if (isAdmin) {
    const onExport = () => {
      const data = finder.export();
      const json = JSON.stringify(data);
      const blob = new Blob([json], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "queries.json";
      link.click();
      URL.revokeObjectURL(link.href);
    };

    const onOpenObsidian = () => {
      window.open("obsidian://open", "_self");
    };

    const onOpenLink = () => {
      window.open("https://docs.thatopen.com/intro", "_blank");
    };

    customBtn = BUI.html`
      <div style="display: flex; gap: 0.5rem">
        <bim-button
          @click=${onExport}
          style="flex: auto"
          label="Export"
          icon=${appIcons.EXPORT} >
        </bim-button>
        <bim-button
          @click=${onOpenObsidian}
          style="flex: auto"
          label="Obsidian"
          icon=${appIcons.OBSIDIAN} >
        </bim-button>
        <bim-button
          @click=${onOpenLink}
          style="flex: auto"
          label="Link"
          icon=${appIcons.LINK} >
        </bim-button>
      </div>
    `;
  }

  return BUI.html`
    <bim-panel-section label="Queries" icon=${appIcons.SEARCH}>
      ${customBtn}
      ${element}
    </bim-panel-section>
  `;
};
