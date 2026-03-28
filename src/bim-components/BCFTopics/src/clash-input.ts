import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { SharedBCF } from "../../SharedBCF";
import { SharedIFC } from "../../SharedIFC";
import { processClashZip, ClashPointData } from "./clash-result-parser";

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
  "IfcSpatialZone", "IfcZone", "IfcBuildingStorey", "IfcSpace", 
  "IfcBeam", "IfcBuildingElementProxy", "IfcChimney", "IfcColumn", "IfcCovering", "IfcCurtainWall", "IfcDoor", "IfcFooting", "IfcMember", "IfcPile", "IfcPlate", "IfcRailing", "IfcRamp", "IfcRampFlight", "IfcRoof", "IfcShadingDevice", "IfcSlab", "IfcStair", "IfcStairFlight", "IfcWall", "IfcWindow",
  "IfcCivilElement",
  "IfcActuator", "IfcAlarm", "IfcController", "IfcFlowInstrument", "IfcProtectiveDeviceTrippingUnit", "IfcSensor", "IfcUnitaryControlElement", 
  "IfcDistrubutionChamberElement", "IfcAirToAirHeatRecovery", "IfcBoiler","IfcBurner", "IfcChiller", "IfcCoil", "IfcCondenser", "IfcCooledBeam", "IfcCoolingTower", "IfcElectricGenerator", "IfcElectricMotor", "IfcEngine", "IfcEvaporativeCooler", "IfcEvaporator", "IfcHeatExchanger", "IfcHumidifier", "IfcMotorConnection", "IfcSolarDevice", "IfcTransformer", "IfcTubeBundle", "IfcUnitaryEquipment", 
  "IfcFlowController", "IfcAirTerminalBox", "IfcDamper", "IfcElectricDistributionBoard", "IfcElectricTimeControl", "IfcFlowMeter", "IfcProtectiveDevice", "IfcSwitchingDevice", "IfcValve",
  "IfcFlowFitting", "IfcCableCarrierFitting", "IfcCableFitting", "IfcDuctFitting", "IfcJunctionBox", "IfcPipeFitting",
  "IfcFlowMovingDevice", "IfcCompressor", "IfcFan", "IfcPump",
  "IfcFlowSegment", "IfcCableCarrierSegment", "IfcCableSegment", "IfcDuctSegment", "IfcPipeSegment", 
  "IfcFlowStorageDevice", "IfcElectricFlowStorageDevice", "IfcTank", 
  "IfcFlowTerminal", "IfcAirTerminal", "IfcAudioVisualAppliance", "IfcCommunicationsAppliance", "IfcElectricAppliance", "IfcFireSuppressionTerminal", "IfcLamp", "IfcLightFixture", "IfcMedicalDevice", "IfcOutlet", "IfcSanitaryTerminal", "IfcSpaceHeater", "IfcStackTerminal", "IfcWasteTerminal",
  "IfcFlowTreatmentDevice", "IfcDuctSilencer", "IfcFilter", "IfcInterceptor",
  "IfcBuildingElementPart", "IfcDiscreteAccessory", "IfcFastener", "IfcMechanicalFastener", "IfcReinforcingBar", "IfcReinforcingMesh", "IfcTendon", "IfcTendonAnchor", "IfcVibrationIsolator", 
  "IfcOpeningElement", "IfcVoidingFeature", "IfcSurfaceFeature",
  "IfcFurnishingElement", "IfcFurniture", "IfcSystemFurnitureElement", 
]);

export const clashInput = (components: OBC.Components, onComplete: (buffer: ArrayBuffer, clashData: ClashPointData[]) => Promise<void>) => {
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

  const selectorADropdown = document.createElement("bim-dropdown") as BUI.Dropdown;
  selectorADropdown.label = "Selector A";
  selectorADropdown.vertical = true;

  const selectorAModeDropdown = document.createElement("bim-dropdown") as BUI.Dropdown;
  selectorAModeDropdown.label = "Mode A";
  selectorAModeDropdown.vertical = true;
  
  const optAI = document.createElement("bim-option") as any;
  optAI.label = "Include";
  optAI.value = "i";
  optAI.checked = true;
  const optAE = document.createElement("bim-option") as any;
  optAE.label = "Exclude";
  optAE.value = "e";
  const optAA = document.createElement("bim-option") as any;
  optAA.label = "All";
  optAA.value = "a";
  selectorAModeDropdown.append(optAI, optAE, optAA);

  const modelBDropdown = document.createElement("bim-dropdown") as BUI.Dropdown;
  modelBDropdown.label = "Model B";
  modelBDropdown.vertical = true;

  const selectorBDropdown = document.createElement("bim-dropdown") as BUI.Dropdown;
  selectorBDropdown.label = "Selector B";
  selectorBDropdown.vertical = true;

  const selectorBModeDropdown = document.createElement("bim-dropdown") as BUI.Dropdown;
  selectorBModeDropdown.label = "Mode B";
  selectorBModeDropdown.vertical = true;

  const optBI = document.createElement("bim-option") as any;
  optBI.label = "Include";
  optBI.value = "i";
  optBI.checked = true;
  const optBE = document.createElement("bim-option") as any;
  optBE.label = "Exclude";
  optBE.value = "e";
  const optBA = document.createElement("bim-option") as any;
  optBA.label = "All";
  optBA.value = "a";
  selectorBModeDropdown.append(optBI, optBE, optBA);

  const updateName = () => {
    const modelA = modelADropdown.value[0] || "";
    const selectorA = selectorADropdown.value[0] || "";
    const modeA = selectorAModeDropdown.value[0];
    const selectorADisplay = modeA === "a" ? "*" : selectorA;

    const modelB = modelBDropdown.value[0] || "";
    const selectorB = selectorBDropdown.value[0] || "";
    const modeB = selectorBModeDropdown.value[0];
    const selectorBDisplay = modeB === "a" ? "*" : selectorB;

    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    nameInput.value = `Clash(${year}${month}${day}): ${modelA}(${selectorADisplay})-${modelB}(${selectorBDisplay})`;
  };

  modelADropdown.addEventListener("change", updateName);
  selectorADropdown.addEventListener("change", updateName);
  selectorAModeDropdown.addEventListener("change", () => {
    const mode = selectorAModeDropdown.value[0];
    if (mode === "a") {
      selectorADropdown.value = [];
      selectorADropdown.setAttribute("disabled", "");
    } else {
      selectorADropdown.removeAttribute("disabled");
    }
    updateName();
  });
  modelBDropdown.addEventListener("change", updateName);
  selectorBDropdown.addEventListener("change", updateName);
  selectorBModeDropdown.addEventListener("change", () => {
    const mode = selectorBModeDropdown.value[0];
    if (mode === "a") {
      selectorBDropdown.value = [];
      selectorBDropdown.setAttribute("disabled", "");
    } else {
      selectorBDropdown.removeAttribute("disabled");
    }
    updateName();
  });

  const loadedModels: { id: number; name: string }[] = [];
  
  const refreshModels = async () => {
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

    const classifier = components.get(OBC.Classifier);
    try {
      await classifier.byCategory({ classificationName: "entities" });
    } catch (e) {
      console.warn("Classifier grouping error:", e);
    }
    const entitiesClass = classifier.list.get("entities");
    
    const availableCategories = new Set<string>();
    if (entitiesClass) {
      for (const catName of entitiesClass.keys()) {
        const lowerCat = catName.toLowerCase();
        for (const entity of ifcEntities) {
          if (entity.toLowerCase() === lowerCat) {
             availableCategories.add(entity);
             break;
          }
        }
      }
    }

    const sortedCategories = Array.from(availableCategories).sort();
    const catOptionsA: HTMLElement[] = [];
    const catOptionsB: HTMLElement[] = [];

    const currentSelA = selectorADropdown.value[0];
    const currentSelB = selectorBDropdown.value[0];

    for (const cat of sortedCategories) {
      const optA = document.createElement("bim-option") as any;
      optA.label = cat; optA.value = cat; catOptionsA.push(optA);
      const optB = document.createElement("bim-option") as any;
      optB.label = cat; optB.value = cat; catOptionsB.push(optB);
    }

    if ((selectorADropdown as any).elements) (selectorADropdown as any).elements.clear();
    selectorADropdown.replaceChildren(...catOptionsA);
    if (currentSelA && availableCategories.has(currentSelA)) selectorADropdown.value = [currentSelA];
    else if (catOptionsA.length > 0) selectorADropdown.value = [catOptionsA[0].getAttribute("value")!];

    if ((selectorBDropdown as any).elements) (selectorBDropdown as any).elements.clear();
    selectorBDropdown.replaceChildren(...catOptionsB);
    if (currentSelB && availableCategories.has(currentSelB)) selectorBDropdown.value = [currentSelB];
    else if (catOptionsB.length > 0) selectorBDropdown.value = [catOptionsB[0].getAttribute("value")!];

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
            "selector": selectorADropdown.value[0] || "",
            "mode": selectorAModeDropdown.value[0]
          }
        ],
        "b": [
          {
            "file": `${modelBName}.ifc`,
            "selector": selectorBDropdown.value[0] || "",
            "mode": selectorBModeDropdown.value[0]
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

      const zipBlob = await response.blob();
      
      // ZIP 파일 압축 해제 및 파싱 로직 호출
      const { bcfBlob, clashData } = await processClashZip(zipBlob);

      if (!bcfBlob || clashData.length === 0) {
        alert("간섭체크를 정상적으로 수행하였으나 BCF 데이터 또는 간섭이 없습니다.");
        return;
      }

      // BCF Blob을 File 객체로 변환하여 DB에 저장
      const file = new File([bcfBlob], `${nameInput.value}.bcf`);

      const sharedBCF = new SharedBCF();
      const ifcIds = [selectedModelA.id];
      if (selectedModelB.id !== selectedModelA.id) {
        ifcIds.push(selectedModelB.id);
      }
      const newBcfId = await sharedBCF.saveBCF(file, JSON.stringify(ifcIds) as any);
      
      if (newBcfId) {
        // --- JSON 간섭 좌표를 별도 컬럼에 저장 ---
        try {
          await fetch(`/api/bcf/${newBcfId}/clash`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(clashData)
          });
        } catch (e) {
          console.error("Failed to save clash data to DB", e);
        }

        alert(`간섭 체크 완료: ${clashData.length}개의 간섭이 발견되었습니다.`);
        const buffer = await file.arrayBuffer();
        await onComplete(buffer, clashData);
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
            ${selectorAModeDropdown}
            ${selectorADropdown}
          </div>
          <bim-label>Group B</bim-label>
          <div style="display: flex; gap: 0.5rem;">
            ${modelBDropdown}
            ${selectorBModeDropdown}
            ${selectorBDropdown}
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
  modal.showModal = async () => {
    await refreshModels();
    originalShowModal();
  };

  return modal;
};
