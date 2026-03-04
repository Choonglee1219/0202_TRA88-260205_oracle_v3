import * as FRAGS from "@thatopen/fragments";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as BUI from "@thatopen/ui";
import { SpatialTreeItem } from "@thatopen/fragments";
import { SpatialTreeState, SpatialTreeData } from "./types";

const getModelTree = async (
  model: FRAGS.FragmentsModel,
  structure: SpatialTreeItem,
  categoryPrefix: string = "",
): Promise<BUI.TableGroupData<SpatialTreeData>[]> => {
  const { localId, category, children } = structure;

  if (category && children) {
    const rows: BUI.TableGroupData<SpatialTreeData>[] = [];
    for (const child of children) {
      const childRows = await getModelTree(model, child, category);
      rows.push(...childRows);
    }
    return rows;
  }

  if (localId !== undefined && localId !== null) {
    const item = model.getItem(localId);
    const attrs = await item.getAttributes();
    let name = "Untitled";
    if (attrs) {
      const nameVal = attrs.getValue("Name");
      if (nameVal) name = String(nameVal);
    }

    const content = categoryPrefix ? `${categoryPrefix}  ||  ${name}` : name;

    const row: BUI.TableGroupData<SpatialTreeData> = {
      data: {
        Name: content,
        modelId: model.modelId,
        localId,
      },
    };

    if (children && children.length > 0) {
      row.children = [];
      for (const child of children) {
        const childRows = await getModelTree(model, child);
        row.children.push(...childRows);
      }
    }
    return [row];
  }
  return [];
};

const computeRowData = async (models: Iterable<FRAGS.FragmentsModel>) => {
  const rows: BUI.TableGroupData[] = [];
  for (const model of models) {
    const structure = await model.getSpatialStructure();
    const tree = await getModelTree(model, structure);
    if (tree.length === 0) continue;
    const modelData: BUI.TableGroupData<SpatialTreeData> = {
      data: {
        Name: model.modelId,
        modelId: model.modelId,
      },
      children: tree,
    };
    rows.push(modelData);
  }
  return rows;
};

export const spatialTreeTemplate = (state: SpatialTreeState) => {
  const { components, models } = state;

  const selectHighlighterName = state.selectHighlighterName ?? "select";

  const onCellCreated = ({
    detail,
  }: CustomEvent<BUI.CellCreatedEventDetail<SpatialTreeData>>) => {
    const { cell } = detail;
    if (cell.column === "Name" && !cell.rowData.Name) {
      cell.style.gridColumn = "1 / -1";
    }
  };

  const onRowCreated = (
    e: CustomEvent<BUI.RowCreatedEventDetail<SpatialTreeData>>,
  ) => {
    e.stopImmediatePropagation();
    const { row } = e.detail;
    const highlighter = components.get(OBF.Highlighter);
    const fragments = components.get(OBC.FragmentsManager);
    row.onclick = async () => {
      if (!selectHighlighterName) return;
      const {
        data: { modelId, localId, children },
      } = row;
      if (!(modelId && (localId !== undefined || children))) return;
      const model = fragments.list.get(modelId);
      if (!model) return;
      if (localId !== undefined) {
        const childrenLocalIds = await model.getItemsChildren([localId]);
        const modelIdMap = {
          [modelId]:
            childrenLocalIds.length !== 0
              ? new Set(childrenLocalIds)
              : new Set([localId]),
        };
        highlighter.highlightByID(
          selectHighlighterName,
          modelIdMap,
          true,
          true,
        );
      } else if (children) {
        const localIds = JSON.parse(children);
        const childrenLocalIds = await model.getItemsChildren(localIds);
        const modelIdMap = {
          [modelId]:
            childrenLocalIds.length !== 0 ? childrenLocalIds : localIds,
        };
        highlighter.highlightByID(
          selectHighlighterName,
          modelIdMap,
          true,
          true,
        );
      }
    };
  };

  const onTableCreated = async (element?: Element) => {
    if (!element) return;
    const table = element as BUI.Table<SpatialTreeData>;

    table.loadFunction = async () => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(computeRowData(models));
        });
      });
    };

    table.loadData(true);
  };

  return BUI.html`
    <bim-table @rowcreated=${onRowCreated} @cellcreated=${onCellCreated} ${BUI.ref(onTableCreated)} headers-hidden>
      <bim-label slot="missing-data" style="--bim-icon--c: gold">
        ⚠️ No models available to display the spatial structure!
      </bim-label>
    </bim-table>
  `;
};
