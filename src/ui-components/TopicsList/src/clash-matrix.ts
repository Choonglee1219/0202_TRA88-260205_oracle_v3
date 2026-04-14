import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { BCFTopics } from "../../../bim-components/BCFTopics";
import { Highlighter } from "../../../bim-components/Highlighter";

export interface ClashMatrixState {
  components: OBC.Components;
}

export const clashMatrixTemplate: BUI.StatefullComponent<ClashMatrixState> = (state) => {
  const { components } = state;
  const bcfTopics = components.get(BCFTopics);
  const fragments = components.get(OBC.FragmentsManager);
  const classifier = components.get(OBC.Classifier);
  const viewpoints = components.get(OBC.Viewpoints);
  const highlighter = components.get(Highlighter);

  let isComputing = false;

  const table = document.createElement("bim-table") as BUI.Table<any>;
  table.headersHidden = false;
  table.noIndentation = true;
  table.style.display = "none"; // 처음엔 숨김

  const statusLabel = document.createElement("bim-label");
  statusLabel.textContent = "Waiting for clash data...";
  statusLabel.style.cssText = "text-align: center; padding: 1rem; color: var(--bim-ui_gray-5); display: block;";

  const updateUI = (message: string | null) => {
    if (message) {
      statusLabel.textContent = message;
      statusLabel.style.display = "block";
      table.style.display = "none";
    } else {
      statusLabel.style.display = "none";
      table.style.display = "block";
    }
  };

  let needsRecompute = false;
  const computeMatrix = async () => {
    if (isComputing) {
      needsRecompute = true;
      return;
    }
    isComputing = true;
    needsRecompute = false;

    console.log("🚀 [Clash Matrix] Computation started...");
    updateUI("Computing matrix... Please wait.");

    try {
      // 1. Classifier 확인 (Dashboard 등에서 이미 처리되었다면 스킵)
      if (!classifier.list.has("entities")) {
        console.log("⏳ [Clash Matrix] Classifier 'entities' not found. Grouping models...");
        try {
          await classifier.byCategory({ classificationName: "entities" });
        } catch (err) {
          console.warn("⚠️ [Clash Matrix] Classifier grouping error:", err);
        }
      }

      // 2. 빠른 조회를 위한 역방향 해시맵 구성 (ModelID -> ExpressID -> Category)
      console.log("⏳ [Clash Matrix] Building reverse category map...");
      const reverseMap = new Map<string, Map<number, string>>();
      const entitiesClass = classifier.list.get("entities");
      
      if (entitiesClass) {
        for (const [catName, group] of entitiesClass.entries()) {
          const displayCat = catName.toUpperCase().replace(/^IFC/i, "");
          const modelIdMap = (group as any).get ? await (group as any).get() : group;
          
          for (const [modelId, expressIds] of Object.entries(modelIdMap)) {
            if (!reverseMap.has(modelId)) reverseMap.set(modelId, new Map());
            const expressIdMap = reverseMap.get(modelId)!;
            for (const id of (expressIds as Set<number>)) {
              expressIdMap.set(id, displayCat);
            }
          }
        }
      }
      console.log(`✅ [Clash Matrix] Reverse map built for ${reverseMap.size} models.`);

      // GUID를 받아 Category 문자열과 해당 모델의 ModelIdMap을 함께 반환하는 헬퍼 함수
      const getCategoryInfoFromGuid = async (guid: string): Promise<{ category: string, modelIdMap: OBC.ModelIdMap }> => {
        if (!guid) return { category: "Unknown", modelIdMap: {} };
        const idMap = await fragments.guidsToModelIdMap([guid]);
        let category = "Unknown";
        if (idMap && Object.keys(idMap).length > 0) {
          for (const [modelId, expressIds] of Object.entries(idMap)) {
            if (expressIds.size > 0) {
              const expId = Array.from(expressIds)[0];
              category = reverseMap.get(modelId)?.get(expId) || "Unknown";
              break;
            }
          }
        }
        return { category, modelIdMap: idMap || {} };
      };

      // 각 카테고리 셀(쌍)에 포함된 객체들의 ModelIdMap을 누적하기 위한 맵
      const clashItemsMap: Record<string, Record<string, OBC.ModelIdMap>> = {};

      // 셀 클릭 시 해당 간섭 객체들을 선택(Highlight)하고 카메라를 FitToZoom 하는 함수
      const onCellClick = async (c1: string, c2: string) => {
        const items = clashItemsMap[c1]?.[c2];
        if (!items || OBC.ModelIdMapUtils.isEmpty(items)) return;

        await highlighter.clear("select");
        await highlighter.highlightByID("select", items);

        const worlds = components.get(OBC.Worlds);
        const world = worlds.list.values().next().value;
        if (world && world.camera instanceof OBC.SimpleCamera) {
          await world.camera.fitToItems(items);
        }
      };

      // 3. 토픽 순회 및 Clash Matrix 집계
      console.log(`⏳ [Clash Matrix] Iterating over ${bcfTopics.list.size} topics...`);
      const clashMatrix: Record<string, Record<string, number>> = {};
      const categories = new Set<string>();
      let validClashCount = 0;

      for (const topic of bcfTopics.list.values()) {
        let guid1 = (topic as any).guid1;
        let guid2 = (topic as any).guid2;

        // Fallback: 기존 생성된 토픽이라 JSON guid 주입이 안되어있을 경우 뷰포인트 선택요소에서 추출
        if (!guid1 || !guid2) {
          const viewGuid = Array.from(topic.viewpoints)[0];
          if (viewGuid) {
            const vp = viewpoints.list.get(viewGuid);
            if (vp && vp.selectionComponents.size === 2) {
              const guids = Array.from(vp.selectionComponents);
              guid1 = guids[0];
              guid2 = guids[1];
              console.log(`🔍 [Clash Matrix] Recovered GUIDs from viewpoint for topic: ${topic.title}`);
            }
          }
        }

        if (guid1 && guid2) {
          validClashCount++;
          let info1 = await getCategoryInfoFromGuid(guid1);
          let info2 = await getCategoryInfoFromGuid(guid2);
          let cat1 = info1.category;
          let cat2 = info2.category;

          // 대칭성 및 중복 방지를 위해 알파벳 순 정렬 (A vs B 나 B vs A 나 같음)
          if (cat1 > cat2) [cat1, cat2] = [cat2, cat1];

          categories.add(cat1);
          categories.add(cat2);

          if (!clashMatrix[cat1]) clashMatrix[cat1] = {};
          clashMatrix[cat1][cat2] = (clashMatrix[cat1][cat2] || 0) + 1;
          
          if (!clashItemsMap[cat1]) clashItemsMap[cat1] = {};
          if (!clashItemsMap[cat1][cat2]) clashItemsMap[cat1][cat2] = {};
          if (info1.modelIdMap) OBC.ModelIdMapUtils.add(clashItemsMap[cat1][cat2], info1.modelIdMap);
          if (info2.modelIdMap) OBC.ModelIdMapUtils.add(clashItemsMap[cat1][cat2], info2.modelIdMap);
        }
      }

      console.log(`✅ [Clash Matrix] Aggregation complete. Found ${validClashCount} valid clashes.`);

      const sortedCats = Array.from(categories).sort();

      if (sortedCats.length === 0) {
        console.warn("⚠️ [Clash Matrix] No clash categories found.");
        updateUI("No valid clash data found. (Check if topics have 2 elements selected)");
        return;
      }

      // 4. bim-table 렌더링 세팅
      table.columns = [
        { name: "Category", width: "12rem" },
        ...sortedCats.map(cat => ({ name: cat, width: "6rem" }))
      ];

      // 5. Heatmap 효과를 위한 Data Transform 세팅
      const dataTransform: Record<string, any> = {
        Category: (value: any) => BUI.html`<div style="display: flex; align-items: center; width: 100%; height: 100%; min-height: 1.5rem; background-color: var(--bim-ui_bg-contrast-10); border-radius: 4px; color: var(--bim-ui_gray-5); font-size: 0.75rem; font-weight: normal; padding-left: 0.5rem;">${value}</div>`
      };

      for (const colCat of sortedCats) {
        dataTransform[colCat] = (value: any, row: any) => {
          const rowCat = row.Category;
          const c1 = rowCat < colCat ? rowCat : colCat;
          const c2 = rowCat < colCat ? colCat : rowCat;
          
          const count = value as number;
          
          // 12구간 스케일: 0 (step 0), 1~10 (step 1), 11~20 (step 2), ... 101 이상 (step 11)
          const step = count === 0 ? 0 : Math.min(Math.floor((count - 1) / 10) + 1, 11);
          const hue = 120 - Math.floor((step * 120) / 11); 
          const bgColor = `hsl(${hue}, 65%, 45%)`;
          const color = '#ffffff';
          const cursor = count > 0 ? 'pointer' : 'default';
          
          return BUI.html`
            <div 
              @click=${() => { if (count > 0) onCellClick(c1, c2); }}
              style="display: flex; width: 100%; height: 100%; min-height: 1.5rem; align-items: center; justify-content: center; background-color: ${bgColor}; color: ${color}; font-size: 0.75rem; font-weight: bold; border-radius: 2px; cursor: ${cursor}; transition: filter 0.2s;"
              onmouseover="this.style.filter='brightness(1.2)'" onmouseout="this.style.filter='brightness(1)'">
              ${count > 0 ? count : '-'}
            </div>
          `;
        };
      }
      
      table.dataTransform = dataTransform;

      // 6. 데이터 채우기
      const tableData = sortedCats.map(rowCat => {
        const row: any = { Category: rowCat };
        for (const colCat of sortedCats) {
          const c1 = rowCat < colCat ? rowCat : colCat;
          const c2 = rowCat < colCat ? colCat : rowCat;
          row[colCat] = clashMatrix[c1]?.[c2] || 0;
        }
        return { data: row };
      });

      table.data = tableData;
      updateUI(null); // 상태 숨기고 테이블 표시

    } catch (error) {
      console.error("❌ [Clash Matrix] Computation failed:", error);
      updateUI("Error computing matrix. Check console.");
    } finally {
      isComputing = false;
      console.log("🏁 [Clash Matrix] Computation finished.");
      if (needsRecompute) {
        debouncedComputeMatrix();
      }
    }
  };

  let computeTimeout: ReturnType<typeof setTimeout>;
  const debouncedComputeMatrix = () => {
    if (computeTimeout) clearTimeout(computeTimeout);
    computeTimeout = setTimeout(() => {
      computeMatrix();
    }, 500);
  };

  bcfTopics.onRefresh.add(debouncedComputeMatrix);
  bcfTopics.list.onItemSet.add(debouncedComputeMatrix);
  bcfTopics.list.onItemUpdated.add(debouncedComputeMatrix);
  bcfTopics.list.onItemDeleted.add(debouncedComputeMatrix);

  // 컴포넌트 렌더링 시 초기 1회 실행
  debouncedComputeMatrix();

  return BUI.html`
    <div style="width: 100%; overflow-x: auto; padding: 0.5rem; box-sizing: border-box;">
      ${statusLabel}
      ${table}
    </div>
  `;
};

export const clashMatrix = (state: ClashMatrixState) => {
  return BUI.Component.create<BUI.PanelSection, ClashMatrixState>(clashMatrixTemplate, state);
};
