import * as FRAGS from "@thatopen/fragments";
import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import { SpatialTreeItem } from "@thatopen/fragments";
import { SpatialTreeState, SpatialTreeData } from "./types";
import { Highlighter } from "../../../bim-components/Highlighter";

// 성능 최적화: 트리 생성 시 무거운 비동기 속성 조회(getAttributes)를 생략하고 즉시 뼈대만 구축합니다.
const getModelTree = (
  model: FRAGS.FragmentsModel,
  structure: SpatialTreeItem,
  categoryPrefix: string = "",
): BUI.TableGroupData<SpatialTreeData>[] => {
  const { localId, category, children } = structure;

  if (category && children) {
    const rows: BUI.TableGroupData<SpatialTreeData>[] = [];
    for (const child of children) {
      const childRows = getModelTree(model, child, category);
      rows.push(...childRows);
    }
    return rows;
  }

  if (localId !== undefined && localId !== null) {
    const row: BUI.TableGroupData<SpatialTreeData> = {
      data: {
        Name: "Loading...", // 플레이스홀더 설정
        modelId: model.modelId,
        localId,
        categoryPrefix, // 나중에 이름 조회 후 조합하기 위해 저장
      },
    };

    if (children && children.length > 0) {
      row.children = [];
      for (const child of children) {
        const childRows = getModelTree(model, child);
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
    const tree = getModelTree(model, structure);
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
    const rowData = cell.rowData;
    cell.style.border = `1px solid var(--bim-ui_bg-contrast-20)`;
    cell.style.padding = "4px 8px";
    if (cell.column === "Name" && !cell.rowData.Name) {
      cell.style.gridColumn = "1 / -1";
    }

    // --- Lazy Loading (지연 로딩) 로직 ---
    // 테이블 가상화(Virtualization) 기능에 의해 이 이벤트는 화면에 셀이 렌더링될 때만 실행됩니다.
    if (cell.column === "Name" && rowData.localId !== undefined && rowData.Name === "Loading...") {
      const fragments = components.get(OBC.FragmentsManager);
      const model = fragments.list.get(rowData.modelId as string);
      if (model) {
        rowData.Name = "Fetching..."; // 중복 요청 방지
        cell.style.color = "var(--bim-ui_gray-10)";
        cell.style.fontStyle = "italic";

        (async () => {
          try {
            const item = model.getItem(rowData.localId!);
            const attrs = await item.getAttributes();
            let name = "Untitled";
            if (attrs) {
              const nameVal = attrs.getValue("Name");
              if (nameVal) name = String(nameVal);
            }

            const content = rowData.categoryPrefix ? `${rowData.categoryPrefix}  ||  ${name}` : name;
            rowData.Name = content; // 검색 및 정렬을 위해 원본 데이터 업데이트

            // 가상 스크롤에 의해 셀이 재사용되지 않았는지 확인 후 렌더링
            if (cell.rowData === rowData) {
              cell.textContent = content;
              cell.style.color = "";
              cell.style.fontStyle = "";
            }
          } catch (e) {}
        })();
      }
    } else if (cell.column === "Name") {
      // 스크롤 시 재사용된 셀의 스타일 원복
      if (rowData.Name !== "Fetching...") {
        cell.style.color = "";
        cell.style.fontStyle = "";
      }
    }
  };

  const onRowCreated = (
    e: CustomEvent<BUI.RowCreatedEventDetail<SpatialTreeData>>,
  ) => {
    e.stopImmediatePropagation();
    const { row } = e.detail;
    row.style.minHeight = "28px";
    row.style.margin = "0";

    const highlighter = components.get(Highlighter);
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
    <bim-table @rowcreated=${onRowCreated} @cellcreated=${onCellCreated} ${BUI.ref(onTableCreated)} headers-hidden style="gap: 0;">
      <bim-label slot="missing-data" style="--bim-icon--c: gold">
        ⚠️ No models available to display the spatial structure!
      </bim-label>
    </bim-table>
  `;
};
