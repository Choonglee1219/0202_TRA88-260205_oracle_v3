import * as BUI from "@thatopen/ui";
import * as CUI from "@thatopen/ui-obc";
import * as OBC from "@thatopen/components";
import { appIcons } from "../../globals";
import { SharedModel } from './../../bim-components/SharedModel';
import { PropertiesManager } from "../../bim-components/PropsManager";

export interface ModelsPanelState {
  components: OBC.Components;
}

export const modelsPanelTemplate: BUI.StatefullComponent<ModelsPanelState> = (
  state,
) => {
  const { components } = state;

  const ifcLoader = components.get(OBC.IfcLoader);
  const fragments = components.get(OBC.FragmentsManager);
  
  const [modelsList] = CUI.tables.modelsList({
    components,
    actions: {
      visibility: true,
      download: true,
      dispose: true,
    },
  });
  
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
      await onLoad(file, target);
      target.loading = false;
      BUI.ContextMenu.removeMenus();
    });

    input.addEventListener("cancel", () => (target.loading = false));

    input.click();
  };

  const onAddIfcModel = createFileInputHandler(".ifc", false, async (file) => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const model = await ifcLoader.load(bytes, true, file.name.replace(".ifc", ""));
    (model as any).name = file.name.replace(".ifc", "");
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
      const success = await saveToDB(file);
      if (!success) {
        alert("DB 저장에 실패하여 모델 로딩을 취소합니다.");
      }
    }
  });

  const onAddFragmentsModel = createFileInputHandler(".frag", false, async (file) => {
    const buffer = await file.arrayBuffer();
    await fragments.core.load(buffer, { modelId: file.name.replace(".frag", "") });
  });
  
  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    modelsList.queryString = input.value;
  };
  
  const onSave = async ({ target }: { target: BUI.Button }) => {
    target.loading = true;
    const models = [...fragments.list.values()];
    for (const model of models) {
      // if (id.includes("DELTA")) continue
      if (model.isDeltaModel) continue;
      await fragments.core.editor.save(model.modelId);
    }
    target.loading = false;
  };

  // Create SharedModel instace (bim-components).
  const sharedModel = new SharedModel();

  const saveToDB = async (file: File) => {
    const success = await sharedModel.saveIFC(file);
    if (success) {
      alert(`데이터베이스에 저장되었습니다.`);
      await refreshSharedModels();
    } else {
      alert("DB 저장 중 오류가 발생하였습니다.");
    }
    return success;
  };
  
  const loadIFCModel = async (ifcId: number) => {
    const ifc = await sharedModel.loadIFC(ifcId);
    if (ifc && ifc.content) {
      const model = await ifcLoader.load(ifc.content, true, ifc.name);
      (model as any).name = ifc.name;
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
      if (modelId) globalProps.loadedFiles.set(modelId, ifc.content);
    }
  };
  
    const downloadIFCModel = async (ifcId: number) => {
      const ifc = await sharedModel.loadIFC(ifcId);
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
      }
    };

  const deleteIFCModel = async (ifcId: number) => {
    if (!confirm("데이터베이스에서 삭제하시겠습니까?")) return;
    const success = await sharedModel.deleteIFC(ifcId);
    if (success) {
      alert("데이터베이스에서 삭제되었습니다.");
      await refreshSharedModels();
    } else {
      alert("IFC 파일 삭제에 실패하였습니다.");
    }
  };

  type SharedModelsState = {
    files: { id: number; name: string }[];
  };

  const creator: BUI.StatefullComponent<SharedModelsState> = (
    state,
  ) => {
    const { files } = state;
    return BUI.html`
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${files.length > 0
          ? files.map(
              (file) => BUI.html`
                <div style="display: flex; gap: 0.375rem; align-items: center;">
                  <bim-label style="flex: 1;">${file.name}</bim-label>
                  <bim-button style="flex: 0;" @click=${() => loadIFCModel(file.id)} icon=${appIcons.OPEN} tooltip-title="Load Model"></bim-button>
                  <bim-button style="flex: 0;" @click=${() => downloadIFCModel(file.id)} icon=${appIcons.DOWNLOAD} tooltip-title="Download Model"></bim-button>
                  <bim-button style="flex: 0;" @click=${() => deleteIFCModel(file.id)} icon=${appIcons.DELETE} tooltip-title="Delete Model"></bim-button>
                </div>
              `,
            )
          : BUI.html`<div style="color: var(--bim-ui_gray-6); font-size: 0.75rem;">⚠️ No shared models available</div>`}
      </div>
    `;
  };

  const [sharedModelsList, updateSharedModelsList] = BUI.Component.create(creator, { files: [] });

  const refreshSharedModels = async () => {
    sharedModel.list = [];
    await sharedModel.loadIFCFiles();
    updateSharedModelsList({ files: sharedModel.list });
  };

  refreshSharedModels();

  return BUI.html`
    <bim-panel-section icon=${appIcons.MODEL} label="Models">
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
      <div style="display: flex; flex-direction: column; gap: 0.5rem; color: var(--bim-ui_gray-10); border: 1px solid var(--bim-ui_bg-contrast-20); border-radius: 4px; padding: 0.5rem;">${modelsList}</div>
      <div style="display: flex; flex-direction: column; gap: 0.5rem; color: var(--bim-ui_gray-10); border: 1px solid var(--bim-ui_bg-contrast-20); border-radius: 4px; padding: 0.5rem;">${sharedModelsList}</div>
    </bim-panel-section> 
  `;
};
