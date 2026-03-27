import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { BCFTopics, newTopic, updateTopic } from "../../bim-components/BCFTopics";
import { topicsList } from "../../ui-components/TopicsList";
import { appIcons } from "../../globals";

export interface TopicListState {
  components: OBC.Components;
}

export const topicListTemplate: BUI.StatefullComponent<
  TopicListState
> = (state) => {
  const { components } = state;
  const bcfTopics = components.get(BCFTopics);
  const [table] = topicsList({ components });
  const newTopicModal = newTopic(components);
  const updateTopicModal = updateTopic(bcfTopics);

  bcfTopics.setupTable(table);

  const onNewTopicModalOpen = () => {
    newTopicModal.showModal();
  };
  const onUpdateTopicModalOpen = () => {
    updateTopicModal.showModal(table.selection);
  };
  const onDeleteTopic = () => {
    bcfTopics.delete(table.selection);
  };
  const onClearTopicsList = () => {
    bcfTopics.deleteAll();
  };
  const onSaveTopicsToBCF = () => {
    bcfTopics.saveBCF();
  };
  const onExportTopicsToJSON = () => {
    bcfTopics.exportJSON();
  };
  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    table.queryString = input.value;
  };

  let panelSection: BUI.PanelSection;
  const updateTopicCount = () => {
    if (!panelSection) return;
    let open = 0;
    let assigned = 0;
    let closed = 0;
    let resolved = 0;
    let total = 0;

    for (const topic of bcfTopics.list.values()) {
      total++;
      const status = (topic as any).status;
      if (status === "Open") open++;
      else if (status === "Assigned") assigned++;
      else if (status === "Closed") closed++;
      else if (status === "Resolved") resolved++;
    }
    
    panelSection.label = `Topic List ( Total(${total}) = Open(${open}) + Assigned(${assigned}) + Closed(${closed}) + Resolved(${resolved}) )`;
  };

  bcfTopics.onRefresh.add(() => setTimeout(updateTopicCount, 100));
  bcfTopics.list.onItemSet.add(() => setTimeout(updateTopicCount, 100));
  bcfTopics.list.onItemUpdated.add(() => setTimeout(updateTopicCount, 100));
  bcfTopics.list.onItemDeleted.add(() => setTimeout(updateTopicCount, 100));

  // 3D 화면에서 간섭 구(Sphere) 클릭 시, Topic List 테이블 행 자동 선택 및 줌인
  bcfTopics.onClashSphereClicked.add((guid) => {
    const targetGroup = table.value.find((row: any) => row.data && row.data.Guid === guid);
    if (targetGroup) {
      table.selection.clear();
      table.selection.add(targetGroup.data); // 테이블 체크박스 활성화

      const topic = bcfTopics.list.get(guid);
      if (topic) {
        bcfTopics.restoreViewpoint(topic); // 해당 구체로 자연스럽게 카메라 줌인
      }
    }
  });

  return BUI.html`
    <bim-panel-section
      ${BUI.ref((e) => {
        panelSection = e as BUI.PanelSection;
        updateTopicCount();
      })}
      fixed icon=${appIcons.TASK} label="Topic List">
      <div style="display: flex; gap: 0.5rem;">
        <div style="display: flex; gap: 0.25rem; flex: 1;">
          <bim-button style="flex: 1;" @click=${onNewTopicModalOpen} label="Create Topic" icon=${appIcons.ADD}></bim-button>
          <bim-button style="flex: 1;" @click=${onUpdateTopicModalOpen} label="Update Topic" icon=${appIcons.REF}></bim-button>
          <bim-button style="flex: 1;" @click=${onDeleteTopic} label="Delete Topic" icon=${appIcons.DELETE}></bim-button>
          <bim-button style="flex: 1;" @click=${onClearTopicsList} label="Clear List" icon=${appIcons.CLEAR}></bim-button>
          <bim-button style="flex: 1;" @click=${onSaveTopicsToBCF} label="Save BCF" icon=${appIcons.SAVE}></bim-button>
          <bim-button style="flex: 1;" @click=${onExportTopicsToJSON} label="Send to TDVS" icon=${appIcons.EXPORT}></bim-button>
        </div>
        <bim-text-input @input=${onSearch} vertical placeholder="Search..." debounce="200" style="flex: 1;"></bim-text-input>
      </div>
      ${table}
    </bim-panel-section>
  `;
};

export const topicList = (state: TopicListState) => {
  return BUI.Component.create<BUI.Panel, TopicListState>(topicListTemplate, state);
};