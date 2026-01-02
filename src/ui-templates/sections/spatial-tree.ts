import * as BUI from "@thatopen/ui";
import * as CUI from "@thatopen/ui-obc";
import * as OBC from "@thatopen/components";
import { FragmentsModel } from "@thatopen/fragments";
import { appIcons } from "../../globals";

export interface SpatialTreePanelState {
  components: OBC.Components;
  models?: Map<string, FragmentsModel>;
}

export const spatialTreePanelTemplate: BUI.StatefullComponent<
  SpatialTreePanelState
> = (state) => {
  const { components, models } = state;

  const [spatialTree] = CUI.tables.spatialTree({
    components,
    models: models ? [...models.values()] : [],
    selectHighlighterName: "select",
  });
  spatialTree.preserveStructureOnFilter = true;

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    spatialTree.queryString = input.value;
  };

  return BUI.html`
    <bim-panel-section fixed icon=${appIcons.TREE} label="Spatial Tree">
      <bim-text-input @input=${onSearch} placeholder="Search..." debounce="200" style="flex: 0"></bim-text-input>
      ${spatialTree}
    </bim-panel-section> 
  `;
};
