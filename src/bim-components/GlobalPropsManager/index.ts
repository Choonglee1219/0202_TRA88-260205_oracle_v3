import * as OBC from "@thatopen/components";
import * as WEBIFC from "web-ifc";

export class GlobalPropertiesManager extends OBC.Component {
  static uuid = "f6e5bc78-8e0f-4f49-94ac-f337e729083f" as const;
  enabled = true;

  readonly list = new OBC.DataSet<{ name: string; type: string }>();
  readonly onPropertiesUpdated = new OBC.Event<void>();

  constructor(components: OBC.Components) {
    super(components);
    components.add(GlobalPropertiesManager.uuid, this);
    this.list.guard = ({ name }) => {
      const existing = [...this.list].find(({ name: n }) => n === name);
      return !existing;
    };
  }

  async assign(
    name: string,
    value: string | boolean | number,
    propertySet: string,
    modelIdMap: Record<string, Set<number>>,
  ) {
    const property = [...this.list].find(({ name: n }) => n === name);
    if (!property) return;

    const fragments = this.components.get(OBC.FragmentsManager);

    for (const [modelID, expressIDs] of Object.entries(modelIdMap)) {
      const model = fragments.list.get(modelID);
      if (!model) continue;

      const editor = (fragments as any).core.editor;

      for (const expressID of expressIDs) {
        const [itemData] = await model.getItemsData([expressID], {
          attributesDefault: true,
          relationsDefault: { attributes: false, relations: false },
          relations: {
            IsDefinedBy: {
              attributes: true,
              relations: true,
            },
          },
        });

        let pset: Record<string, any> | null = null;
        if (itemData?.IsDefinedBy && Array.isArray(itemData.IsDefinedBy)) {
          for (const item of itemData.IsDefinedBy) {
            if ((item as any).Name?.value === propertySet && Array.isArray((item as any).HasProperties)) {
              pset = item;
              break;
            }
          }
        }
        if (!pset) continue;
        const { type } = property;

        let ifcType = WEBIFC.IFCLABEL;
        const typeUpper = type.toUpperCase();
        if (typeUpper === "IFCTEXT") ifcType = WEBIFC.IFCTEXT;
        else if (typeUpper === "IFCBOOLEAN") ifcType = WEBIFC.IFCBOOLEAN;
        else if (typeUpper === "IFCIDENTIFIER") ifcType = WEBIFC.IFCIDENTIFIER;
        else if (typeUpper === "IFCINTEGER") ifcType = WEBIFC.IFCINTEGER;
        else if (typeUpper === "IFCREAL") ifcType = WEBIFC.IFCREAL;

        let finalValue = value;
        if (ifcType === WEBIFC.IFCBOOLEAN && typeof value === "string") finalValue = value.toLowerCase() === "true";
        else if ((ifcType === WEBIFC.IFCINTEGER || ifcType === WEBIFC.IFCREAL) && typeof value === "string") finalValue = Number(value);

        await editor.createItem(modelID, {
          category: "IFCPROPERTYSINGLEVALUE",
          data: { Name: { value: name, type: WEBIFC.IFCIDENTIFIER as any }, NominalValue: { value: finalValue, type: ifcType as any } },
        });

        const [propId] = await editor.applyChanges(modelID);
        if (propId === undefined) continue;
        const psetId = pset._localId.value;
        await editor.relate(modelID, psetId, "HasProperties", [propId]);
      }
      await editor.applyChanges(modelID);
    }
    this.onPropertiesUpdated.trigger();
  }
}

export * from "./src";
