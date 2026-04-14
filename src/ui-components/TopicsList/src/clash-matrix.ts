import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { BCFTopics } from "../../../bim-components/BCFTopics";
import { appIcons } from "../../../globals";

export interface ClashMatrixState {
  components: OBC.Components;
}

export const clashMatrixTemplate: BUI.StatefullComponent<ClashMatrixState> = (state) => {
  const { components } = state;
  const bcfTopics = components.get(BCFTopics);
  const fragments = components.get(OBC.FragmentsManager);
  const classifier = components.get(OBC.Classifier);
  const viewpoints = components.get(OBC.Viewpoints);

  let isComputing = false;

  const table = document.createElement("bim-table") as BUI.Table<any>;
  table.headersHidden = false;
  table.noIndentation = true;
  table.style.display = "none"; // 처음엔 숨김

  const statusLabel = document.createElement("bim-label");
  statusLabel.textContent = "Click 'Compute Clash Matrix' to generate clash matrix.";
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

  const computeMatrix = async (e: Event) => {
    const btn = (e.target as HTMLElement).closest("bim-button") as BUI.Button;
    if (isComputing) return;
    isComputing = true;
    if (btn) btn.loading = true;

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

      // GUID를 받아 Category 문자열을 반환하는 헬퍼 함수
      const getCategoryFromGuid = async (guid: string): Promise<string> => {
        if (!guid) return "Unknown";
        const idMap = await fragments.guidsToModelIdMap([guid]);
        if (idMap && Object.keys(idMap).length > 0) {
          for (const [modelId, expressIds] of Object.entries(idMap)) {
            if (expressIds.size > 0) {
              const expId = Array.from(expressIds)[0];
              return reverseMap.get(modelId)?.get(expId) || "Unknown";
            }
          }
        }
        return "Unknown";
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
          let cat1 = await getCategoryFromGuid(guid1);
          let cat2 = await getCategoryFromGuid(guid2);

          // 대칭성 및 중복 방지를 위해 알파벳 순 정렬 (A vs B 나 B vs A 나 같음)
          if (cat1 > cat2) [cat1, cat2] = [cat2, cat1];

          categories.add(cat1);
          categories.add(cat2);

          if (!clashMatrix[cat1]) clashMatrix[cat1] = {};
          clashMatrix[cat1][cat2] = (clashMatrix[cat1][cat2] || 0) + 1;
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
        dataTransform[colCat] = (value: any) => {
          const count = value as number;
          const intensity = count > 0 ? Math.min(count * 0.1, 0.8) : 0;
          const bgColor = count > 0 ? `rgba(255, 60, 60, ${intensity})` : 'transparent';
          const color = count > 0 ? 'var(--bim-ui_main-contrast)' : 'var(--bim-ui_gray-5)';
          
          return BUI.html`
            <div style="display: flex; width: 100%; height: 100%; min-height: 1.5rem; align-items: center; justify-content: center; background-color: ${bgColor}; color: ${color}; font-size: 0.75rem; font-weight: normal; border-radius: 4px;">
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
      if (btn) btn.loading = false;
      console.log("🏁 [Clash Matrix] Computation finished.");
    }
  };

  return BUI.html`
    <div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <bim-button label="Compute Clash Matrix" @click=${computeMatrix} icon=${appIcons.PLAY}></bim-button>
      </div>
      <div style="width: 100%; overflow-x: auto; border: 1px solid var(--bim-ui_bg-contrast-20); border-radius: 4px; padding: 0.5rem;">
        ${statusLabel}
        ${table}
      </div>
    </div>
  `;
};

export const clashMatrix = (state: ClashMatrixState) => {
  return BUI.Component.create<BUI.PanelSection, ClashMatrixState>(clashMatrixTemplate, state);
};
