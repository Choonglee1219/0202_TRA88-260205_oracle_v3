import * as CUI from "@thatopen/ui-obc";
import * as OBC from "@thatopen/components";
import { users } from "../../globals";

export const topicListTable = (components: OBC.Components) => {
  const [table] = CUI.tables.topicsList({
    components,
    dataStyles: { users },
  });

  table.selectableRows = true;

  table.addEventListener("click", () => {
    setTimeout(() => {
      if (table.selection.size > 1) {
        const lastSelected = Array.from(table.selection).pop();
        table.selection.clear();
        if (lastSelected) {
          table.selection.add(lastSelected);
        }
        table.requestUpdate();
      }
    });
  });

  return table;
};