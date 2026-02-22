import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { SharedBCF } from "../../bim-components/SharedBCF";
import { BCFTopics } from "../../bim-components/BCFTopics";
import { appIcons } from "../../globals";

export interface BCFListPanelState {
  components: OBC.Components;
}

export const bcfListPanelTemplate: BUI.StatefullComponent<BCFListPanelState> = (state) => {
  const { components } = state;
  const sharedBCF = new SharedBCF();
  const fragments = components.get(OBC.FragmentsManager);
  const bcfTopics = components.get(BCFTopics);

  type BcfFileState = {
    files: { id: number; name: string; ifcid: number }[];
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

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    const value = input.value.toLowerCase();
    
    const loadedDbIds = new Set<number>();
    for (const [, model] of fragments.list) {
      const dbId = (model as any).dbId;
      if (dbId) loadedDbIds.add(dbId);
    }

    const filteredBCF = sharedBCF.list.filter(bcf => loadedDbIds.has(bcf.ifcid) && bcf.name.toLowerCase().includes(value));
    updateBcfList({ files: filteredBCF });
  };

  const refreshSharedBCFList = async () => {
    sharedBCF.list = [];
    await sharedBCF.loadBCFFiles();
    sharedBCF.list.sort((a, b) => a.name.localeCompare(b.name));
    
    // 현재 로드된 모델들의 DB ID 수집
    const loadedDbIds = new Set<number>();
    for (const [, model] of fragments.list) {
      const dbId = (model as any).dbId;
      if (dbId) loadedDbIds.add(dbId);
    }

    // 로드된 모델과 연관된 BCF 파일만 필터링
    const filteredBCF = sharedBCF.list.filter(bcf => loadedDbIds.has(bcf.ifcid));
    updateBcfList({ files: filteredBCF });
  };

  // 모델이 로드되거나 삭제될 때 목록 갱신
  fragments.list.onItemSet.add(refreshSharedBCFList);
  fragments.list.onItemUpdated.add(refreshSharedBCFList);
  fragments.list.onItemDeleted.add(refreshSharedBCFList);
  
  return BUI.html`
    <bim-panel-section fixed icon=${appIcons.TASK} label="BCF List">
      <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
        <bim-text-input @input=${onSearch} vertical placeholder="Search..." debounce="200"></bim-text-input>
        <bim-button style="flex: 0;" @click=${() => bcfTopics.saveBCFToDB()} icon=${appIcons.ADD} tooltip-title="Import BCF"></bim-button>
        <bim-button style="flex: 0;" @click=${refreshSharedBCFList} icon=${appIcons.REFRESH} tooltip-title="Refresh"></bim-button>
      </div>
      ${bcfList}
    </bim-panel-section>
  `;
};
