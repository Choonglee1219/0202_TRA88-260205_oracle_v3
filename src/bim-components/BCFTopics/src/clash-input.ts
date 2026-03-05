import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import JSZip from "jszip";
import { SharedBCF } from "../../SharedBCF";
import { SharedIFC } from "../../SharedIFC";

const addClashInputStyles = () => {
  const styleId = "clash-input-modal-styles";
  if (document.getElementById(styleId)) return;
  const styles = `
    dialog.clash-input-modal::backdrop {
      backdrop-filter: blur(4px);
      background-color: rgba(0, 0, 0, 0.4);
    }
  `;
  const styleElement = document.createElement("style");
  styleElement.id = styleId;
  styleElement.textContent = styles;
  document.head.append(styleElement);
};

const ifcEntities = new Set([
  "IfcBeam", "IfcColumn", "IfcWall", "IfcSlab", "IfcDoor", "IfcWindow", "IfcRoof", "IfcStair",
  "IfcRailing", "IfcRamp", "IfcCovering", "IfcFlowSegment", "IfcFlowFitting", "IfcFlowTerminal",
  "IfcFlowController", "IfcFlowStorageDevice", "IfcFlowMovingDevice", "IfcDistributionControlElement",
  "IfcBuildingElementProxy", "IfcFurnishingElement", "IfcMember", "IfcPlate", "IfcCurtainWall",
  "IfcWallStandardCase", "IfcOpeningElement", "IfcSpace", "IfcBuildingStorey", "IfcBuilding",
  "IfcSite", "IfcProject", "IfcGroup", "IfcSystem", "IfcZone", "IfcActor", "IfcOccupant",
  "IfcSensor", "IfcActuator", "IfcController", "IfcUnitaryControlElement", "IfcAlarm", "IfcOutlet",
  "IfcSwitch", "IfcLightFixture", "IfcElectricDistributionPoint", "IfcTransformer",
  "IfcCableCarrierSegment", "IfcCableSegment", "IfcDuctSegment", "IfcPipeSegment", "IfcPipeFitting",
  "IfcDuctFitting", "IfcAirTerminal", "IfcFan", "IfcCoil", "IfcHeatExchanger", "IfcHumidifier",
  "IfcEvaporator", "IfcCondenser", "IfcCompressor", "IfcMotor", "IfcPump", "IfcValve", "IfcDamper",
  "IfcFilter", "IfcTank", "IfcBoiler", "IfcChiller", "IfcCoolingTower", "IfcEngine", "IfcTurbine",
  "IfcGenerator", "IfcElectricMotor", "IfcElectricGenerator", "IfcSolarDevice", "IfcBurner",
  "IfcCooledBeam", "IfcEvaporativeCooler", "IfcTubeBundle", "IfcInterceptor", "IfcSanitaryTerminal",
  "IfcWasteTerminal", "IfcStackTerminal", "IfcFireSuppressionTerminal", "IfcMedicalDevice",
  "IfcVibrationIsolator", "IfcStructuralCurveMember", "IfcStructuralSurfaceMember",
  "IfcStructuralPointConnection", "IfcStructuralCurveConnection", "IfcStructuralSurfaceConnection",
  "IfcReinforcingBar", "IfcReinforcingMesh", "IfcTendon", "IfcTendonAnchor", "IfcFooting", "IfcPile",
  "IfcCaissonFoundation", "IfcGrid", "IfcAnnotation", "IfcProxy"
]);

export const clashInput = (bcfTopics: any) => {
  const components = bcfTopics.components as OBC.Components;
  const fragments = components.get(OBC.FragmentsManager);
  const sharedIFC = new SharedIFC();

  const nameInput = document.createElement("bim-text-input") as BUI.TextInput;
  nameInput.label = "Test Name";
  nameInput.vertical = true;

  const checkTypeDropdown = document.createElement("bim-dropdown") as BUI.Dropdown;
  checkTypeDropdown.label = "Type";
  checkTypeDropdown.vertical = true;

  const optTolerance = document.createElement("bim-option") as any;
  optTolerance.label = "Tolerance";
  optTolerance.value = "tolerance";
  optTolerance.checked = true;
  
  const optClearance = document.createElement("bim-option") as any;
  optClearance.label = "Clearance";
  optClearance.value = "clearance";
  
  checkTypeDropdown.append(optTolerance, optClearance);

  const checkValueInput = document.createElement("bim-text-input") as BUI.TextInput;
  checkValueInput.label = "Value";
  checkValueInput.type = "number";
  checkValueInput.vertical = true;
  checkValueInput.value = "0.01";

  const modelADropdown = document.createElement("bim-dropdown") as BUI.Dropdown;
  modelADropdown.label = "Model A";
  modelADropdown.vertical = true;

  const selectorAInput = document.createElement("bim-text-input") as BUI.TextInput;
  selectorAInput.label = "Selector A";
  selectorAInput.vertical = true;
  selectorAInput.value = "IfcSlab";

  const modelBDropdown = document.createElement("bim-dropdown") as BUI.Dropdown;
  modelBDropdown.label = "Model B";
  modelBDropdown.vertical = true;

  const selectorBInput = document.createElement("bim-text-input") as BUI.TextInput;
  selectorBInput.label = "Selector B";
  selectorBInput.vertical = true;
  selectorBInput.value = "IfcBeam";

  const getCorrectedName = (name: string) => {
    const lowerName = name.trim().toLowerCase();
    for (const entity of ifcEntities) {
      if (entity.toLowerCase() === lowerName) {
        return entity;
      }
    }
    return name;
  };

  const updateName = () => {
    const modelA = modelADropdown.value[0] || "";
    const selectorA = getCorrectedName(selectorAInput.value || "");
    const modelB = modelBDropdown.value[0] || "";
    const selectorB = getCorrectedName(selectorBInput.value || "");
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    nameInput.value = `Clash(${year}${month}${day}): ${modelA}(${selectorA})-${modelB}(${selectorB})`;
  };

  const correctInput = (input: BUI.TextInput) => {
    input.value = getCorrectedName(input.value);
  };

  modelADropdown.addEventListener("change", updateName);
  selectorAInput.addEventListener("input", updateName);
  selectorAInput.addEventListener("change", () => {
    correctInput(selectorAInput);
    updateName();
  });
  modelBDropdown.addEventListener("change", updateName);
  selectorBInput.addEventListener("input", updateName);
  selectorBInput.addEventListener("change", () => {
    correctInput(selectorBInput);
    updateName();
  });

  const loadedModels: { id: number; name: string }[] = [];
  
  const refreshModels = () => {
    loadedModels.length = 0;
    const optionsA: HTMLElement[] = [];
    const optionsB: HTMLElement[] = [];

    for (const [uuid, model] of fragments.list) {
      const m = model as any;
      const dbId = m.dbId || sharedIFC.getIfcIdByModelUUID(uuid);
      if (dbId) {
        loadedModels.push({ id: dbId, name: m.name || "Untitled" });
        
        const optA = document.createElement("bim-option") as any;
        optA.label = m.name || "Untitled";
        optA.value = m.name || "Untitled";
        optA.setAttribute("dbId", dbId);
        optionsA.push(optA);

        const optB = document.createElement("bim-option") as any;
        optB.label = m.name || "Untitled";
        optB.value = m.name || "Untitled";
        optB.setAttribute("dbId", dbId);
        optionsB.push(optB);
      }
    }

    if ((modelADropdown as any).elements) (modelADropdown as any).elements.clear();
    modelADropdown.replaceChildren(...optionsA);
    if (optionsA.length > 0) modelADropdown.value = [optionsA[0].getAttribute("value")!];

    if ((modelBDropdown as any).elements) (modelBDropdown as any).elements.clear();
    modelBDropdown.replaceChildren(...optionsB);
    if (optionsB.length > 0) modelBDropdown.value = [optionsB[0].getAttribute("value")!];
    updateName();
  };

  const onCancel = () => {
    modal.close();
  };

  const onSend = async ({ target }: { target: BUI.Button }) => {
    if (modelADropdown.value.length === 0 || modelBDropdown.value.length === 0) {
      alert("Please select both Model A and Model B.");
      return;
    }

    const modelAName = modelADropdown.value[0];
    const modelBName = modelBDropdown.value[0];
    
    // Find dbId for Model A to attach BCF
    const selectedModelA = loadedModels.find(m => m.name === modelAName);
    if (!selectedModelA) {
      alert("Selected Model A not found in loaded models.");
      return;
    }

    const selectedModelB = loadedModels.find(m => m.name === modelBName);
    if (!selectedModelB) {
      alert("Selected Model B not found in loaded models.");
      return;
    }

    const body = [
      {
        "name": nameInput.value,
        "mode": checkTypeDropdown.value[0] === "clearance" ? "clearance" : "intersection",
        "a": [
          {
            "file": `${modelAName}.ifc`,
            "selector": getCorrectedName(selectorAInput.value),
            "mode": "i"
          }
        ],
        "b": [
          {
            "file": `${modelBName}.ifc`,
            "selector": getCorrectedName(selectorBInput.value),
            "mode": "i"
          }
        ],
        [checkTypeDropdown.value[0]]: parseFloat(checkValueInput.value),
        "check_all": true
      }
    ];

    console.log("Clash Detection Input:", JSON.stringify(body, null, 2));

    target.loading = true;

    try {
      const response = await fetch("/api/clash", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }

      const blob = await response.blob();

      const zip = new JSZip();
      await zip.loadAsync(blob);
      let topicCount = 0;
      zip.forEach((relativePath) => {
        if (relativePath.endsWith("markup.bcf")) {
          topicCount++;
        }
      });

      if (topicCount === 0) {
        alert("간섭체크를 정상적으로 수행하였으나 간섭 개수가 없습니다.");
        return;
      }

      const file = new File([blob], `${nameInput.value}.bcf`);

      const sharedBCF = new SharedBCF();
      const ifcIds = [selectedModelA.id];
      if (selectedModelB.id !== selectedModelA.id) {
        ifcIds.push(selectedModelB.id);
      }
      const newBcfId = await sharedBCF.saveBCF(file, JSON.stringify(ifcIds) as any);
      
      if (newBcfId) {
        alert(`간섭 체크 완료: ${topicCount}개의 간섭이 발견되었습니다.`);
        const buffer = await file.arrayBuffer();
        await bcfTopics.loadBCFContent(buffer);
        bcfTopics.onRefresh.trigger();
        modal.close();
      } else {
        alert("Failed to save BCF to database.");
      }

    } catch (error) {
      console.error("Error during clash detection request:", error);
      alert(`Error during clash detection: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      target.loading = false;
    }
  };

  const modal = BUI.Component.create<HTMLDialogElement>(() => {
    return BUI.html`
      <dialog class="clash-input-modal" style="margin: auto; border-radius: 1rem; border: none; padding: 0; overflow: hidden;">
       <bim-panel style="width: 30rem;">
        <bim-panel-section label="Clash Detection Input" fixed>
          ${nameInput}
          <div style="display: flex; gap: 0.5rem;">
            ${checkTypeDropdown}
            ${checkValueInput}
          </div>
          <bim-label>Group A</bim-label>
          <div style="display: flex; gap: 0.5rem;">
            ${modelADropdown}
            ${selectorAInput}
          </div>
          <bim-label>Group B</bim-label>
          <div style="display: flex; gap: 0.5rem;">
            ${modelBDropdown}
            ${selectorBInput}
          </div>
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;">
            <bim-button style="flex: 0;" label="Cancel" @click=${onCancel}></bim-button>
            <bim-button style="flex: 0;" label="Send" @click=${onSend}></bim-button>
          </div>
        </bim-panel-section>
       </bim-panel> 
      </dialog>
    `;
  });

  addClashInputStyles();
  document.body.append(modal);

  // Refresh models when modal opens
  const originalShowModal = modal.showModal.bind(modal);
  modal.showModal = () => {
    refreshModels();
    originalShowModal();
  };

  return modal;
};
