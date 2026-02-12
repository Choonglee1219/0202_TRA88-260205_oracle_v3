import * as OBC from "@thatopen/components";

export const setupFinders = (components: OBC.Components) => {
  const finder = components.get(OBC.ItemsFinder);

  // ItemsFinder by Categories(Entity Type)
  finder.create("Structure Elements", [
    { categories: [/COLUMN|SLAB|BEAM|WALL/] }
  ]);
  finder.create("Space", [
    { categories: [/SPACE|SPATIAL/] }
  ]);
  finder.create("Slab", [
    { categories: [/SLAB/] }
  ]);
  finder.create("Beam", [
    { categories: [/BEAM/] }
  ]);
  finder.create("Member", [
    { categories: [/MEMBER/] }
  ]);
  finder.create("Ramp", [
    { categories: [/RAMP/] }
  ]);
  finder.create("Wall", [
    { categories: [/WALL/] }
  ]);
  finder.create("Plate", [
    { categories: [/PLATE/] }
  ]);
  finder.create("Stair", [
    { categories: [/STAIR/] }
  ]);
  finder.create("Rail", [
    { categories: [/RAIL/] }
  ]);
  finder.create("Duct", [
    { categories: [/DUCT|DAMPER/] }
  ]);
  finder.create("Tray", [
    { categories: [/CABLECARRIER/] }
  ]);
  finder.create("Pipe", [
    { categories: [/PIPE/] }
  ]);
  finder.create("Equipment", [
    { categories: [/EQUIPMENT/] }
  ]);
  finder.create("Proxy", [
    { categories: [/PROXY/] }
  ]);

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
  finder.create("Concrete Column", [
    {
      categories: [/COLUMN/],
      attributes: {
        queries: [{ name: /^Name$/, value: /Concrete/ }],
      },
    },
  ]);
  finder.create("Concrete Member", [
    {
      categories: [/WALL|SLAB|RAMP/],
      attributes: {
        queries: [{ name: /^Name$/, value: /Concrete/ }],
      },
    },
  ]);
  finder.create("Steel Member", [
    {
      categories: [/COLUMN|BEAM|MEMBER/],
      attributes: {
        queries: [{ name: /^Name$/, value: /^(?!Concrete).*$/ }],
      },
    },
  ]);
  finder.create("Base Slab", [
    {
      categories: [/SLAB/],
      attributes: {
        queries: [{ name: /^PreDefinedType$/, value: /^BASESLAB$/ }],
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
