import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import { CategoricalTreeState, categoricalTreeTemplate, CategoricalTreeData } from "./src";

export const categoricalTree = (state: CategoricalTreeState, autoUpdate = true) => {
  const element = BUI.Component.create<
    BUI.Table<CategoricalTreeData>,
    CategoricalTreeState
  >(categoricalTreeTemplate, state);

  const [table, update] = element;
  table.hiddenColumns = ["modelId", "localId", "children"];
  table.columns = ["Name"];
  table.headersHidden = true;

  if (autoUpdate) {
    const { components } = state;
    const fragments = components.get(OBC.FragmentsManager);
    fragments.list.onItemSet.add(() =>
      update({ models: fragments.list.values() }),
    );
    fragments.list.onItemDeleted.add(() => update());
  }

  return element;
};

export * from "./src";