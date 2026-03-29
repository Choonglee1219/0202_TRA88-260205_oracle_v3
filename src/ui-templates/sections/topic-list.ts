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

  // 테이블에서 토픽 제목(Title) 클릭 시 Viewpoint가 복원되는 기존 동작에 추가로, 해당 테이블 행이 자동으로 선택되도록 동작 확장
  let lastClickedTopicId: string | null = null;
  let lastClickTime = 0;

  const originalRestoreViewpoint = bcfTopics.restoreViewpoint.bind(bcfTopics);
  bcfTopics.restoreViewpoint = async (topic: OBC.Topic) => {
    const targetGroup = table.value.find((row: any) => row.data && row.data.Guid === topic.guid);
    if (targetGroup) {
      table.selection.clear();
      table.selection.add(targetGroup.data);
    }

    const now = Date.now();
    const isDoubleClick = lastClickedTopicId === topic.guid && (now - lastClickTime) < 300;
    lastClickedTopicId = topic.guid;
    lastClickTime = now;

    if (isDoubleClick) {
      onUpdateTopicModalOpen();
    } else {
      await originalRestoreViewpoint(topic);
    }
  };

  let topicCountBeforeNew = 0;
  const onNewTopicModalOpen = () => {
    topicCountBeforeNew = bcfTopics.list.size;
    newTopicModal.showModal();
  };

  newTopicModal.addEventListener("close", () => {
    if (bcfTopics.list.size > topicCountBeforeNew) {
      setTimeout(() => {
        const topicsArray = Array.from(bcfTopics.list.values());
        if (topicsArray.length > 0) {
          const newTopic = topicsArray[topicsArray.length - 1];
          const targetGroup = table.value.find((row: any) => row.data && row.data.Guid === newTopic.guid);
          if (targetGroup) {
            table.selection.clear();
            table.selection.add(targetGroup.data);
          }
        }
      }, 150);
    }
  });

  const onUpdateTopicModalOpen = () => {
    // 모달을 열기 전, 현재 선택되어 있는 토픽들의 고유 ID(Guid)를 배열에 저장합니다.
    const selectedGuids = Array.from(table.selection).map((data: any) => data.Guid);

    updateTopicModal.showModal(table.selection);

    // 모달이 닫히면 테이블 데이터가 갱신되면서 선택이 해제되므로, 딜레이를 조금 준 후 이전 선택 상태를 복원합니다.
    updateTopicModal.modal.addEventListener("close", () => {
      setTimeout(() => {
        for (const guid of selectedGuids) {
          const targetGroup = table.value.find((row: any) => row.data && row.data.Guid === guid);
          if (targetGroup) {
            table.selection.add(targetGroup.data);
          }
        }
      }, 150);
    }, { once: true });
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