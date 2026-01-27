import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { PropertiesManager } from "..";

interface NewPropModalState {
  components: OBC.Components;
  onSubmit: () => void;
}

const template: BUI.StatefullComponent<NewPropModalState> = (state) => {
  const { components, onSubmit } = state;

  const panelSectionID = `form-${BUI.Manager.newRandomId()}`;
  const globalProps = components.get(PropertiesManager);

  const onAdd = () => {
    const panelSection = document.getElementById(
      panelSectionID,
    ) as BUI.PanelSection;
    if (!panelSection) return;
    const { name, type } = panelSection.value;
    globalProps.list.add({ name, type: type[0] });
    onSubmit();
  };

  return BUI.html`
    <dialog style="margin: auto; border-radius: 1rem; border: none; padding: 0; overflow: hidden;">
      <bim-panel style="width: 20rem;">
        <bim-panel-section id=${panelSectionID} label="New Global Property" fixed>
          <bim-text-input name="name" label="Name"></bim-text-input>
          <bim-dropdown name="type" label="Type">
            <bim-option label="IfcText"></bim-option> 
            <bim-option label="IfcBoolean"></bim-option> 
            <bim-option label="IfcInteger"></bim-option> 
            <bim-option label="IfcReal"></bim-option> 
          </bim-dropdown>
          <bim-button label="Add"  @click=${onAdd}></bim-button>
        </bim-panel-section>
      </bim-panel> 
    </dialog>
  `;
};

export const newPropModal = (state: NewPropModalState) => {
  const component = BUI.Component.create<HTMLDialogElement, NewPropModalState>(
    template,
    state,
  );

  document.body.append(component[0]);

  return component;
};
