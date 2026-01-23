import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { GlobalPropertiesManager } from "..";

interface AssignPropsModalState {
  components: OBC.Components;
  onSubmit: () => void;
  names: string[];
  psets: string[];
}

const template: BUI.StatefullComponent<AssignPropsModalState> = (state) => {
  const { components, names, psets, onSubmit } = state;

  const panelSectionID = `form-${BUI.Manager.newRandomId()}`;
  const globalProps = components.get(GlobalPropertiesManager);
  const highlighter = components.get(OBF.Highlighter);

  const onAdd = async ({ target }: { target: BUI.Button }) => {
    const panelSection = document.getElementById(
      panelSectionID,
    ) as BUI.PanelSection;
    if (!panelSection) return;
    target.loading = true;
    const formData = panelSection.value;
    for (const name of names) {
      const value = formData[name];
      if (value === undefined) continue;
      await globalProps.assign(
        name,
        value,
        formData.pset?.[0],
        highlighter.selection.select,
      );
    }
    target.loading = false;
    onSubmit();
  };

  return BUI.html`
    <dialog style="margin: auto; border-radius: 1rem; border: none; padding: 0; overflow: hidden;">
      <bim-panel style="width: 20rem;">
        <bim-panel-section id=${panelSectionID} label="New Props Config" fixed>
          ${names.map(
            (name) => BUI.html`
              <bim-text-input name=${name} label=${name}></bim-text-input>
            `,
          )}
          <bim-dropdown name="pset" label="Property Set" vertical>
            ${psets.map((pset) => BUI.html`<bim-option label=${pset}></bim-option>`)}
          </bim-dropdown>
          <bim-button label="Add" @click=${onAdd}></bim-button>
        </bim-panel-section>
      </bim-panel> 
    </dialog>
  `;
};

export const assignPropsModal = (state: AssignPropsModalState) => {
  const component = BUI.Component.create<
    HTMLDialogElement,
    AssignPropsModalState
  >(template, state);

  document.body.append(component[0]);

  return component;
};
