import * as OBC from "@thatopen/components";

export const setupFinders = (components: OBC.Components) => {
  const finder = components.get(OBC.ItemsFinder);

  // ItemsFinder by Categories(Entity Type)
  finder.create("Structure Elements", [{ categories: [/COLUMN|SLAB|BEAM/] }]);
  finder.create("Duct Elements", [{ categories: [/DUCT|DAMPER/] }]);
  finder.create("Slabs", [{ categories: [/SLAB/] }]);
  finder.create("Walls", [{ categories: [/WALL/] }]);
  finder.create("Columns", [{ categories: [/COLUMN/] }]);

  // ItemsFinder by ContaineInStructure
  finder.create("Columns (Level 1)", [
    {
      categories: [/COLUMN/],
      relation: {
        name: "ContainedInStructure",
        query: {
          categories: [/STOREY/],
          attributes: { queries: [{ name: /Name/, value: /01/ }] },
        },
      },
    },
  ]);

  // ItemsFinder by Attributes
  finder.create("Columns (Tag = 122528)", [
    {
      categories: [/COLUMN/],
      attributes: {
        queries: [{ name: /^Tag$/, value: /^122528$/ }],
      },
    },
  ]);

  // ItemsFinder by Properties
  finder.create("Columns (Pset_ColumnCommon.Reference = 750mm)", [
    {
      categories: [/COLUMN/],
      relation: {
        name: "IsDefinedBy",
        query: {
          categories: [/PROPERTYSET/],
          attributes: { queries: [{ name: /Name/, value: /ColumnCommon/ }] },
          relation: {
            name: "HasProperties",
            query: {
              categories: [/SINGLEVALUE/],
              attributes: {
                queries: [
                  { name: /Name/, value: /Reference/ },
                  { name: /NominalValue/, value: /750/ },
                ],
              },
            },
          },
        },
      },
    },
  ]);
};
