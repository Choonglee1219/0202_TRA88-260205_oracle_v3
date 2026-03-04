import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { FragmentsModel } from "@thatopen/fragments";
import { appIcons } from "../../globals";
import { spatialTree } from "../../ui-components/SpatialTree";

export interface SpatialTreePanelState {
  components: OBC.Components;
  models?: Map<string, FragmentsModel>;
}

export const spatialTreePanelTemplate: BUI.StatefullComponent<
  SpatialTreePanelState
> = (state) => {
  const { components, models } = state;
  
  const [table] = spatialTree({ components, models: models ? [...models.values()] : [] });

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    table.queryString = input.value;
  };

  return BUI.html`
    <bim-panel-section fixed icon=${appIcons.TREE} label="Spatial Tree">
      <bim-text-input @input=${onSearch} placeholder="Search..." debounce="200" style="flex: 0"></bim-text-input>
      ${table}
    </bim-panel-section> 
  `;
};
