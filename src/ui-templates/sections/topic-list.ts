import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { BCFTopics, newTopic, updateTopic } from "../../bim-components/BCFTopics";
import { topicsList, clashMatrix } from "../../ui-components/TopicsList";
import { appIcons, onToggleSection } from "../../globals";
import { Topic as EngineTopic, BCFTopics as EngineBCFTopics } from "../../engine-components/BCFTopics";
import { users } from "../../setup/users";

export interface TopicListState {
  components: OBC.Components;
  view?: "list" | "new" | "update";
}

export const topicListTemplate: BUI.StatefullComponent<
  TopicListState
> = (state) => {
  const { components } = state;
  const bcfTopics = components.get(BCFTopics);
  const [topicListTable, updateTopicListTable] = topicsList({ components });
  
  let panelSection: BUI.PanelSection;
  const updateTopicCount = () => {
    if (!panelSection) return;
    let open = 0, assigned = 0, closed = 0, resolved = 0, total = 0;
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

  let listContainer: HTMLDivElement;
  let newContainer: HTMLDivElement;
  let updateContainer: HTMLDivElement;

  const setView = (view: "list" | "new" | "update") => {
    if (listContainer) listContainer.style.display = view === "list" ? "flex" : "none";
    if (newContainer) newContainer.style.display = view === "new" ? "flex" : "none";
    if (updateContainer) updateContainer.style.display = view === "update" ? "flex" : "none";
    
    if (panelSection) {
      if (view === "new") panelSection.label = "New Topic";
      else if (view === "update") panelSection.label = "Update Topic";
      else updateTopicCount();
    }
  };

  // --- Pagination State ---
  let currentPage = 0;
  const pageSize = 30;
  let totalItems = 0;
  let totalPages = 0;
  let currentTopicsCache: any[] = [];
  let activeFilterGuids: Set<string> | null = null;
  let searchQuery = "";

  // --- Pagination UI Refs ---
  let paginationContainer: HTMLDivElement;
  let pageInfoLabel: BUI.Label;
  let prevButton: BUI.Button;
  let nextButton: BUI.Button;

  const updatePage = () => {
    const start = currentPage * pageSize;
    const end = start + pageSize;
    const slicedTopics = currentTopicsCache.slice(start, end);

    updateTopicListTable({ topics: slicedTopics });

    if (paginationContainer) {
      paginationContainer.style.display = totalPages > 1 ? "flex" : "none";
    }
    if (pageInfoLabel) {
      pageInfoLabel.textContent = `Page ${currentPage + 1} / ${totalPages}`;
    }
    if (prevButton) {
      prevButton.disabled = currentPage === 0;
    }
    if (nextButton) {
      nextButton.disabled = currentPage >= totalPages - 1;
    }
  };

  const refreshTopicsCache = () => {
    let allTopics = Array.from(bcfTopics.list.values());

    if (activeFilterGuids) {
      allTopics = allTopics.filter(t => activeFilterGuids!.has(t.guid));
    }

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      allTopics = allTopics.filter(t => {
        const title = (t as any).title || "";
        const description = (t as any).description || "";
        return title.toLowerCase().includes(lowerQuery) || description.toLowerCase().includes(lowerQuery);
      });
    }

    currentTopicsCache = allTopics;
    totalItems = currentTopicsCache.length;
    totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (currentPage >= totalPages) currentPage = Math.max(0, totalPages - 1);

    updatePage();
  };

  const onPrevPage = () => {
    if (currentPage > 0) {
      currentPage--;
      updatePage();
    }
  };

  const onNextPage = () => {
    if (currentPage < totalPages - 1) {
      currentPage++;
      updatePage();
    }
  };

  const [matrixPanel] = clashMatrix({ 
    components,
    onCellClicked: (topicGuids) => {
      activeFilterGuids = topicGuids || null;
      currentPage = 0;
      refreshTopicsCache();
    }
  });
  matrixPanel.label = ""; // 커스텀 토글 UI를 사용하기 위해 기존 속성 제거
  matrixPanel.style.minWidth = "0"; // 부모 영역을 벗어나지 않도록 설정
  matrixPanel.style.width = "100%";
  matrixPanel.style.boxSizing = "border-box";

  const [newTopicForm, updateNewTopicForm] = newTopic(components);
  const { panel: updateTopicPanel, show: showUpdateTopic } = updateTopic(bcfTopics);

  bcfTopics.setupTable(topicListTable);

  // 테이블에서 토픽 제목(Title) 클릭 시 Viewpoint가 복원되는 기존 동작에 추가로, 해당 테이블 행이 자동으로 선택되도록 동작 확장
  let lastClickedTopicId: string | null = null;
  let lastClickTime = 0;

  const originalRestoreViewpoint = bcfTopics.restoreViewpoint.bind(bcfTopics);
  bcfTopics.restoreViewpoint = async (topic: EngineTopic, options?: { updateSnapshot?: boolean, viewpointGuid?: string }): Promise<boolean> => {
    const targetGroup = topicListTable.value?.find((row: any) => row.data && row.data.Guid === topic.guid);
    if (targetGroup) {
      topicListTable.selection.clear();
      topicListTable.selection.add(targetGroup.data);
    }

    const now = Date.now();
    const isDoubleClick = lastClickedTopicId === topic.guid && (now - lastClickTime) < 300;
    lastClickedTopicId = topic.guid;
    lastClickTime = now;

    if (isDoubleClick) {
      onUpdateTopicOpen();
      return false;
    } else {
      return originalRestoreViewpoint(topic, options);
    }
  };

  let topicCountBeforeNew = 0;
  const onNewTopicOpen = () => {
    topicCountBeforeNew = bcfTopics.list.size;
    updateNewTopicForm({
      components,
      styles: { users },
      onCancel: () => { setView("list"); },
      onSubmit: () => {
        setView("list");
        
        setTimeout(() => {
          const bcfTopicsEngine = components.get(EngineBCFTopics);
          const worlds = components.get(OBC.Worlds);
          const world = worlds.list.values().next().value;
          if (world && world.renderer) {
            world.renderer.three.render(world.scene.three, world.camera.three);
            const dataUrl = world.renderer.three.domElement.toDataURL("image/png");
            
            const topicsArray = Array.from(bcfTopicsEngine.list.values());
            if (topicsArray.length > 0) {
              const lastTopic = topicsArray[topicsArray.length - 1];
              (lastTopic as any).snapshot = dataUrl;
              bcfTopicsEngine.list.onItemUpdated.trigger({ key: lastTopic.guid, value: lastTopic });
            }
          }
        }, 100);

        alert("변경사항을 공유하려면 Save BCF 버튼을 눌러 데이터베이스에 저장하십시오.");

        if (bcfTopics.list.size > topicCountBeforeNew) {
          setTimeout(() => {
            const topicsArray = Array.from(bcfTopics.list.values());
            if (topicsArray.length > 0) {
              const newTopic = topicsArray[topicsArray.length - 1];
              
              refreshTopicsCache(); // 캐시 즉시 동기화
              
              const newTopicIndex = currentTopicsCache.findIndex(t => t.guid === newTopic.guid);
              if (newTopicIndex !== -1) {
                currentPage = Math.floor(newTopicIndex / pageSize);
                updatePage();
              }
              
              const targetGroup = topicListTable.value.find((row: any) => row.data && row.data.Guid === newTopic.guid);
              if (targetGroup) {
                topicListTable.selection.clear();
                topicListTable.selection.add(targetGroup.data);
              }
            }
          }, 150);
        }
      },
    });
    setView("new");
  };

  const onUpdateTopicOpen = () => {
    const selectedGuids = Array.from(topicListTable.selection).map((data: any) => data.Guid);

    const switchBackAndRestoreSelection = () => {
      setView("list");
      setTimeout(() => {
        refreshTopicsCache();
        for (const guid of selectedGuids) {
          const targetGroup = topicListTable.value.find((row: any) => row.data && row.data.Guid === guid);
          if (targetGroup) {
            topicListTable.selection.add(targetGroup.data);
          }
        }
      }, 150);
    };

    showUpdateTopic(topicListTable.selection, {
      onCancel: switchBackAndRestoreSelection,
      onUpdate: switchBackAndRestoreSelection,
    });
    setView("update");
  };

  const onDeleteTopic = () => {
    bcfTopics.delete(topicListTable.selection);
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
    searchQuery = input.value;
    currentPage = 0;
    refreshTopicsCache();
    topicListTable.queryString = input.value; // 로컬 필터링 보조 유지
  };

  const onUpdateAllSnapshots = async (e: Event) => {
    const btn = (e.target as HTMLElement).closest("bim-button") as BUI.Button;
    if (btn) btn.loading = true;
    
    try {
      const worlds = components.get(OBC.Worlds);
      const world = worlds.list.values().next().value;
      if (!world || !world.renderer) {
        alert("렌더러를 찾을 수 없습니다.");
        return;
      }

      const topics = Array.from(bcfTopics.list.values());
      for (const topic of topics) {
        // restoreViewpoint가 스냅샷을 찍었는지 여부를 반환합니다.
        // Clash 토픽의 경우, 내부적으로 줌인 직후 스냅샷을 찍습니다.
        const snapshotTaken = await bcfTopics.restoreViewpoint(topic, { updateSnapshot: true });

        if (snapshotTaken) {
          // 스냅샷이 내부에서 이미 처리된 경우, UI만 업데이트하고 다음 토픽으로 넘어갑니다.
          bcfTopics.list.set(topic.guid, topic);
          await new Promise((resolve) => setTimeout(resolve, 100)); // UI가 멈추지 않도록 짧은 딜레이
        } else {
          // Clash 토픽이 아닌 경우, 기존 로직대로 전체 뷰를 잡고 스냅샷을 찍습니다.
          // 카메라 이동 및 화면 렌더링이 완료될 때까지 잠시 대기
          await new Promise((resolve) => setTimeout(resolve, 800));

          // 화면 렌더링 후 스냅샷 데이터 추출 및 덮어쓰기
          world.renderer.three.render(world.scene.three, world.camera.three);
          const dataUrl = world.renderer.three.domElement.toDataURL("image/png");
          (topic as any).snapshot = dataUrl;
          
          // UI에 스냅샷 갱신을 반영
          bcfTopics.list.set(topic.guid, topic);
        }
      }

      alert("모든 토픽의 스냅샷이 성공적으로 업데이트되었습니다. 변경사항을 반영하려면 'Save BCF'를 눌러 데이터베이스에 저장하십시오.");
    } catch (err) {
      console.error(err);
      alert("스냅샷 업데이트 중 오류가 발생했습니다.");
    } finally {
      if (btn) btn.loading = false;
    }
  };

  let updateTopicCountTimeout: ReturnType<typeof setTimeout>;
  const debouncedUpdateTopicCount = () => {
    if (updateTopicCountTimeout) clearTimeout(updateTopicCountTimeout);
    updateTopicCountTimeout = setTimeout(() => {
      updateTopicCount();
      refreshTopicsCache();
    }, 500);
  };

  bcfTopics.onRefresh.add(debouncedUpdateTopicCount);
  bcfTopics.list.onItemSet.add(debouncedUpdateTopicCount);
  bcfTopics.list.onItemUpdated.add(debouncedUpdateTopicCount);
  bcfTopics.list.onItemDeleted.add(debouncedUpdateTopicCount);

  // 3D 화면에서 간섭 구(Sphere) 클릭 시, Topic List 테이블 행 자동 선택 및 줌인
  bcfTopics.onClashSphereClicked.add((guid) => {
    const targetIndex = currentTopicsCache.findIndex(t => t.guid === guid);
    if (targetIndex !== -1) {
      const targetPage = Math.floor(targetIndex / pageSize);
      if (currentPage !== targetPage) {
        currentPage = targetPage;
        updatePage();
      }
    }

    const targetGroup = topicListTable.value.find((row: any) => row.data && row.data.Guid === guid);
    if (targetGroup) {
      topicListTable.selection.clear();
      topicListTable.selection.add(targetGroup.data); // 테이블 체크박스 활성화

      const topic = bcfTopics.list.get(guid);
      if (topic) {
        bcfTopics.restoreViewpoint(topic); // 해당 구체로 자연스럽게 카메라 줌인
      }
    }
  });

  // 최초 로드시 전체 목록 캐싱 및 렌더링
  refreshTopicsCache();

  const topicListPanel = BUI.html`
    <div ${BUI.ref(e => listContainer = e as HTMLDivElement)} style="display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 0.5rem; overflow: hidden;">
      <div style="display: flex; gap: 0.5rem; flex-shrink: 0;">
        <div style="display: flex; gap: 0.25rem; flex: 1;">
          <bim-button style="flex: 1;" @click=${onNewTopicOpen} label="Create Topic" icon=${appIcons.ADD}></bim-button>
          <bim-button style="flex: 1;" @click=${onUpdateTopicOpen} label="Update Topic" icon=${appIcons.REF}></bim-button>
          <bim-button style="flex: 1;" @click=${onDeleteTopic} label="Delete Topic" icon=${appIcons.DELETE}></bim-button>
          <bim-button style="flex: 1;" @click=${onClearTopicsList} label="Clear List" icon=${appIcons.CLEAR}></bim-button>
          <bim-button style="flex: 1;" @click=${onUpdateAllSnapshots} label="Auto Snapshots" icon=${appIcons.CAMERA}></bim-button>
          <bim-button style="flex: 1;" @click=${onSaveTopicsToBCF} label="Save BCF" icon=${appIcons.SAVE}></bim-button>
          <bim-button style="flex: 1;" @click=${onExportTopicsToJSON} label="Send to TDVS" icon=${appIcons.EXPORT}></bim-button>
        </div>
        <div style="display: flex; gap: 0.5rem; flex: 1;">
          <bim-text-input @input=${onSearch} vertical placeholder="Search..." debounce="200" style="flex: 1;"></bim-text-input>
          <div ${BUI.ref(e => paginationContainer = e as HTMLDivElement)} style="display: none; gap: 0.25rem; align-items: center; justify-content: center; background: var(--bim-ui_bg-contrast-10); border-radius: 4px; padding: 0.125rem 0.25rem; flex-shrink: 0;">
            <bim-button ${BUI.ref(e => prevButton = e as BUI.Button)} @click=${onPrevPage} icon=${appIcons.BACK} tooltip-title="Previous Page" style="flex: 0; margin: 0;"></bim-button>
            <bim-label ${BUI.ref(e => pageInfoLabel = e as BUI.Label)} style="font-weight: bold; white-space: nowrap; margin: 0 0.25rem; font-size: 0.875rem;"></bim-label>
            <bim-button ${BUI.ref(e => nextButton = e as BUI.Button)} @click=${onNextPage} icon=${appIcons.FORWARD} tooltip-title="Next Page" style="flex: 0; margin: 0;"></bim-button>
          </div>
        </div>
      </div>

      <div style="flex: 1; display: flex; flex-direction: column; min-height: 0; border: 1px solid var(--bim-ui_bg-contrast-20); border-radius: 4px; overflow: hidden; min-width: 0;">
        ${topicListTable}
      </div>

      <div data-flex="false" style="display: flex; flex-direction: column; flex-shrink: 0; min-width: 0; max-width: 100%; border: 1px solid var(--bim-ui_bg-contrast-20); border-radius: 4px; overflow: hidden;">
        <div @click=${onToggleSection} style="display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 0.5rem; background-color: var(--bim-ui_bg-contrast-10);">
          <bim-label style="font-weight: bold; pointer-events: none;">Clash Matrix</bim-label>
          <bim-label class="toggle-icon" icon=${appIcons.RIGHT} style="pointer-events: none; --bim-icon--fz: 1.25rem;"></bim-label>
        </div>
        <div style="display: none; flex-direction: column; width: 100%; min-width: 0; box-sizing: border-box;">
          ${matrixPanel}
        </div>
      </div>
    </div>
  `;

  return BUI.html`
    <bim-panel-section ${BUI.ref((e) => { panelSection = e as BUI.PanelSection; updateTopicCount(); })} fixed icon=${appIcons.TASK} label="Topic List">
      ${topicListPanel}
      <div ${BUI.ref(e => newContainer = e as HTMLDivElement)} style="display: none; flex-direction: column; flex: 1; min-height: 0; overflow: hidden;">
        ${newTopicForm}
      </div>
      <div ${BUI.ref(e => updateContainer = e as HTMLDivElement)} style="display: none; flex-direction: column; flex: 1; min-height: 0; overflow: hidden;">
        ${updateTopicPanel}
      </div>
    </bim-panel-section>
  `;
};

export const topicList = (state: TopicListState) => {
  return BUI.Component.create<BUI.Panel, TopicListState>(topicListTemplate, state);
};