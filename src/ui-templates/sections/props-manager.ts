import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as WEBIFC from "web-ifc";
import { PropertiesManager } from "../../bim-components/PropsManager";
import { globalPropsList } from "../../bim-components/PropsManager/src/props-list";
import { assignPropsModal } from "../../bim-components/PropsManager/src/assign-props";
import { newPropModal } from "../../bim-components/PropsManager/src/new-prop";
import { appIcons } from "../../globals";

export interface GlobalPropsSectionState {
  components: OBC.Components;
}

export const globalPropsPanelTemplate: BUI.StatefullComponent<
  GlobalPropsSectionState
> = (state) => {
  const { components } = state;

  const [propsList, updatePropsList] = globalPropsList({ components });
  const globalProps = components.get(PropertiesManager);
  globalProps.list.onItemAdded.add(() => updatePropsList());

  const [newProps] = newPropModal({
    components,
    onSubmit: () => newProps.close(),
  });

  const [assignProps, updateAssignProps] = assignPropsModal({
    components,
    names: [],
    psets: [],
    onSubmit: () => assignProps.close(),
  });

  const onAdd = async () => {
    const selection = propsList.selection;
    const highlighter = components.get(OBF.Highlighter);
    const fragments = components.get(OBC.FragmentsManager);
    const modelIdMap = highlighter.selection.select;
    if (selection.size === 0) {
      alert("Please select a property from the list.");
      return;
    }
    if (Object.keys(modelIdMap).length === 0) {
      alert("Please select an element in the 3D view.");
      return;
    }
    const props = [...selection].map(({ Name }) => Name) as string[];
    const psets = new Set<string>();
    for (const [modelID, expressIDs] of Object.entries(modelIdMap)) {
      const model = fragments.list.get(modelID);
      if (!model) continue;
      const ids = Array.from(expressIDs);
      const itemsData = await model.getItemsData(ids, {
        attributesDefault: true,
        relationsDefault: { attributes: false, relations: false },
        relations: {
          IsDefinedBy: {
            attributes: true,
            relations: true,
          },
        },
      });
      for (const item of itemsData) {
        if (item.IsDefinedBy && Array.isArray(item.IsDefinedBy)) {
          for (const pset of item.IsDefinedBy) {
            if ((pset as any).Name?.value && Array.isArray((pset as any).HasProperties)) {
              psets.add((pset as any).Name.value);
            }
          }
        }
      }
    }
    if (psets.size === 0) {
      alert("No Property Sets found on the selected elements.");
      return;
    }
    propsList.selection = new Set();
    updateAssignProps({ names: props, psets: [...psets] });
    assignProps.showModal();
  };

  const onDownload = async ({ target }: { target: BUI.Button }) => {
    console.log("Download started");
    target.loading = true;
    const fragments = components.get(OBC.FragmentsManager);
    const globalProps = components.get(PropertiesManager);
    const ifcLoader = components.get(OBC.IfcLoader);

    console.log("Loaded files count:", globalProps.loadedFiles.size);
    if (globalProps.loadedFiles.size === 0) {
      alert("내보낼 수 있는 원본 IFC 모델이 없습니다.");
      target.loading = false;
      return;
    }

    for (const [modelId, originalBuffer] of globalProps.loadedFiles) {
      if (!modelId) continue;
      const model = fragments.list.get(modelId);
      if (!model) {
        console.warn(`Model ${modelId} not found in fragments list.`);
        continue;
      }

      const ifcApi = new WEBIFC.IfcAPI();
      let ifcModelId: number | null = null;

      try {
        const wasmSettings = ifcLoader.settings.wasm;
        if (wasmSettings) {
          ifcApi.SetWasmPath(wasmSettings.path, wasmSettings.absolute);
        } else {
          ifcApi.SetWasmPath("/", false);
        }

        console.log("Initializing WebIFC...");
        await ifcApi.Init();
        console.log("WebIFC Initialized");

        ifcModelId = ifcApi.OpenModel(new Uint8Array(originalBuffer));
        console.log("Model Opened", ifcModelId);
        const maxId = ifcApi.GetMaxExpressID(ifcModelId);
        let defaultOwnerHistory: any = null;
        const ownerHistories = ifcApi.GetLineIDsWithType(ifcModelId, WEBIFC.IFCOWNERHISTORY);
        if (ownerHistories.size() > 0) {
          defaultOwnerHistory = ifcApi.GetLine(ifcModelId, ownerHistories.get(0));
        }

        const { requests } = await (fragments.core as any).editor.getModelRequests(modelId);
        console.log("Requests retrieved", requests);

        if (requests) {
          for (const request of requests) {
            const originalId = request.localId;
            const payload = request.data;
            if (!payload) continue;

            let exists = true;
            if (originalId > maxId) {
              exists = false;
            } else {
              try {
                const l = ifcApi.GetLine(ifcModelId, originalId);
                if (!l) exists = false;
              } catch {
                exists = false;
              }
            }

            const props = payload.data || {};

            if (!exists && payload.category) {
              const typeId = (WEBIFC as any)[payload.category];
              if (typeId !== undefined) {
                const entity: any = ifcApi.CreateIfcEntity(ifcModelId, typeId);
                entity.expressID = originalId;
                if (entity.GlobalId === null || entity.GlobalId === undefined) {
                  const guid = ifcApi.CreateIFCGloballyUniqueId(ifcModelId);
                  entity.GlobalId = ifcApi.CreateIfcType(ifcModelId, WEBIFC.IFCGLOBALLYUNIQUEID, guid);
                }
                if ((entity.OwnerHistory === null || entity.OwnerHistory === undefined) && defaultOwnerHistory) {
                  entity.OwnerHistory = defaultOwnerHistory;
                }
                for (const key in props) {
                  const propVal = props[key];
                  if (key === "HasProperties" && Array.isArray(propVal)) {
                    entity[key] = propVal.map(id => ({ value: id, type: WEBIFC.REF }));
                  } else if (propVal && typeof propVal === "object" && "value" in propVal && "type" in propVal) {
                    let val = propVal.value;
                    if (propVal.type === WEBIFC.IFCBOOLEAN && typeof val === "string") {
                      val = val === "true" || val === "T";
                    } else if (propVal.type === WEBIFC.IFCINTEGER && typeof val === "string") {
                      val = parseInt(val, 10);
                    } else if (propVal.type === WEBIFC.IFCREAL && typeof val === "string") {
                      val = parseFloat(val);
                    }
                    entity[key] = ifcApi.CreateIfcType(ifcModelId, propVal.type, val);
                  } else {
                    entity[key] = propVal;
                  }
                }

                // web-ifc serializes undefined optional properties as '*', but the IFC standard requires '$'.
                // To solve this, we must explicitly set them to null before writing the line.
                if (payload.category === "IFCPROPERTYSINGLEVALUE") {
                  if (entity.Description === undefined) entity.Description = null;
                  if (entity.Unit === undefined) entity.Unit = null;
                }

                ifcApi.WriteLine(ifcModelId, entity);
              }
            } else if (exists) {
              try {
                const line = ifcApi.GetLine(ifcModelId, originalId);
                if (line) {
                  for (const key in props) {
                    const propVal = props[key];
                    if (key === "HasProperties" && Array.isArray(propVal)) {
                      line[key] = propVal.map(id => ({ value: id, type: WEBIFC.REF }));
                    } else if (propVal && typeof propVal === "object" && "value" in propVal && "type" in propVal) {
                      let val = propVal.value;
                      if (propVal.type === WEBIFC.IFCBOOLEAN && typeof val === "string") {
                        val = val === "true" || val === "T";
                      } else if (propVal.type === WEBIFC.IFCINTEGER && typeof val === "string") {
                        val = parseInt(val, 10);
                      } else if (propVal.type === WEBIFC.IFCREAL && typeof val === "string") {
                        val = parseFloat(val);
                      }
                      line[key] = ifcApi.CreateIfcType(ifcModelId, propVal.type, val);
                    } else {
                      line[key] = propVal;
                    }
                  }
                  ifcApi.WriteLine(ifcModelId, line);
                }
              } catch (e) {
                console.warn(`Error updating item ${originalId}`, e);
              }
            }
          }
        }

        const modifiedBuffer = ifcApi.SaveModel(ifcModelId);

        // Verify NominalValue wrapping
        try {
          const fileText = new TextDecoder().decode(modifiedBuffer);
          const regex = /IFCPROPERTYSINGLEVALUE\((?:'[^']*'|[^,]+),(?:'[^']*'|[^,]+),([^,)]+)/g;
          let match;
          let invalidCount = 0;
          while ((match = regex.exec(fileText)) !== null) {
            const nominalValue = match[1].trim();
            if (/^[-+]?[0-9]*\.?[0-9]+$/.test(nominalValue)) {
              console.warn("Potential unwrapped NominalValue:", nominalValue, "in:", match[0]);
              invalidCount++;
            }
          }
          if (invalidCount > 0) alert(`경고: ${invalidCount}개의 속성 값이 타입 래퍼 없이 저장되었습니다. 콘솔을 확인하세요.`);
        } catch (e) { console.warn("Verification failed", e); }

        console.log("Model saved, creating blob...");
        const blob = new Blob([modifiedBuffer as any], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(model as any).name || "model"}_modified.ifc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log("Download triggered");
      } catch (e) {
        console.error("Error during IFC export:", e);
        alert("IFC 파일 생성 중 오류가 발생했습니다.");
      } finally {
        if (ifcModelId !== null) {
          ifcApi.CloseModel(ifcModelId);
        }
      }
    }

    target.loading = false;
  };

  return BUI.html`
    <bim-panel-section label="Properties Manager" icon=${appIcons.REF} >
      ${propsList}
      <div style="display: flex; gap: 0.25rem">
        <bim-button label="Create" @click=${() => newProps.showModal()} icon=${appIcons.REF}></bim-button>
        <bim-button label="Assign" @click=${onAdd} icon=${appIcons.ADD}></bim-button>
        <bim-button label="Download" @click=${onDownload} icon=${appIcons.EXPORT}></bim-button>
      </div>
    </bim-panel-section>
  `;
};

export const globalPropsSection = (state: GlobalPropsSectionState) => {
  const component = BUI.Component.create<
    BUI.PanelSection,
    GlobalPropsSectionState
  >(globalPropsPanelTemplate, state);

  return component;
};
