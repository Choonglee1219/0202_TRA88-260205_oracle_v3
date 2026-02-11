import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import JSZip from "jszip";
import { users } from "../../globals";
import { SharedBCF } from "../SharedBCF";
import { SharedIFC } from "../SharedIFC";
import { setModelTransparent } from "../../ui-templates/toolbars/viewer-toolbar";

export * from "./src/new-topic";
export * from "./src/update-topic";

export class BCFTopics extends OBC.Component {
  static uuid = "e7526972-853c-4392-b6c6-33435e123456" as const;
  enabled = true;
  private _bcf: OBC.BCFTopics;
  private _loading = false;

  get list() {
    return this._bcf.list;
  }

  // Setting up BCFTopics
  constructor(components: OBC.Components) {
    super(components);
    this._bcf = components.get(OBC.BCFTopics);
    this._bcf.setup({
      author: "Admin",
      types: new Set(["Error", "Info", "Unknown", "Warning"]),
      priorities: new Set(["On hold", "Minor", "Normal", "Major", "Critical"]),
      statuses: new Set(["Open", "Assigned", "Closed", "Resolved"]),
      labels: new Set(["A", "C", "E", "J", "M", "P", "R"]),
      stages: new Set(["Concept Design", "Basic Design", "Detailed Design", "Construction", "As-Build"]),
      users: new Set(Object.keys(users)),
      version: "2.1",
    });

    OBC.Topic.default = {
      title: "",
      type: "Info",
      status: "Open",
      priority: "Normal",
      labels: new Set(["R"])
    };

    const viewpoints = components.get(OBC.Viewpoints);
    this._bcf.list.onItemSet.add(async ({ value: topic }) => {
      if (this._loading) return;
      const viewpoint = viewpoints.create();
      const worlds = components.get(OBC.Worlds);
      const world = worlds.list.values().next().value;
      if (world) {
        viewpoint.world = world;
        await viewpoint.updateCamera();
      }

      const highlighter = components.get(OBF.Highlighter);
      const selection = highlighter.selection.select;
      if (Object.keys(selection).length > 0) {
        const fragments = components.get(OBC.FragmentsManager);
        const guids = await fragments.modelIdMapToGuids(selection);
        for (const guid of guids) {
          viewpoint.selectionComponents.add(guid);
        }
      }

      topic.viewpoints.add(viewpoint.guid);

      topic.comments.onItemSet.add(({ value: comment }) => {
        comment.viewpoint = viewpoint.guid;
      });

      topic.comments.onItemUpdated.add(({ value: comment }) => {
        console.log("The following comment has been updated:", comment);
      });
    });

    this._bcf.list.onItemUpdated.add(({ value: topic }) => {
      console.log(`Topic ${topic.title} was updated!`);
    });
  }

  getSelectedTopics(selection: Set<any>) {
    const topics: OBC.Topic[] = [];
    for (const item of selection) {
      const guid = (item as any).Guid;
      if (guid) {
        const topic = this.list.get(guid);
        if (topic) topics.push(topic);
      }
    }
    return topics;
  }

  async restoreViewpoint(topic: OBC.Topic) {
    if (topic.viewpoints.size > 0) {
      const viewpointGuid = topic.viewpoints.values().next().value;
      if (viewpointGuid) {
        const viewpoints = this.components.get(OBC.Viewpoints);
        const viewpoint = viewpoints.list.get(viewpointGuid);
        if (viewpoint && viewpoint.world) {
          await viewpoint.go();
          const highlighter = this.components.get(OBF.Highlighter);
          highlighter.clear("select");
          const fragments = this.components.get(OBC.FragmentsManager);
          const guids = Array.from(viewpoint.selectionComponents);
          const modelIdMap = await fragments.guidsToModelIdMap(guids);
          highlighter.highlightByID("select", modelIdMap);
          setModelTransparent(this.components);
        }
      }
    }
  }

  setupTable(table: BUI.Table<any>) {
    table.dataTransform.Title = (value: any, row: any) => {
      return BUI.html`
        <bim-label style="cursor: pointer;" @click=${async () => {
          const topic = this.list.get(row.Guid);
          if (topic) await this.restoreViewpoint(topic);
        }}>${value}</bim-label>
      `;
    };
  }

  // Deleting Topics
  delete(selection: Set<any>) {
    if (selection.size === 0) return;
    const topics = this.getSelectedTopics(selection);
    if (topics.length === 0) return;
    const confirmation = confirm(`Delete ${topics.length} topic(s)?`);
    if (confirmation) {
      for (const topic of topics) {
        this._bcf.list.delete(topic.guid);
      }
      selection.clear();
    }
  }

  private downloadFile(blob: Blob, name: string) {
    const bcfFile = new File([blob], name);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(bcfFile);
    a.download = bcfFile.name;
    a.click();
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

  private async loadBCFContent(buffer: ArrayBuffer) {
    this._loading = true;
    try {
      const { topics, viewpoints } = await this._bcf.load(new Uint8Array(buffer));
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
      console.log(topics, viewpoints);
    } finally {
      this._loading = false;
    }
  }

  // Importing BCF File
  importBCF() {
    this.createFileInput(async (file) => {
      const buffer = await file.arrayBuffer();
      await this.loadBCFContent(buffer);
    });
  }

  // Exporting BCF File
  async exportBCF(name?: string) {
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
            const cameraUpVectors = xmlDoc.getElementsByTagName("CameraUpVector");
            if (cameraUpVectors.length > 0) {
              const cameraUpVector = cameraUpVectors[0];
              const yNode = cameraUpVector.getElementsByTagName("Y")[0];
              const zNode = cameraUpVector.getElementsByTagName("Z")[0];
              if (yNode && zNode) {
                const yValue = yNode.textContent;
                yNode.textContent = zNode.textContent;
                zNode.textContent = yValue;
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
      this.downloadFile(newBlob, name);
    } catch (e) {
      console.error("Error post-processing BCF:", e);
      this.downloadFile(blob, name);
    }
  }

  // Saving BCF File to Database
  async saveBCFToDB() {
    this.createFileInput(async (file) => {
      const fragments = this.components.get(OBC.FragmentsManager);
      const sharedIFC = new SharedIFC();
      const loadedModels: { id: number; name: string }[] = [];
      
      for (const [uuid, model] of fragments.list) {
        const m = model as any;
        const dbId = m.dbId || sharedIFC.getIfcIdByModelUUID(uuid);
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

      let selectedIfcId = loadedModels[0].id;
      if (loadedModels.length > 1) {
         const options = loadedModels.map((m, i) => `${i + 1}. ${m.name}`).join("\n");
         const userInput = prompt(`BCF를 연결할 IFC 모델을 선택하세요 (번호 입력):\n${options}`, "1");
         if (!userInput) return;
         const index = parseInt(userInput) - 1;
         if (isNaN(index) || index < 0 || index >= loadedModels.length) {
           alert("잘못된 선택입니다.");
           return;
         }
         selectedIfcId = loadedModels[index].id;
      }

      const sharedBCF = new SharedBCF();
      const newBcfId = await sharedBCF.saveBCF(file, selectedIfcId);
      if (newBcfId) {
         alert("BCF 파일이 데이터베이스에 성공적으로 저장되었습니다.");
         const buffer = await file.arrayBuffer();
         await this.loadBCFContent(buffer);
      }
    });
  }
}
