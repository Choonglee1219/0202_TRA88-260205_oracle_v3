import * as OBC from "@thatopen/components";
import { ViewTemplater } from "../bim-components";

export const setupViewTemplates = (components: OBC.Components) => {
  const templater = components.get(ViewTemplater);

  templater.list.set("Columns", {
    defaultVisibility: false,
    visibilityExceptions: {
      queries: new Set(["Columns"]),
    },
    colors: {
      queries: {
        "#16b769": new Set(["Columns"]),
      },
    },
  });

  templater.list.set("Structure & Duct", {
    defaultVisibility: false,
    visibilityExceptions: {
      queries: new Set(["Structure Elements", "Duct Elements"]),
    },
    colors: {
      queries: {
        "#d0da7e": new Set(["Structure Elements"]),
        "#16b769": new Set(["Duct Elements"]),
      },
    },
  });
};
