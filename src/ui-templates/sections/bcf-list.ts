import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { SharedBCF } from "../../bim-components/SharedBCF";
import { appIcons } from "../../globals";

export interface BCFListPanelState {
  components: OBC.Components;
}

export const bcfListPanelTemplate: BUI.StatefullComponent<BCFListPanelState> = (state) => {
  const { components } = state;
  const sharedBCF = new SharedBCF();
  const fragments = components.get(OBC.FragmentsManager);
  const bcfTopics = components.get(OBC.BCFTopics);

  type BcfFileState = {
    files: { id: number; name: string; ifcId: number }[];
  };

  const loadBCF = async (bcfId: number) => {
    const bcf = await sharedBCF.loadBCF(bcfId);
    if (bcf && bcf.content) {
      bcfTopics.dispose(); // 기존 토픽 제거 (요청사항: 그 bcf의 topic들만 보이게)
      await bcfTopics.load(bcf.content as Uint8Array);
    }
  };

  const deleteBCF = async (bcfId: number) => {
    if (!confirm("데이터베이스에서 삭제하시겠습니까?")) return;
    const success = await sharedBCF.deleteBCF(bcfId);
    if (success) {
      alert("데이터베이스에서 삭제되었습니다.");
      await refreshBcfList();
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
                  <bim-button style="flex: 0;" @click=${() => deleteBCF(file.id)} icon=${appIcons.DELETE} tooltip-title="Delete BCF"></bim-button>
                </div>
              `,
            )
          : BUI.html`<div style="color: var(--bim-ui_gray-6); font-size: 0.75rem;">⚠️ No related BCF files found</div>`}
      </div>
    `;
  };

  const [bcfList, updateBcfList] = BUI.Component.create(creator, { files: [] });

  const refreshBcfList = async () => {
    sharedBCF.list = [];
    await sharedBCF.loadBCFFiles();
    
    // 현재 로드된 모델들의 DB ID 수집
    const loadedDbIds = new Set<number>();
    for (const [, model] of fragments.list) {
      const dbId = (model as any).dbId;
      if (dbId) loadedDbIds.add(dbId);
    }

    // 로드된 모델과 연관된 BCF 파일만 필터링
    const filteredList = sharedBCF.list.filter(bcf => loadedDbIds.has(bcf.ifcId));

    // 중복 제거
    const uniqueList = [...new Map(filteredList.map((item) => [item.id, item])).values()];
    uniqueList.sort((a, b) => a.name.localeCompare(b.name));
    updateBcfList({ files: uniqueList });
  };

  // 모델이 로드되거나 삭제될 때 목록 갱신
  fragments.list.onItemSet.add(refreshBcfList);
  fragments.list.onItemUpdated.add(refreshBcfList);
  fragments.list.onItemDeleted.add(refreshBcfList);
  
  return BUI.html`
    <bim-panel-section icon=${appIcons.TASK} label="BCF List">
      <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
        <bim-button @click=${refreshBcfList} label="Refresh" icon=${appIcons.REF}></bim-button>
      </div>
      ${bcfList}
    </bim-panel-section>
  `;
};
