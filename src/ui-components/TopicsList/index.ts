import * as CUI from "@thatopen/ui-obc";
import * as OBC from "@thatopen/components";
import { users } from "../../globals";

export const topicsListTable = (components: OBC.Components) => {
  const [table] = CUI.tables.topicsList({
    components,
    dataStyles: { users },
  });

  table.selectableRows = true;

  return table;
};