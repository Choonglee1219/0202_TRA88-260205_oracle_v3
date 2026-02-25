import * as BUI from "@thatopen/ui";
import * as CUI from "@thatopen/ui-obc";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { appIcons } from "../../globals";
import { PropertiesManager } from "../../bim-components/PropsManager";

export interface ElementsDataPanelState {
  components: OBC.Components;
}

export const elementsDataPanelTemplate: BUI.StatefullComponent<
  ElementsDataPanelState
> = (state) => {
  const { components } = state;

  // const fragments = components.get(OBC.FragmentsManager);
  const highlighter = components.get(OBF.Highlighter);
  const globalProps = components.get(PropertiesManager);

  const [propsTable, updatePropsTable] = CUI.tables.itemsData({
    components,
    modelIdMap: {},
  });

  const notChangableAttributes = ["Category", "LocalId", "Guid"];

  propsTable.dataTransform.Value = (value, rowData) => {
    const { Name, Value, modelId, localId } = rowData;
    if (!(modelId && localId !== undefined)) return value;
    const fragments = components.get(OBC.FragmentsManager);
    const model = fragments.list.get(modelId);
    if (!model) return value;
    if (Name && notChangableAttributes.includes(Name)) return value;

    const onMouseOver = ({ target }: { target: BUI.Label }) => {
      target.style.color = "var(--bim-ui_accent-base)";
    };

    const onMouseLeave = ({ target }: { target: BUI.Label }) => {
      target.style.removeProperty("color");
    };

    const onLabelClicked = ({ target }: { target: BUI.Label }) => {
      const contextMenu =
        target.querySelector<BUI.ContextMenu>("bim-context-menu");
      if (!contextMenu) return;
      contextMenu.visible = true;
    };

    let textInput: BUI.TextInput | undefined;
    const onTextInputCreated = (e?: Element) => {
      if (!e) return;
      textInput = e as BUI.TextInput;
    };

    let label: BUI.Label | undefined;
    const onLabelCreated = (e?: Element) => {
      if (!e) return;
      label = e as BUI.Label;
    };

    const onAcceptClicked = async ({ target }: { target: BUI.Button }) => {
      if (!Name) return;
      if (!(textInput && textInput.value.trim() !== "")) return;
      const { value } = textInput;
      target.loading = true;
      const [itemAttributes] = await model.getItemsData([localId]);
      itemAttributes[Name] = { value };
      fragments.core.editor.setItem(modelId, itemAttributes);
      // fragments.core.editor.createItem(modelId, {
      //   category: "IFCPROPERTYSET",
      //   data: { Name: { value: "My Custom Pset" } }
      // })
      // fragments.core.editor.createItem(modelId, {
      //   category: "IFCPROPERTYSET",
      //   data: { Name: { value: "My Custom Pset 2" } }
      // })
      // const psetIds = await fragments.core.editor.applyChanges(modelId)
      // await fragments.core.editor.relate(modelId, localId, "IsDefinedBy", psetIds)
      await fragments.core.editor.applyChanges(modelId);
      if (label) label.textContent = value;
      target.loading = false;
    };

    return BUI.html`
      <bim-label ${BUI.ref(onLabelCreated)} style="cursor: pointer;" @mouseover=${onMouseOver} @mouseleave=${onMouseLeave} @click=${onLabelClicked}>
        ${value}
        <bim-context-menu>
          <div style="display: flex; gap: 0.5rem; width: 14rem;">
            <bim-text-input value=${Value} ${BUI.ref(onTextInputCreated)}></bim-text-input>
            <bim-button style="flex: 0" label="Accept" @click=${onAcceptClicked}></bim-button>
          </div>
        </bim-context-menu>
      </bim-label>
    `;
  };

  propsTable.preserveStructureOnFilter = true;
  // fragments.onFragmentsDisposed.add(() => updatePropsTable());

  let section: BUI.PanelSection | undefined;

  if (highlighter.events.select) {
    highlighter.events.select.onHighlight.add((modelIdMap) => {
      // const panel = document.getElementById("data")!;
      // panel.style.removeProperty("display");
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
      // const panel = document.getElementById("data")!;
      // panel.style.display = "none";
      updatePropsTable({ modelIdMap: {} });
      if (section) section.label = "Selection Data (0)";
    });
  }

  globalProps.onPropertiesUpdated.add(() => {
    const selection = highlighter.selection.select;
    if (selection && Object.keys(selection).length > 0) {
      updatePropsTable({ modelIdMap: {} });
      setTimeout(() => updatePropsTable({ modelIdMap: selection }), 100);
    }
  });

  let searchInput: BUI.TextInput | undefined;

  const search = (e: Event) => {
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
        <bim-text-input ${BUI.ref((e) => { searchInput = e as BUI.TextInput; })} @input=${search} vertical placeholder="Search..." debounce="200"></bim-text-input>
        <bim-button style="flex: 0;" @click=${onClearSearch} icon=${appIcons.CLEAR} tooltip-title="Clear Search"></bim-button>
        <bim-button style="flex: 0;" @click=${toggleExpanded} icon=${appIcons.EXPAND} tooltip-title="Toggle Expanded"></bim-button>
        <bim-button style="flex: 0;" @click=${() => propsTable.downloadData("ElementData", "csv")} icon=${appIcons.EXPORT} tooltip-title="Export Data" tooltip-text="Export the shown properties to CSV."></bim-button>
      </div>
      ${propsTable}
    </bim-panel-section> 
  `;
};
