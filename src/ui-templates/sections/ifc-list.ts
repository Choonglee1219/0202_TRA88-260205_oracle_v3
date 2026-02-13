import * as BUI from "@thatopen/ui";
import * as CUI from "@thatopen/ui-obc";
import * as OBC from "@thatopen/components";
import { appIcons } from "../../globals";
import { SharedIFC } from '../../bim-components/SharedIFC';
import { SharedFRAG } from '../../bim-components/SharedFRAG';
import { PropertiesManager } from "../../bim-components/PropsManager";

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
        fragments.list.set(modelId, model);
        await refreshSharedIFCList();
        await refreshSharedFRAGList();
      } else {
        alert("DB 저장 중 오류가 발생하였습니다.");
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
    const value = input.value.toLowerCase();
    const filteredIFC = sharedIFC.list.filter(file => file.name.toLowerCase().includes(value));
    updateSharedIFCList({ files: filteredIFC });
    const filteredFRAG = sharedFRAG.list.filter(file => file.name.toLowerCase().includes(value));
    updateSharedFRAGList({ files: filteredFRAG });
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

  const loadIFCModel = async (ifcid: number) => {
    const ifc = await sharedIFC.loadIFC(ifcid);
    if (ifc && ifc.content) {
      const model = await ifcLoader.load(ifc.content, true, ifc.name);
      (model as any).name = ifc.name;
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
  
    const downloadIFCModel = async (ifcid: number) => {
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
      }
    };

  const deleteIFCModel = async (ifcid: number) => {
    if (!confirm("데이터베이스에서 삭제하시겠습니까?")) return;
    const success = await sharedIFC.deleteIFC(ifcid);
    if (success) {
      alert("데이터베이스에서 삭제되었습니다.");
      await refreshSharedIFCList();
    } else {
      alert("IFC 파일 삭제에 실패하였습니다.");
    }
  };

  const loadFRAGModel = async (fragid: number) => {
    const frag = await sharedFRAG.loadFRAG(fragid);
    if (frag && frag.content) {
      const model = await fragments.core.load(frag.content, { modelId: frag.name });
      (model as any).name = frag.name;
      (model as any).dbId = fragid;
      sharedFRAG.addModelUUID(fragid, (model as any).uuid);
    }
  };
  
  const downloadFRAGModel = async (fragid: number) => {
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
    }
  };

  const deleteFRAGModel = async (fragid: number) => {
    if (!confirm("데이터베이스에서 삭제하시겠습니까?")) return;
    const success = await sharedFRAG.deleteFRAG(fragid);
    if (success) {
      alert("데이터베이스에서 삭제되었습니다.");
      await refreshSharedFRAGList();
    } else {
      alert("FRAG 파일 삭제에 실패하였습니다.");
    }
  };

  type SharedModelsState = {
    files: { id: number; name: string }[];
  };

  const creatorIFC: BUI.StatefullComponent<SharedModelsState> = (state) => {
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
          : BUI.html`<div style="color: var(--bim-ui_gray-6); font-size: 0.75rem;">⚠️ No shared IFC models available</div>`}
      </div>
    `;
  };

  const creatorFRAG: BUI.StatefullComponent<SharedModelsState> = (state) => {
    const { files } = state;
    return BUI.html`
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${files.length > 0
          ? files.map(
              (file) => BUI.html`
                <div style="display: flex; gap: 0.375rem; align-items: center;">
                  <bim-label style="flex: 1;">${file.name}</bim-label>
                  <bim-button style="flex: 0;" @click=${() => loadFRAGModel(file.id)} icon=${appIcons.OPEN} tooltip-title="Load Model"></bim-button>
                  <bim-button style="flex: 0;" @click=${() => downloadFRAGModel(file.id)} icon=${appIcons.DOWNLOAD} tooltip-title="Download Model"></bim-button>
                  <bim-button style="flex: 0;" @click=${() => deleteFRAGModel(file.id)} icon=${appIcons.DELETE} tooltip-title="Delete Model"></bim-button>
                </div>
              `,
            )
          : BUI.html`<div style="color: var(--bim-ui_gray-6); font-size: 0.75rem;">⚠️ No shared FRAG models available</div>`}
      </div>
    `;
  };

  const [sharedIFCList, updateSharedIFCList] = BUI.Component.create(creatorIFC, { files: [] });
  const [sharedFRAGList, updateSharedFRAGList] = BUI.Component.create(creatorFRAG, { files: [] });

  const refreshSharedIFCList = async () => {
    sharedIFC.list = [];
    await sharedIFC.loadIFCFiles();
    sharedIFC.list.sort((a, b) => a.name.localeCompare(b.name));
    updateSharedIFCList({ files: sharedIFC.list });
  };

  const refreshSharedFRAGList = async () => {
    sharedFRAG.list = [];
    await sharedFRAG.loadFRAGFiles();
    sharedFRAG.list.sort((a, b) => a.name.localeCompare(b.name));
    updateSharedFRAGList({ files: sharedFRAG.list });
  };

  refreshSharedIFCList();
  refreshSharedFRAGList();

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
      <div style="display: flex; flex-direction: column; gap: 0.5rem; color: var(--bim-ui_gray-10); border: 1px solid var(--bim-ui_bg-contrast-20); border-radius: 4px; padding: 0.5rem;">${modelsList}</div>
      <bim-label>Shared IFC</bim-label>
      <div style="display: flex; flex-direction: column; gap: 0.5rem; color: var(--bim-ui_gray-10); border: 1px solid var(--bim-ui_bg-contrast-20); border-radius: 4px; padding: 0.5rem;">${sharedIFCList}</div>
      <bim-label>Shared FRAG</bim-label>
      <div style="display: flex; flex-direction: column; gap: 0.5rem; color: var(--bim-ui_gray-10); border: 1px solid var(--bim-ui_bg-contrast-20); border-radius: 4px; padding: 0.5rem;">${sharedFRAGList}</div>
    </bim-panel-section> 
  `;
};
