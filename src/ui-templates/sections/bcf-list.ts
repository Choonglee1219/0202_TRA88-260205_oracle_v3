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

  type BcfFileState = {
    files: { id: number; name: string; models: string[] }[];
  };

  const loadBCF = async (bcfId: number) => {
    const bcf = await sharedBCF.loadBCF(bcfId);
    if (bcf && bcf.content) {
      await bcfTopics.loadBCFContent(bcf.content as Uint8Array);
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
      alert("데이터베이스에서 삭제되었습니다.");
      await refreshSharedBCFList();
    } else {
      alert("BCF 파일 삭제에 실패하였습니다.");
    }
  };

  const creator: BUI.StatefullComponent<BcfFileState> = (state) => {
    const { files } = state;
    return BUI.html`
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${files.length > 0
          ? files.map(
              (file) => BUI.html`
                <div style="display: flex; gap: 0.375rem; align-items: center;">
                  <bim-label style="flex: 1;">${file.name}</bim-label>
                  <bim-button style="flex: 0;" icon=${appIcons.MODEL} tooltip-title="Connected Models" tooltip-text=${file.models.join(", ")}></bim-button>
                  <bim-button style="flex: 0;" @click=${() => loadBCF(file.id)} icon=${appIcons.IMPORT} tooltip-title="Load Topics"></bim-button>
                  <bim-button style="flex: 0;" @click=${() => downloadBCF(file.id)} icon=${appIcons.DOWNLOAD} tooltip-title="Download BCF"></bim-button>
                  <bim-button style="flex: 0;" @click=${() => deleteBCF(file.id)} icon=${appIcons.DELETE} tooltip-title="Delete BCF"></bim-button>
                </div>
              `,
            )
          : BUI.html`<div style="color: var(--bim-ui_gray-6); font-size: 0.75rem;">⚠️ No related BCF files found</div>`}
      </div>
    `;
  };

  const [bcfList, updateBcfList] = BUI.Component.create(creator, { files: [] });

  let allRelevantBCFs: { id: number; name: string; models: string[] }[] = [];

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    const value = input.value.toLowerCase();
    const filtered = allRelevantBCFs.filter(bcf => bcf.name.toLowerCase().includes(value));
    updateBcfList({ files: filtered });
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
    updateBcfList({ files: allRelevantBCFs });
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
      ${bcfList}
    </bim-panel-section>
  `;
};
