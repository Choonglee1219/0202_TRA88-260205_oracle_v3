import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { appIcons } from "../../globals";
import { itemsData } from "../../ui-components/ItemsData";
import { Highlighter } from "../../bim-components/Highlighter";

export interface ItemsDataPanelState {
  components: OBC.Components;
}

export const itemsDataPanelTemplate: BUI.StatefullComponent<
  ItemsDataPanelState
> = (state) => {
  const { components } = state;

  const highlighter = components.get(Highlighter);

  const [propsTable, updatePropsTable] = itemsData({
    components,
    modelIdMap: {},
  });

  propsTable.preserveStructureOnFilter = true;

  let section: BUI.PanelSection | undefined;

  if (highlighter.events.select) {
    highlighter.events.select.onHighlight.add((modelIdMap) => {
      updatePropsTable({ modelIdMap });
      if (section) {
        let count = 0;
        for (const ids of Object.values(modelIdMap)) {
          count += ids.size;
        }
        section.label = `Selection Data (${count})`;
      }
    });

    highlighter.events.select.onClear.add(() => {
      updatePropsTable({ modelIdMap: {} });
      if (section) section.label = "Selection Data (0)";
    });
  }

  let searchInput: BUI.TextInput | undefined;

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    propsTable.queryString = input.value;
  };

  const onClearSearch = () => {
    if (!searchInput) return;
    searchInput.value = "";
    propsTable.queryString = null;
  };

  const toggleExpanded = () => {
    propsTable.expanded = !propsTable.expanded;
  };

  const sectionId = BUI.Manager.newRandomId();

  return BUI.html`
    <bim-panel-section ${BUI.ref((e) => {
      section = e as BUI.PanelSection;
      const selection = highlighter.selection.select;
      if (Object.keys(selection).length > 0) {
        updatePropsTable({ modelIdMap: selection });
        let count = 0;
        for (const ids of Object.values(selection)) {
          count += ids.size;
        }
        section.label = `Selection Data (${count})`;
      }
    })} fixed id=${sectionId} icon=${appIcons.TASK} label="Selection Data (0)">
      <div style="display: flex; gap: 0.375rem;">
        <bim-text-input ${BUI.ref((e) => { searchInput = e as BUI.TextInput; })} @input=${onSearch} vertical placeholder="Search..." debounce="200"></bim-text-input>
        <bim-button style="flex: 0;" @click=${onClearSearch} icon=${appIcons.CLEAR} tooltip-title="Clear Search"></bim-button>
        <bim-button style="flex: 0;" @click=${toggleExpanded} icon=${appIcons.EXPAND} tooltip-title="Toggle Expanded"></bim-button>
        <bim-button style="flex: 0;" @click=${() => propsTable.downloadData("ElementData", "json")} icon=${appIcons.EXPORT} tooltip-title="Export Data" tooltip-text="Export the shown properties."></bim-button>
      </div>
      ${propsTable}
    </bim-panel-section> 
  `;
};
