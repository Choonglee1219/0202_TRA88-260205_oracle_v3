import * as OBC from "@thatopen/components";
import JSZip from "jszip";
import { SharedBCF } from "../../SharedBCF";
import { SharedIFC } from "../../SharedIFC";
import { BCFTopics } from "../index";

export class BCFFileOperations {
  private components: OBC.Components;
  private _bcf: OBC.BCFTopics;
  private onRefresh: OBC.Event<void>;
  private sharedIFC: SharedIFC;
  private sharedBCF: SharedBCF;

  constructor(bcfTopicsInstance: BCFTopics) {
    this.components = bcfTopicsInstance.components;
    this._bcf = bcfTopicsInstance._bcf;
    this.onRefresh = bcfTopicsInstance.onRefresh;
    this.sharedIFC = new SharedIFC();
    this.sharedBCF = new SharedBCF();
  }

  private downloadFile(blob: Blob, name: string) {
    const bcfFile = new File([blob], name);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(bcfFile);
    a.download = bcfFile.name;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  private createFileInput(callback: (file: File) => void) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".bcf";
    input.multiple = false;
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) callback(file);
    });
    input.click();
  }

  async loadBCFContent(buffer: ArrayBuffer | Uint8Array) {
    try {
      const bcf = new Uint8Array(buffer);
      const { topics, viewpoints } = await this._bcf.load(bcf);

      const zip = new JSZip();
      await zip.loadAsync(buffer);

      for (const topic of topics) {
        const folder = zip.folder(topic.guid);
        if (!folder) continue;
        const snapshotFile = folder.file("snapshot.png");
        if (snapshotFile) {
          const base64 = await snapshotFile.async("base64");
          (topic as any).snapshot = `data:image/png;base64,${base64}`;
          this._bcf.list.onItemUpdated.trigger({ key: topic.guid, value: topic });
        }
      }

      const worlds = this.components.get(OBC.Worlds);
      const world = worlds.list.values().next().value;
      if (world) {
        for (const viewpoint of viewpoints) {
          viewpoint.world = world;
          const cam = viewpoint.camera;
          const pos = cam.camera_view_point;
          const dir = cam.camera_direction;
          if ((cam as any).view_to_world_scale) {
            const offset = 80;
            pos.x -= dir.x * offset;
            pos.y -= dir.y * offset;
            pos.z -= dir.z * offset;
            (cam as any).view_to_world_scale = 1;
            (cam as any).aspect_ratio = 3;
            (cam as any).field_of_view = 60;
          }
        }
      }
    } finally {
      // Loading state managed by BCFTopics
    }
  }

  importBCF() {
    this.createFileInput(async (file) => {
      const buffer = await file.arrayBuffer();
      await this.loadBCFContent(buffer);
    });
  }

  private async createBCFBlob(name?: string) {
    if (!name) {
      name = "topics.bcf";
      const fragments = this.components.get(OBC.FragmentsManager);
      if (fragments.list.size > 0) {
        const model = fragments.list.values().next().value;
        if (model && (model as any).name) {
          name = `${(model as any).name}.bcf`;
        }
      }
    }
    const blob = await this._bcf.export();
    try {
      const zip = new JSZip();
      await zip.loadAsync(blob);
      const topicFolders = new Set<string>();
      zip.forEach((relativePath) => {
        if (relativePath.endsWith("markup.bcf")) {
          const folder = relativePath.substring(0, relativePath.lastIndexOf("/") + 1);
          topicFolders.add(folder);
        }
      });
      for (const folder of topicFolders) {
        const markupPath = folder + "markup.bcf";
        const markupFile = zip.file(markupPath);
        if (markupFile) {
          const xmlStr = await markupFile.async("string");
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
          const viewpoints = xmlDoc.getElementsByTagName("Viewpoint");
          for (let i = 0; i < viewpoints.length; i++) {
            viewpoints[i].textContent = "viewpoint.bcfv";
          }
          const snapshots = xmlDoc.getElementsByTagName("Snapshot");
          for (let i = 0; i < snapshots.length; i++) {
            snapshots[i].textContent = "snapshot.png";
          }
          const serializer = new XMLSerializer();
          const newXmlStr = serializer.serializeToString(xmlDoc);
          zip.file(markupPath, newXmlStr);
        }
        const folderZip = zip.folder(folder);
        if (folderZip) {
          const bcfvFiles = folderZip.file(/.*\.bcfv$/);
          for (const file of bcfvFiles) {
            const xmlStr = await file.async("string");
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlStr, "application/xml");
            const visibility = xmlDoc.getElementsByTagName("Visibility");
            if (visibility.length > 0) {
              const visTag = visibility[0];
              visTag.setAttribute("DefaultVisibility", "true");
              const exceptions = visTag.getElementsByTagName("Exceptions");
              if (exceptions.length > 0) {
                visTag.removeChild(exceptions[0]);
              }
            }
            const vectors = ["CameraViewPoint", "CameraDirection", "CameraUpVector"];
            for (const vecName of vectors) {
              const vecNodes = xmlDoc.getElementsByTagName(vecName);
              if (vecNodes.length > 0) {
                const vecNode = vecNodes[0];
                const xNode = vecNode.getElementsByTagName("X")[0];
                const yNode = vecNode.getElementsByTagName("Y")[0];
                const zNode = vecNode.getElementsByTagName("Z")[0];
                if (xNode && yNode && zNode) {
                  const x = parseFloat(xNode.textContent || "0");
                  const y = parseFloat(yNode.textContent || "0");
                  const z = parseFloat(zNode.textContent || "0");
                  xNode.textContent = String(x);
                  yNode.textContent = String(y);
                  zNode.textContent = String(z);
                }
              }
            }
            const serializer = new XMLSerializer();
            const newXmlStr = serializer.serializeToString(xmlDoc);
            zip.file(folder + "viewpoint.bcfv", newXmlStr);
            if (!file.name.endsWith("viewpoint.bcfv")) {
              zip.remove(file.name);
            }
          }
          const pngFiles = folderZip.file(/.*\.png$/);
          for (const file of pngFiles) {
            if (!file.name.endsWith("snapshot.png")) {
              const content = await file.async("blob");
              zip.file(folder + "snapshot.png", content);
              zip.remove(file.name);
            }
          }
        }
      }
      const newBlob = await zip.generateAsync({ type: "blob" });
      return { blob: newBlob, name };
    } catch (e) {
      console.error("Error post-processing BCF:", e);
      return { blob, name };
    }
  }

  async exportBCF(name?: string) {
    const { blob, name: fileName } = await this.createBCFBlob(name);
    this.downloadFile(blob, fileName);
  }

  async saveBCF() {
    const fragments = this.components.get(OBC.FragmentsManager);
    const loadedModels: { id: number; name: string }[] = [];
    
    for (const [uuid, model] of fragments.list) {
      const m = model as any;
      const dbId = m.dbId || this.sharedIFC.getIfcIdByModelUUID(uuid);
      if (dbId) {
        loadedModels.push({ id: dbId, name: m.name || "Untitled" });
      }
    }

    if (loadedModels.length === 0) {
      alert("데이터베이스에 저장된 IFC 모델이 로드되어 있지 않습니다. BCF를 저장할 수 없습니다.");
      return;
    }

    const ifcIds = this.selectTargetModels(loadedModels);
    if (!ifcIds) return;

    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');

    const selectedModels = loadedModels.filter(m => ifcIds.includes(m.id));
    const modelNames = selectedModels.map(m => m.name).join("-");
    const defaultName = `Topics(${year}${month}${day}): ${modelNames}`;
    const fileName = prompt("BCF 파일 이름을 입력하세요:", defaultName);
    if (!fileName) return;

    const { blob } = await this.createBCFBlob(fileName);
    const file = new File([blob], fileName);

    const newBcfId = await this.sharedBCF.saveBCF(file, JSON.stringify(ifcIds) as any);
    if (newBcfId) {
       alert("BCF 파일이 데이터베이스에 성공적으로 저장되었습니다.");
       this.onRefresh.trigger();
    }
  }

  exportJSON() {
    console.log("Exporting JSON...");

    const fragments = this.components.get(OBC.FragmentsManager);
    const modelNamesArray: string[] = [];
    for (const [, model] of fragments.list) {
      const m = model as any;
      if (m.name) modelNamesArray.push(m.name);
    }
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const modelNames = modelNamesArray.join("-");
    const defaultName = `Topics(${year}${month}${day}): ${modelNames}`;
    const fileName = prompt("JSON 파일 이름을 입력하세요:", defaultName);
    if (!fileName) return;

    const data = [];
    for (const topic of this._bcf.list.values()) {
      data.push({
        GUID: topic.guid,
        Title: topic.title,
        Type: topic.type,
        Status: topic.status,
        Author: topic.creationAuthor,
        Assignee: topic.assignedTo,
        Priority: topic.priority,
        Labels: Array.from(topic.labels),
        "Due Date": topic.dueDate,
        "Created Date": topic.creationDate,
        Stage: topic.stage,
        Description: topic.description,
      });
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const finalName = fileName.endsWith(".json") ? fileName : `${fileName}.json`;
    this.downloadFile(blob, finalName);
  }

  async saveBCFToDB() {
    this.createFileInput(async (file) => {
      const fragments = this.components.get(OBC.FragmentsManager);
      const loadedModels: { id: number; name: string }[] = [];
      
      for (const [uuid, model] of fragments.list) {
        const m = model as any;
        const dbId = m.dbId || this.sharedIFC.getIfcIdByModelUUID(uuid);
        console.log(`Model: ${m.name}, UUID: ${uuid}, Found DB ID: ${dbId}`);
        if (dbId) {
          loadedModels.push({ id: dbId, name: m.name || "Untitled" });
        }
      }
      console.log("Models available for BCF attachment:", loadedModels);

      if (loadedModels.length === 0) {
        alert("데이터베이스에 저장된 IFC 모델이 로드되어 있지 않습니다. BCF를 저장할 수 없습니다.");
        return;
      }

      const ifcIds = this.selectTargetModels(loadedModels);
      if (!ifcIds) return;

      const newBcfId = await this.sharedBCF.saveBCF(file, JSON.stringify(ifcIds) as any);
      if (newBcfId) {
         alert("BCF 파일이 데이터베이스에 성공적으로 저장되었습니다.");
         const buffer = await file.arrayBuffer();
         await this.loadBCFContent(buffer);
         this.onRefresh.trigger();
      }
    });
  }

  private selectTargetModels(loadedModels: { id: number; name: string }[]): number[] | null {
    if (loadedModels.length === 1) return [loadedModels[0].id];

    const options = loadedModels.map((m, i) => `${i + 1}. ${m.name}`).join("\n");
    const defaultSelection = loadedModels.map((_, i) => i + 1).join(", ");
    const userInput = prompt(`BCF를 연결할 IFC 모델을 선택하세요 (번호 입력, 쉼표로 구분):\n${options}`, defaultSelection);
    
    if (!userInput) return null;

    const indices = userInput.split(",").map(s => parseInt(s.trim()) - 1);
    const validIndices = indices.filter(i => !isNaN(i) && i >= 0 && i < loadedModels.length);

    if (validIndices.length === 0) {
      alert("잘못된 선택입니다.");
      return null;
    }
    
    return Array.from(new Set(validIndices)).map(i => loadedModels[i].id);
  }
}