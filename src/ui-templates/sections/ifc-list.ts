import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { appIcons } from "../../globals";
import { SharedIFC } from '../../bim-components/SharedIFC';
import { SharedFRAG } from '../../bim-components/SharedFRAG';
import { PropertiesManager } from "../../bim-components/PropsManager";
import { BCFTopics } from "../../bim-components/BCFTopics";

export interface IFCListPanelState {
  components: OBC.Components;
}

export const ifcListPanelTemplate: BUI.StatefullComponent<IFCListPanelState> = (
  state,
) => {
  const { components } = state;
  
  const ifcLoader = components.get(OBC.IfcLoader);
  const fragments = components.get(OBC.FragmentsManager);
  const sharedIFC = new SharedIFC();
  const sharedFRAG = new SharedFRAG();
  const bcfTopics = components.get(BCFTopics);
  
  // --- Grouping 1단계: 사용자 정의 그룹 상태 관리 ---
  // 생성된 그룹 이름들을 저장 (기본적으로 분류되지 않은 항목들을 위해 'None' 할당)
  const savedGroups = localStorage.getItem("app_custom_groups");
  const parsedGroups = savedGroups ? JSON.parse(savedGroups) : [];
  const customGroups = new Set<string>(["None"]); // 항상 'None'이 첫 번째로 포함되도록 보장
  parsedGroups.forEach((g: string) => {
    if (g !== "None") customGroups.add(g);
  });
  let newGroupInput: BUI.TextInput;

  const saveGroupsToStorage = () => {
    localStorage.setItem("app_custom_groups", JSON.stringify(Array.from(customGroups)));
  };

  // 현재 선택된 필터용 그룹 상태
  let activeGroupFilter: string | null = null;
  let sharedModelLabel: BUI.Label;

  // 그룹별 아이템 개수를 계산하는 함수
  const getGroupCounts = () => {
    const counts: Record<string, number> = {};
    for (const g of customGroups) {
      counts[g] = 0;
    }
    for (const file of sharedFRAG.list) {
      let g = fragGroups.get(file.id) || "None";
      if (!customGroups.has(g)) g = "None";
      counts[g] = (counts[g] || 0) + 1;
    }
    return counts;
  };

  let refreshBadges: () => void;

  const onBadgeClick = (groupName: string) => {
    // 같은 그룹을 다시 클릭하면 필터 해제, 아니면 해당 그룹으로 필터링
    activeGroupFilter = activeGroupFilter === groupName ? null : groupName;
    if (refreshBadges) refreshBadges();
    updateIFCTableData();
    updateFRAGTableData();
  };

  // 그룹 삭제 이벤트 핸들러
  const onDeleteGroup = (groupName: string) => {
    if (!confirm(`'${groupName}' 그룹을 삭제하시겠습니까?\n해당 그룹에 속한 모델들은 자동으로 'None'으로 변경됩니다.`)) return;
    
    customGroups.delete(groupName);
    saveGroupsToStorage();
    
    // 만약 현재 필터링 중이던 그룹을 삭제했다면 필터 초기화
    if (activeGroupFilter === groupName) {
      activeGroupFilter = null;
    }

    // 해당 그룹에 속해있던 파일들을 'None'으로 이동
    for (const [id, g] of fragGroups.entries()) {
      if (g === groupName) fragGroups.set(id, "None");
    }
    saveFragGroupsToStorage();

    // 해당 그룹에 속해있던 IFC 파일들을 'None'으로 이동
    for (const [id, g] of ifcGroups.entries()) {
      if (g === groupName) ifcGroups.set(id, "None");
    }
    saveIfcGroupsToStorage();
    
    if (refreshBadges) refreshBadges();
    updateIFCTableData();
    updateFRAGTableData();
  };

  // 그룹 뱃지 UI 컴포넌트 생성
  type CustomGroupsState = { groups: string[], activeFilter: string | null, counts: Record<string, number> };
  const groupsCreator: BUI.StatefullComponent<CustomGroupsState> = (state) => {
    return BUI.html`
      <div style="display: flex; flex-wrap: wrap; gap: 0.375rem; margin-bottom: 0.5rem;">
        ${state.groups.map(g => {
          const isActive = state.activeFilter === g;
          const bg = isActive ? "var(--bim-ui_main-base)" : "var(--bim-ui_bg-contrast-20)";
          const color = isActive ? "var(--bim-ui_main-contrast)" : "inherit";

          if (g === "None") {
            return BUI.html`
              <div @click=${() => onBadgeClick(g)} style="display: flex; align-items: center; background: ${bg}; color: ${color}; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; transition: all 0.2s ease;">
                <bim-label style="font-size: 0.75rem; cursor: pointer;">${g} (${state.counts[g] || 0})</bim-label>
              </div>
            `;
          }
          return BUI.html`
            <div @click=${() => onBadgeClick(g)} style="display: flex; align-items: center; background: ${bg}; color: ${color}; padding: 0.125rem 0.25rem 0.125rem 0.5rem; border-radius: 4px; gap: 0.25rem; cursor: pointer; transition: all 0.2s ease;">
              <bim-label style="font-size: 0.75rem; cursor: pointer;">${g} (${state.counts[g] || 0})</bim-label>
              <bim-button @click=${(e: Event) => { e.stopPropagation(); onDeleteGroup(g); }} icon=${appIcons.CLEAR} style="flex: 0; padding: 0; min-height: auto; background: transparent; border: none; color: ${isActive ? 'var(--bim-ui_main-contrast)' : 'var(--bim-ui_main-base)'}; cursor: pointer;" tooltip-title="그룹 삭제"></bim-button>
            </div>
          `;
        })}
      </div>
    `;
  };
  const [groupBadges, updateGroupBadges] = BUI.Component.create(groupsCreator, { groups: Array.from(customGroups), activeFilter: activeGroupFilter, counts: {} });

  refreshBadges = () => {
    updateGroupBadges({ groups: Array.from(customGroups), activeFilter: activeGroupFilter, counts: getGroupCounts() });
  };

  type LoadedModelsState = {
    models: any[];
  };

  let updateLoadedModelsList: () => void = () => {};

  const loadedModelsCreator: BUI.StatefullComponent<LoadedModelsState> = (state) => {
    const { models } = state;
    return BUI.html`
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${models.length > 0
          ? models.map((model) => {
              const name = model.name || "Untitled";
              return BUI.html`
                <div style="display: flex; gap: 0.375rem; align-items: center;">
                  <bim-label style="flex: 1;">${name}</bim-label>
                  <bim-button style="flex: 0;" @click=${() => {
                    model.object.visible = !model.object.visible;
                    updateLoadedModelsList();
                  }} icon=${model.object.visible ? appIcons.SHOW : appIcons.HIDE} tooltip-title="Visibility"></bim-button>
                  <bim-button style="flex: 0;" @click=${() => {
                    model.dispose();
                  }} icon=${appIcons.CLEAR} tooltip-title="Dispose"></bim-button>
                </div>
              `;
            })
          : BUI.html`<div style="color: var(--bim-ui_gray-6); font-size: 0.75rem;">⚠️ No models loaded</div>`}
      </div>
    `;
  };

  const [modelsList, updateModelsList] = BUI.Component.create(loadedModelsCreator, { models: [] });

  updateLoadedModelsList = () => {
    const models = [...fragments.list.values()];
    updateModelsList({ models });
  };

  fragments.list.onItemUpdated.add(updateLoadedModelsList);
  fragments.list.onItemDeleted.add(updateLoadedModelsList);
  
  updateLoadedModelsList();
  
  const createFileInputHandler = (
    accept: string,
    multiple: boolean,
    onLoad: (file: File, target: BUI.Button) => Promise<void>,
  ) => async ({ target }: { target: BUI.Button }) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      target.loading = true;
      try {
        await onLoad(file, target);
      } catch (error) {
        console.error("Error loading file:", error);
        alert("파일 로드 중 오류가 발생했습니다. 콘솔을 확인하세요.");
      } finally {
        target.loading = false;
        BUI.ContextMenu.removeMenus();
      }
    });

    input.addEventListener("cancel", () => (target.loading = false));

    input.click();
  };

  const onAddIfcModel = createFileInputHandler(".ifc", false, async (file) => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const model = await ifcLoader.load(bytes, true, file.name.replace(".ifc", ""));
    (model as any).name = file.name.replace(".ifc", "");
    updateLoadedModelsList();
    const globalProps = components.get(PropertiesManager);
    let modelId = (model as any).uuid;
    if (!modelId) {
      for (const [id, m] of fragments.list) {
        if (m === model) {
          modelId = id;
          break;
        }
      }
    }
    if (modelId) globalProps.loadedFiles.set(modelId, bytes);
    if (confirm("데이터베이스에 저장하시겠습니까?")) {
      console.log("Exporting FRAG...");
      const fragData = await (model as any).getBuffer(false);
      console.log("FRAG exported.");
      const fragFile = new File([fragData], file.name.replace(".ifc", ".frag"));

      console.log("Saving IFC to DB...");
      const ifcid = await sharedIFC.saveIFC(file);
      console.log("IFC saved, ID:", ifcid);
      let fragid = null;
      if (ifcid) {
        console.log("Saving FRAG to DB...");
        fragid = await sharedFRAG.saveFRAG(fragFile);
        console.log("FRAG saved, ID:", fragid);
      }

      console.log("Debug: ifcid =", ifcid, "fragid =", fragid);

      if (ifcid && fragid) {
        alert("IFC 및 FRAG 파일이 데이터베이스에 저장되었습니다.");
        (model as any).dbId = ifcid;
        sharedIFC.addModelUUID(ifcid, modelId);
        sharedFRAG.addModelUUID(fragid, modelId);
        console.log(`IFC DB 저장 ID: ${ifcid}, FRAG DB 저장 ID: ${fragid}, Model UUID: ${modelId}`);
        bcfTopics.onRefresh.trigger();
        await refreshSharedIFCList();
        await refreshSharedFRAGList();
      } else {
        alert("DB 저장 중 오류가 발생하였습니다.");
      }
    }
  });

  const onAddFragmentsModel = createFileInputHandler(".frag", false, async (file) => {
    const buffer = await file.arrayBuffer();
    const model = await fragments.core.load(buffer, { modelId: file.name.replace(".frag", "") });
    (model as any).name = file.name.replace(".frag", "");
    updateLoadedModelsList();
  });
  
  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    const value = input.value.toLowerCase();
    const models = [...fragments.list.values()].filter(model => 
      ((model as any).name || "").toLowerCase().includes(value)
    );
    updateModelsList({ models });

    // FRAG 테이블은 자체 검색 기능을 사용합니다.
    fragTable.queryString = input.value;
    // IFC 테이블도 자체 검색 기능을 사용합니다.
    ifcTable.queryString = input.value;
  };
  
  const onSave = async ({ target }: { target: BUI.Button }) => {
    target.loading = true;
    const models = [...fragments.list.values()];
    for (const model of models) {
      // if (id.includes("DELTA")) continue
      if (model.isDeltaModel) continue;
      const buffer = await (model as any).getBuffer(false);
      const blob = new Blob([buffer], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(model as any).name || "model"}.frag`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    target.loading = false;
  };

  const loadIFCModel = async (ifcid: number) => {
    const ifc = await sharedIFC.loadIFC(ifcid);
    if (ifc && ifc.content) {
      const model = await ifcLoader.load(ifc.content, true, ifc.name);
      (model as any).name = ifc.name;
      updateLoadedModelsList();
      (model as any).dbId = ifcid;
      const globalProps = components.get(PropertiesManager);
      let modelId = (model as any).uuid;
      if (!modelId) {
        for (const [id, m] of fragments.list) {
          if (m === model) {
            modelId = id;
            break;
          }
        }
      }
      if (modelId) {
        globalProps.loadedFiles.set(modelId, ifc.content);
        sharedIFC.addModelUUID(ifcid, modelId);
        fragments.list.set(modelId, model);
      }
    }
  };
  
    const downloadIFCModel = async (ifcid: number, cascade = true) => {
      const ifc = await sharedIFC.loadIFC(ifcid);
      if (ifc && ifc.content) {
        const blob = new Blob([ifc.content], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${ifc.name}.ifc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (cascade) {
          const fragFile = sharedFRAG.list.find(f => f.name === ifc.name);
          if (fragFile) {
            await downloadFRAGModel(fragFile.id, false);
          }
        }
      }
    };

  const deleteIFCModel = async (ifcid: number, cascade = true) => {
    const file = sharedIFC.list.find(f => f.id === ifcid);
    const name = file ? file.name : null;

    const success = await sharedIFC.deleteIFC(ifcid);
    if (success) {
      for (const [, model] of fragments.list) {
        if ((model as any).dbId === ifcid) {
          model.dispose();
        }
      }

      await refreshSharedIFCList();

      if (cascade && name) {
        const fragFile = sharedFRAG.list.find(f => f.name === name);
        if (fragFile) {
          await deleteFRAGModel(fragFile.id, false);
        }
      }
    } else {
      alert("IFC 파일 삭제에 실패하였습니다.");
    }
  };

  const loadFRAGModel = async (fragid: number) => {
    const frag = await sharedFRAG.loadFRAG(fragid);
    if (frag && frag.content) {
      const model = await fragments.core.load(frag.content, { modelId: frag.name });
      (model as any).name = frag.name;
      updateLoadedModelsList();
      (model as any).dbId = fragid;
      sharedFRAG.addModelUUID(fragid, (model as any).uuid);
      bcfTopics.onRefresh.trigger();
    }
  };
  
  const downloadFRAGModel = async (fragid: number, cascade = true) => {
    const frag = await sharedFRAG.loadFRAG(fragid);
    if (frag && frag.content) {
      const blob = new Blob([frag.content], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${frag.name}.frag`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (cascade) {
        const ifcFile = sharedIFC.list.find(f => f.name === frag.name);
        if (ifcFile) {
          await downloadIFCModel(ifcFile.id, false);
        }
      }
    }
  };

  const deleteFRAGModel = async (fragid: number, cascade = true) => {
    const file = sharedFRAG.list.find(f => f.id === fragid);
    const name = file ? file.name : null;

    if (cascade && name) {
      const ifcFile = sharedIFC.list.find(f => f.name === name);
      if (ifcFile) {
        if (!confirm("데이터베이스에서 삭제하시겠습니까?")) return;
        const ifcSuccess = await sharedIFC.deleteIFC(ifcFile.id);
        if (!ifcSuccess) {
          alert("연결된 IFC 파일 삭제에 실패하였습니다. (BCF 파일이 연결되어 있을 수 있습니다)");
          return;
        }
        for (const [, model] of fragments.list) {
          if ((model as any).dbId === ifcFile.id) {
            model.dispose();
          }
        }
        await refreshSharedIFCList();
      }
    }

    const success = await sharedFRAG.deleteFRAG(fragid);
    if (success) {
      for (const [, model] of fragments.list) {
        if ((model as any).dbId === fragid) {
          model.dispose();
        }
      }

      alert("데이터베이스에서 삭제되었습니다.");
      await refreshSharedFRAGList();
    } else {
      alert("FRAG 파일 삭제에 실패하였습니다.");
    }
  };

  // --- Grouping 2단계: FRAG 모델 테이블 및 상태 정의 ---
  const savedFragGroups = localStorage.getItem("app_frag_groups");
  const parsedFragGroups = savedFragGroups ? JSON.parse(savedFragGroups) : [];
  const fragGroups = new Map<number, string>(); // 파일 ID를 키로 하여 그룹명을 저장
  for (const [id, group] of parsedFragGroups) {
    fragGroups.set(id, group);
  }

  const saveFragGroupsToStorage = () => {
    localStorage.setItem("app_frag_groups", JSON.stringify(Array.from(fragGroups.entries())));
  };

  type FRAGTableData = {
    id: number;
    Name: string;
    Group: string;
    _isComputedGroup?: boolean;
    groupedBy?: string[];
    [key: string]: any;
  };

  const fragTable = document.createElement("bim-table") as BUI.Table<FRAGTableData>;
  fragTable.hiddenColumns = ["id", "Group"]; // Group 컬럼도 숨기고 Name 컬럼 안에 전부 통합하여 렌더링
  (fragTable as any).groupedBy = ["Group"];
  fragTable.headersHidden = true; // 1. 컬럼명 라인 숨김
  fragTable.expanded = true; // 기본적으로 그룹을 펼쳐서 보여줌

  const updateFRAGTableData = () => {
    const filteredList = activeGroupFilter 
      ? sharedFRAG.list.filter(file => {
          let groupName = fragGroups.get(file.id) || "None";
          if (!customGroups.has(groupName)) groupName = "None";
          return groupName === activeGroupFilter;
        })
      : sharedFRAG.list;

    fragTable.data = filteredList.map(file => {
      let groupName = fragGroups.get(file.id) || "None";
      // customGroups에 없는 그룹이 할당되어 있다면 'None'으로 리셋 (Select 오작동 방지)
      if (!customGroups.has(groupName)) groupName = "None";
      return {
        data: {
          id: file.id,
          Name: file.name,
          Group: groupName,
        }
      };
    });
  };

  // 커스텀 UI 렌더링 설정 (Name 컬럼 하나에 Flexbox를 사용해 빽빽하게 배치)
  fragTable.dataTransform = {
    Name: (value, rowData) => {
      const id = rowData.id as number;
      const currentGroup = rowData.Group as string;
      const name = value as string;
      
      return BUI.html`
        <div style="display: flex; align-items: center; width: 100%; gap: 0.5rem; overflow: hidden;">
          <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title=${name}>
            <bim-label>${name}</bim-label>
          </div>
          
          <div style="flex: 0 0 auto;">
            <select @change=${(e: Event) => {
              const select = e.target as HTMLSelectElement;
              fragGroups.set(id, select.value);
              saveFragGroupsToStorage();
              updateFRAGTableData();
              if (refreshBadges) refreshBadges();
            }} style="padding: 0.25rem; border-radius: 4px; background: var(--bim-ui_bg-contrast-20); color: inherit; border: none; outline: none; cursor: pointer; width: 60px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
              ${Array.from(customGroups).map(g => BUI.html`<option value="${g}" ?selected=${g === currentGroup}>${g}</option>`)}
            </select>
          </div>
          
          <div style="flex: 0 0 auto; display: flex; gap: 0.25rem;">
            <bim-button @click=${() => loadFRAGModel(id)} icon=${appIcons.OPEN} tooltip-title="Load Model"></bim-button>
            <bim-button @click=${() => downloadFRAGModel(id)} icon=${appIcons.DOWNLOAD} tooltip-title="Download Model"></bim-button>
            <bim-button @click=${() => deleteFRAGModel(id)} icon=${appIcons.DELETE} tooltip-title="Delete Model"></bim-button>
          </div>
        </div>
      `;
    },
    Group: (value, _rowData, group) => {
      if (group && ((group as any)._isComputedGroup || (group.data as any)?._isComputedGroup)) {
        return BUI.html`<bim-label icon="material-symbols:folder-open" style="font-weight: bold;">${value}</bim-label>`;
      }
      return value;
    }
  };

  // --- Grouping 2단계: IFC 모델 테이블 및 상태 정의 ---
  const savedIfcGroups = localStorage.getItem("app_ifc_groups");
  const parsedIfcGroups = savedIfcGroups ? JSON.parse(savedIfcGroups) : [];
  const ifcGroups = new Map<number, string>(); // 파일 ID를 키로 하여 그룹명을 저장
  for (const [id, group] of parsedIfcGroups) {
    ifcGroups.set(id, group);
  }

  const saveIfcGroupsToStorage = () => {
    localStorage.setItem("app_ifc_groups", JSON.stringify(Array.from(ifcGroups.entries())));
  };

  type IFCTableData = {
    id: number;
    Name: string;
    Group: string;
    _isComputedGroup?: boolean;
    groupedBy?: string[];
    [key: string]: any;
  };

  const ifcTable = document.createElement("bim-table") as BUI.Table<IFCTableData>;
  ifcTable.hiddenColumns = ["id", "Group"];
  (ifcTable as any).groupedBy = ["Group"];
  ifcTable.headersHidden = true;
  ifcTable.expanded = true;

  const updateIFCTableData = () => {
    const filteredList = activeGroupFilter 
      ? sharedIFC.list.filter(file => {
          let groupName = ifcGroups.get(file.id) || "None";
          if (!customGroups.has(groupName)) groupName = "None";
          return groupName === activeGroupFilter;
        })
      : sharedIFC.list;

    ifcTable.data = filteredList.map(file => {
      let groupName = ifcGroups.get(file.id) || "None";
      if (!customGroups.has(groupName)) groupName = "None";
      return {
        data: {
          id: file.id,
          Name: file.name,
          Group: groupName,
        }
      };
    });
  };

  ifcTable.dataTransform = {
    Name: (value, rowData) => {
      const id = rowData.id as number;
      const currentGroup = rowData.Group as string;
      const name = value as string;
      
      return BUI.html`
        <div style="display: flex; align-items: center; width: 100%; gap: 0.5rem; overflow: hidden;">
          <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title=${name}>
            <bim-label>${name}</bim-label>
          </div>
          <div style="flex: 0 0 auto;">
            <select @change=${(e: Event) => {
              const select = e.target as HTMLSelectElement;
              ifcGroups.set(id, select.value);
              saveIfcGroupsToStorage();
              updateIFCTableData();
              if (refreshBadges) refreshBadges();
            }} style="padding: 0.25rem; border-radius: 4px; background: var(--bim-ui_bg-contrast-20); color: inherit; border: none; outline: none; cursor: pointer; width: 60px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
              ${Array.from(customGroups).map(g => BUI.html`<option value="${g}" ?selected=${g === currentGroup}>${g}</option>`)}
            </select>
          </div>
          <div style="flex: 0 0 auto; display: flex; gap: 0.25rem;">
            <bim-button @click=${() => loadIFCModel(id)} icon=${appIcons.OPEN} tooltip-title="Load Model"></bim-button>
            <bim-button @click=${() => downloadIFCModel(id)} icon=${appIcons.DOWNLOAD} tooltip-title="Download Model"></bim-button>
            <bim-button @click=${() => deleteIFCModel(id)} icon=${appIcons.DELETE} tooltip-title="Delete Model"></bim-button>
          </div>
        </div>
      `;
    },
    Group: (value, _rowData, group) => {
      if (group && ((group as any)._isComputedGroup || (group.data as any)?._isComputedGroup)) {
        return BUI.html`<bim-label icon="material-symbols:folder-open" style="font-weight: bold;">${value}</bim-label>`;
      }
      return value;
    }
  };

  const refreshSharedIFCList = async () => {
    sharedIFC.list = [];
    await sharedIFC.loadIFCFiles();
    sharedIFC.list.sort((a, b) => a.name.localeCompare(b.name));
    updateIFCTableData();
  };

  const refreshSharedFRAGList = async () => {
    sharedFRAG.list = [];
    await sharedFRAG.loadFRAGFiles();
    if (sharedModelLabel) {
      sharedModelLabel.textContent = `Shared Model (${sharedFRAG.list.length})`;
    }
    if (refreshBadges) refreshBadges();
    updateFRAGTableData();
  };

  refreshSharedIFCList();
  refreshSharedFRAGList();

  // 새 그룹 생성 이벤트 핸들러
  const onCreateGroup = () => {
    const groupName = newGroupInput.value.trim();
    if (!groupName) {
      alert("생성할 그룹 이름을 입력해주세요.");
      return;
    }
    if (customGroups.has(groupName)) {
      alert("이미 존재하는 그룹 이름입니다.");
      return;
    }
    customGroups.add(groupName);
    saveGroupsToStorage();
    newGroupInput.value = "";
    if (refreshBadges) refreshBadges(); // 뱃지 리스트 갱신
    alert(`'${groupName}' 그룹이 생성되었습니다.`);
    updateIFCTableData();
    updateFRAGTableData(); // 드롭다운 옵션에 새 그룹을 반영하기 위해 테이블 갱신
  };

  return BUI.html`
    <bim-panel-section icon=${appIcons.MODEL} label="IFC List">
      <div style="display: flex; gap: 0.5rem;">
        <bim-text-input @input=${onSearch} vertical placeholder="Search..." debounce="200"></bim-text-input>
        <bim-button style="flex: 0;" icon=${appIcons.ADD}>
          <bim-context-menu style="gap: 0.25rem;">
            <bim-button label="IFC" @click=${onAddIfcModel}></bim-button>
            <bim-button label="Fragments" @click=${onAddFragmentsModel}></bim-button>
          </bim-context-menu> 
        </bim-button>
        <bim-button style="flex: 0" icon=${appIcons.SAVE} @click=${onSave}></bim-button>
      </div>
      <bim-label>Loaded Model</bim-label>
      <div style="display: flex; flex-direction: column; gap: 0.5rem; color: var(--bim-ui_gray-10); border: 1px solid var(--bim-ui_bg-contrast-20); border-radius: 4px; padding: 0.5rem;">${modelsList}</div>
      
      <bim-label>Group Management</bim-label>
      ${groupBadges}
      <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
        <bim-text-input ${BUI.ref((e) => newGroupInput = e as BUI.TextInput)} placeholder="Enter new group name..." vertical style="flex: 1;"></bim-text-input>
        <bim-button @click=${onCreateGroup} icon=${appIcons.ADD} label="Group" style="flex: 0;"></bim-button>
      </div>

      <bim-label ${BUI.ref((e) => { 
        sharedModelLabel = e as BUI.Label; 
        sharedModelLabel.textContent = `Shared Model (${sharedFRAG.list.length})`; 
      })}>Shared Model</bim-label>
      <div style="display: flex; flex-direction: column; gap: 0.5rem; color: var(--bim-ui_gray-10); border: 1px solid var(--bim-ui_bg-contrast-20); border-radius: 4px; padding: 0.5rem; overflow-y: auto; max-height: 400px;">
        ${fragTable}
      </div>
    </bim-panel-section> 
  `;
};
