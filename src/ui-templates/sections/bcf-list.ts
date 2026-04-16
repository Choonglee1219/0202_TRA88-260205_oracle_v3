import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { SharedBCF } from "../../bim-components/SharedBCF";
import { SharedIFC } from "../../bim-components/SharedIFC";
import { BCFTopics } from "../../bim-components/BCFTopics";
import { appIcons } from "../../globals";

export interface BCFListPanelState {
  components: OBC.Components;
}

export const bcfListPanelTemplate: BUI.StatefullComponent<BCFListPanelState> = (state) => {
  const { components } = state;
  const sharedBCF = new SharedBCF();
  const sharedIFC = new SharedIFC();
  const fragments = components.get(OBC.FragmentsManager);
  const bcfTopics = components.get(BCFTopics);

  const loadBCF = async (bcfId: number) => {
    const bcf = await sharedBCF.loadBCF(bcfId);
    if (bcf && bcf.content) {
      bcfTopics.deleteAll(); // 이전 토픽 목록을 지웁니다.
      await bcfTopics.loadBCFContent(bcf.content as Uint8Array);

      // BCF에 연결된 간섭 좌표(Clash Data)가 있는지 확인하고, 있다면 토픽에 주입합니다.
      try {
        const response = await fetch(`/api/bcf/${bcfId}/clash`);
        if (response.ok) {
          const clashData = await response.json();
          if (clashData && clashData.length > 0) {
            for (const clash of clashData) {
              if (clash.clash_guid && clash.clash_point) {
                const topic = bcfTopics.list.get(clash.clash_guid);
                if (topic) {
                  (topic as any).clashPoint = clash.clash_point;
                  (topic as any).guid1 = clash.guid1; 
                  (topic as any).guid2 = clash.guid2;
                }
              }
            }
          }
        }
      } catch (e) {
        console.error(`BCF(id: ${bcfId})의 간섭 좌표를 가져오거나 토픽에 주입하는데 실패했습니다.`, e);
      }
    }
  };

  const downloadBCF = async (bcfId: number) => {
    const bcf = await sharedBCF.loadBCF(bcfId);
    if (bcf && bcf.content) {
      const blob = new Blob([bcf.content], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${bcf.name}.bcf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const deleteBCF = async (bcfId: number) => {
    if (!confirm("데이터베이스에서 삭제하시겠습니까?")) return;
    const success = await sharedBCF.deleteBCF(bcfId);
    if (success) {
      if (activeClashMapId === bcfId) {
        bcfTopics.clearClashMap();
        activeClashMapId = null;
      }
      alert("데이터베이스에서 삭제되었습니다.");
      await refreshSharedBCFList();
    } else {
      alert("BCF 파일 삭제에 실패하였습니다.");
    }
  };

  let activeClashMapId: number | null = null;

  bcfTopics.onClashMapCleared.add(() => {
    activeClashMapId = null;
  });

  const toggleClashMap = async (bcfId: number, btn: BUI.Button) => {
    // 이미 켜져 있는 것을 다시 누르면 끄기
    if (activeClashMapId === bcfId) {
      bcfTopics.clearClashMap();
      return;
    }

    btn.loading = true;
    try {
      const response = await fetch(`/api/bcf/${bcfId}/clash`);
      if (response.ok) {
        const clashData = await response.json();
        if (clashData && clashData.length > 0) {
          bcfTopics.drawClashMap(clashData);
          activeClashMapId = bcfId;
        } else {
          alert("이 BCF에는 저장된 간섭 좌표(Clash Data)가 없습니다.");
        }
      } else {
        alert("간섭 좌표를 불러오는데 실패했습니다.");
      }
    } catch (e) {
      console.error("Error loading clash map", e);
    } finally {
      btn.loading = false;
    }
  };

  type BCFTableData = {
    id: number;
    Name: string;
    models: string[];
    [key: string]: any;
  };

  const bcfTable = document.createElement("bim-table") as BUI.Table<BCFTableData>;
  bcfTable.hiddenColumns = ["id", "models"];
  bcfTable.headersHidden = true;
  bcfTable.noIndentation = true;
  bcfTable.noCarets = true;

  bcfTable.dataTransform = {
    Name: (value, rowData) => {
      const name = value as string;
      const { id, models } = rowData as BCFTableData;
      return BUI.html`
        <div style="display: flex; align-items: center; width: 100%; gap: 0.375rem; overflow: hidden; height: 1.5rem;">
          <bim-label style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title=${name}>
            ${name}
          </bim-label>
          <div style="display: flex; gap: 0.25rem; flex-shrink: 0;">
            <bim-button style="flex: 0; margin: 0; padding: 0;" icon=${appIcons.MODEL} tooltip-title="Connected Models" tooltip-text=${models.join(", ")}></bim-button>
            <bim-button style="flex: 0; margin: 0; padding: 0;" @click=${async (e: Event) => {
              const btn = e.target as BUI.Button;
              btn.loading = true;
              try { await loadBCF(id); } finally { btn.loading = false; }
            }} icon=${appIcons.IMPORT} tooltip-title="Load Topics"></bim-button>
            <bim-button style="flex: 0; margin: 0; padding: 0;" @click=${(e: Event) => toggleClashMap(id, e.target as BUI.Button)} icon=${appIcons.MAP} tooltip-title="Toggle Clash Map"></bim-button>
            <bim-button style="flex: 0; margin: 0; padding: 0;" @click=${() => downloadBCF(id)} icon=${appIcons.DOWNLOAD} tooltip-title="Download BCF"></bim-button>
            <bim-button style="flex: 0; margin: 0; padding: 0;" @click=${() => deleteBCF(id)} icon=${appIcons.DELETE} tooltip-title="Delete BCF"></bim-button>
          </div>
        </div>
      `;
    }
  };

  const missingDataLabel = document.createElement("bim-label");
  missingDataLabel.textContent = "⚠️ No related BCF files found";
  missingDataLabel.setAttribute("slot", "missing-data");
  bcfTable.append(missingDataLabel);

  let allRelevantBCFs: { id: number; name: string; models: string[] }[] = [];

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    bcfTable.queryString = input.value;
  };

  const updateBCFTableData = () => {
    bcfTable.data = allRelevantBCFs.map(file => ({
      data: {
        id: file.id,
        Name: file.name,
        models: file.models,
      }
    }));
  };

  const refreshSharedBCFList = async () => {
    sharedBCF.list = [];
    await sharedBCF.loadBCFFiles();
    await sharedIFC.loadIFCFiles();
    
    // 현재 로드된 모델들의 DB ID 수집
    const loadedDbIds = new Set<number>();
    for (const [, model] of fragments.list) {
      const dbId = (model as any).dbId;
      if (dbId) loadedDbIds.add(dbId);
    }

    const bcfMap = new Map<number, { name: string, ifcIds: Set<number> }>();
    for (const bcf of sharedBCF.list) {
      if (!bcfMap.has(bcf.id)) {
        bcfMap.set(bcf.id, { name: bcf.name, ifcIds: new Set() });
      }
      bcfMap.get(bcf.id)!.ifcIds.add(bcf.ifcid);
    }

    allRelevantBCFs = [];
    for (const [id, data] of bcfMap) {
      let isRelevant = false;
      for (const ifcId of data.ifcIds) {
        if (loadedDbIds.has(ifcId)) {
          isRelevant = true;
          break;
        }
      }

      if (isRelevant) {
        const modelNames = Array.from(data.ifcIds).map(ifcId => sharedIFC.list.find(f => f.id === ifcId)?.name || `Model ${ifcId}`);
        allRelevantBCFs.push({ id, name: data.name, models: modelNames });
      }
    }

    allRelevantBCFs.sort((a, b) => a.name.localeCompare(b.name));
    updateBCFTableData();
  };

  // 모델이 로드되거나 삭제될 때 목록 갱신
  fragments.list.onItemSet.add(refreshSharedBCFList);
  fragments.list.onItemUpdated.add(refreshSharedBCFList);
  fragments.list.onItemDeleted.add(refreshSharedBCFList);
  bcfTopics.onRefresh.add(refreshSharedBCFList);
  
  return BUI.html`
    <bim-panel-section fixed icon=${appIcons.TASK} label="BCF List">
      <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
        <bim-text-input @input=${onSearch} vertical placeholder="Search..." debounce="200"></bim-text-input>
        <bim-button style="flex: 0;" @click=${() => bcfTopics.saveBCFToDB()} icon=${appIcons.ADD} tooltip-title="Import BCF"></bim-button>
        <bim-button style="flex: 0;" @click=${() => bcfTopics.openClashDetectionModal()} icon=${appIcons.CLASH} tooltip-title="Clash Detection"></bim-button>
        <bim-button style="flex: 0;" @click=${refreshSharedBCFList} icon=${appIcons.REFRESH} tooltip-title="Refresh"></bim-button>
      </div>
      <div style="flex: 1; min-height: 0; overflow-y: auto;">
        ${bcfTable}
      </div>
    </bim-panel-section>
  `;
};
