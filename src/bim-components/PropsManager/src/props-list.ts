import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { PropertiesManager } from "..";

interface GlobalPropsListState {
  components: OBC.Components;
}

const listTemplate: BUI.StatefullComponent<GlobalPropsListState> = (state) => {
  const { components } = state;
  const globalProps = components.get(PropertiesManager);

  const onCreated = (table?: Element) => {
    if (!(table instanceof BUI.Table)) return;
    table.data = [...globalProps.list].map(({ name, type }) => {
      return { data: { Name: name, Type: type } };
    });
  };

  return BUI.html`<bim-table ${BUI.ref(onCreated)} no-indentation selectable-rows>
    <div slot="missing-data">
      <bim-label>No global parameters to display!</bim-label>
    </div>
  </bim-table>`;
};

export const globalPropsList = (state: GlobalPropsListState) => {
  const component = BUI.Component.create<BUI.Table, GlobalPropsListState>(
    listTemplate,
    state,
  );

  return component;
};
