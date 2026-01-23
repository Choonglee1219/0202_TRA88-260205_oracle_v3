import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { GlobalPropertiesManager } from "../../bim-components/GlobalPropsManager";
import { globalPropsList } from "../../bim-components/GlobalPropsManager/src/props-list";
import { assignPropsModal } from "../../bim-components/GlobalPropsManager/src/assign-props";
import { newPropModal } from "../../bim-components/GlobalPropsManager/src/new-prop";
import { appIcons } from "../../globals";

export interface GlobalPropsSectionState {
  components: OBC.Components;
}

export const globalPropsPanelTemplate: BUI.StatefullComponent<
  GlobalPropsSectionState
> = (state) => {
  const { components } = state;

  const [propsList, updatePropsList] = globalPropsList({ components });
  const globalProps = components.get(GlobalPropertiesManager);
  globalProps.list.onItemAdded.add(() => updatePropsList());

  const [newProps] = newPropModal({
    components,
    onSubmit: () => newProps.close(),
  });

  const [assignProps, updateAssignProps] = assignPropsModal({
    components,
    names: [],
    psets: [],
    onSubmit: () => assignProps.close(),
  });

  const onAdd = async () => {
    const selection = propsList.selection;
    const highlighter = components.get(OBF.Highlighter);
    const fragments = components.get(OBC.FragmentsManager);
    const modelIdMap = highlighter.selection.select;
    if (selection.size === 0) {
      alert("Please select a property from the list.");
      return;
    }
    if (Object.keys(modelIdMap).length === 0) {
      alert("Please select an element in the 3D view.");
      return;
    }
    const props = [...selection].map(({ Name }) => Name) as string[];
    const psets = new Set<string>();
    for (const [modelID, expressIDs] of Object.entries(modelIdMap)) {
      const model = fragments.list.get(modelID);
      if (!model) continue;
      const ids = Array.from(expressIDs);
      const itemsData = await model.getItemsData(ids, {
        attributesDefault: true,
        relationsDefault: { attributes: false, relations: false },
        relations: {
          IsDefinedBy: {
            attributes: true,
            relations: true,
          },
        },
      });
      for (const item of itemsData) {
        if (item.IsDefinedBy && Array.isArray(item.IsDefinedBy)) {
          for (const pset of item.IsDefinedBy) {
            if ((pset as any).Name?.value && Array.isArray((pset as any).HasProperties)) {
              psets.add((pset as any).Name.value);
            }
          }
        }
      }
    }
    if (psets.size === 0) {
      alert("No Property Sets found on the selected elements.");
      return;
    }
    propsList.selection = new Set();
    updateAssignProps({ names: props, psets: [...psets] });
    assignProps.showModal();
  };

  return BUI.html`
    <bim-panel-section label="Global Properties" icon=${appIcons.REF} label="Global Properties" fixed>
      ${propsList}
      <div style="display: flex; gap: 0.25rem">
        <bim-button label="New Global Property" @click=${() => newProps.showModal()}></bim-button>
        <bim-button label="Add To Selection" @click=${onAdd}></bim-button>
      </div>
    </bim-panel-section>
  `;
};

export const globalPropsSection = (state: GlobalPropsSectionState) => {
  const component = BUI.Component.create<
    BUI.PanelSection,
    GlobalPropsSectionState
  >(globalPropsPanelTemplate, state);

  return component;
};
