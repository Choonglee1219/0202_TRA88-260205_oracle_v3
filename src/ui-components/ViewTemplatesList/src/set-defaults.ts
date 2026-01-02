import * as BUI from "@thatopen/ui";
import { ViewTemplatesListState, ViewTemplatesListTableData } from "./types";
import { ViewTemplater } from "../../../bim-components";
import { appIcons } from "../../../globals";

export const setDefaults = (
  state: ViewTemplatesListState,
  table: BUI.Table<ViewTemplatesListTableData>,
) => {
  const { components } = state;

  table.noIndentation = true;
  table.expanded = true;
  table.headersHidden = true;
  table.columns = ["Name", { name: "Actions", width: "auto" }];

  table.dataTransform = {
    Actions: (_, rowData) => {
      const { Name } = rowData;
      if (!Name) return _;

      const templater = components.get(ViewTemplater);

      const onApply = async ({ target }: { target: BUI.Button }) => {
        target.loading = true;
        await templater.apply(Name);
        target.loading = false;
      };

      const onReset = async ({ target }: { target: BUI.Button }) => {
        target.loading = true;
        await templater.reset();
        target.loading = false;
      };

      return BUI.html`
        <bim-button icon=${appIcons.COLORIZE} @click=${onApply}></bim-button>
        <bim-button icon=${appIcons.SHOW} @click=${onReset}></bim-button>
        `;
    },
  };
};
