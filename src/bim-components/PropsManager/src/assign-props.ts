import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { PropertiesManager } from "..";

interface AssignPropsModalState {
  components: OBC.Components;
  onSubmit: () => void;
  names: string[];
  psets: string[];
}

const template: BUI.StatefullComponent<AssignPropsModalState> = (state) => {
  const { components, names, psets, onSubmit } = state;

  const panelSectionID = `form-${BUI.Manager.newRandomId()}`;
  const globalProps = components.get(PropertiesManager);
  const highlighter = components.get(OBF.Highlighter);

  const onAdd = async ({ target }: { target: BUI.Button }) => {
    const panelSection = document.getElementById(
      panelSectionID,
    ) as BUI.PanelSection;
    if (!panelSection) return;
    target.loading = true;
    const formData = panelSection.value;
    const pset = formData.pset?.[0];
    if (typeof pset !== "string") {
      alert("Please select a Property Set.");
      target.loading = false;
      return;
    }
    for (const name of names) {
      const value = formData[name];
      if (value === undefined) continue;
      await globalProps.assign(
        name,
        value,
        pset,
        highlighter.selection.select,
      );
    }
    target.loading = false;
    onSubmit();
  };

  return BUI.html`
    <dialog class="assign-props-modal" style="margin: auto; border-radius: 1rem; border: none; padding: 0; overflow: hidden;">
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

const addBackdropStyles = () => {
  const styleId = "assign-props-modal-styles";
  if (document.getElementById(styleId)) return;
  const styles = `
    dialog.assign-props-modal::backdrop {
      backdrop-filter: blur(4px);
      background-color: rgba(0, 0, 0, 0.4);
    }
  `;
  const styleElement = document.createElement("style");
  styleElement.id = styleId;
  styleElement.textContent = styles;
  document.head.append(styleElement);
};

export const assignPropsModal = (state: AssignPropsModalState) => {
  const component = BUI.Component.create<
    HTMLDialogElement,
    AssignPropsModalState
  >(template, state);

  addBackdropStyles();
  document.body.append(component[0]);

  return component;
};
