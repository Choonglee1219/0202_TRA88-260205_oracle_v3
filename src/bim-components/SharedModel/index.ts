interface IfcRow {
  id: number;
  name: string;
  content: Uint8Array;
}

interface IfcBasicInfo {
  id: number;
  name: string;
}

export class SharedModel {

  list: IfcBasicInfo[] = [];
  modelUUIDMap: Map<number, string> = new Map();

  constructor() {}

  async loadIFCFiles() {
    try {
      const ifcResponse = await fetch('/api/ifcs/name', {
        credentials: "include",
        method: "GET",
      });
      if (!ifcResponse.ok) {
        throw new Error("Failed to fetch ifcs");
      }

      const ifcRows: IfcBasicInfo[] = await ifcResponse.json();
      for (const row of ifcRows) {
        const ifcInfo: IfcBasicInfo = {
          id: row.id,
          name: row.name,
        };
        this.newProject(ifcInfo);
      }
    } catch (err) {
      console.error("Error loading projects from API:", err);
      alert("IFC 로딩에 실패했습니다. 개발자에게 문의하세요.")
    }
  }

  async loadIFC(ifcId: number) {
    try{
      const ifcResponse = await fetch(`/api/ifc/${ifcId}`, {
        credentials: "include",
        method: "GET",
      });
      if (!ifcResponse.ok) {
        console.warn(`Not found IFC data for ifc ID ${ifcId}`);
        alert("해당 ID의 IFC 데이터를 찾을 수 없습니다.")
        return null;
      }
      const ifcRow: IfcRow = await ifcResponse.json();

      if (!ifcRow.content || ifcRow.content.length === 0) {
        console.error("Not found IFC data found.");
        alert("IFC 데이터를 찹을 수 없습니다.")
        return null;
      }

      if (typeof ifcRow.content === 'string') {
        const decodedContent = atob(ifcRow.content);
        const ifc_data = new Uint8Array(decodedContent.length);
        for (let i = 0; i < decodedContent.length; i++) {
          ifc_data[i] = decodedContent.charCodeAt(i);
        }
        
        return {
          name: ifcRow.name,
          content: ifc_data, 
        };
      }
      return null;
    }
    catch (error) {
      console.error("Error loading IFC data:", error);
      alert("IFC 로딩에 실패했습니다. 개발자에게 문의하세요.");
      return null;
    }
  }

  async saveIFC(file: File) {
    try {
      const newName = file.name.replace(/\.ifc$/i, "");
      const newFile = new File([file], newName, { type: file.type });
      const formData = new FormData();
      formData.append("file", newFile);

      const ifcResponse = await fetch("/api/ifc", {
        credentials: "include",
        method: "POST",
        body: formData,
      });
      if (!ifcResponse.ok) {
        const errorText = await ifcResponse.text();
        console.error("Error saving IFC to DB:", errorText);
        alert("IFC 저장에 실패했습니다. 다시 시도해 주세요.");
      }
      return ifcResponse.ok;
    } catch (error) {
      console.error("Error saving IFC to DB:", error);
      alert("IFC 저장에 실패했습니다. 개발자에게 문의하세요.");
      return false;
    }
  };
  
  async deleteIFC(ifcId: number) {
    try {
      const ifcResponse = await fetch(`/api/ifc/${ifcId}`, {
        credentials: "include",
        method: "DELETE",
      });
      if (!ifcResponse.ok) {
        const errorText = await ifcResponse.text();
        console.error("Error deleting IFC from DB:", errorText);
        alert("IFC 삭제에 실패했습니다. 다시 시도해 주세요.");
      }
      return ifcResponse.ok;
    } catch (err) {
      console.error("Error deleting IFC from DB:", err);
      alert("IFC 삭제에 실패했습니다. 개발자에게 문의하세요.");
      return false;
    }
  }

  addModelUUID(ifcId: number, modelUUID: string) {
    this.modelUUIDMap.set(ifcId, modelUUID);
  }

  getModelUUID(ifcId: number): string | undefined {
    return this.modelUUIDMap.get(ifcId);
  }

  getIfcIdByModelUUID(modelUUID: string): number | undefined {
    for (const [ifcId, uuid] of this.modelUUIDMap.entries()) {
      if (uuid === modelUUID) {
        return ifcId;
      }
    }
    return undefined;
  }

  removeModelUUID(ifcId: number) {
    this.modelUUIDMap.delete(ifcId);
  }

  filterProjects(value: string) {
    const filteredProjects = this.list.filter((project) => {
      return project.name.toLowerCase().includes(value.toLocaleLowerCase());
    })
    return filteredProjects;
  }

  newProject(data: IfcBasicInfo) {
    this.list.push(data);
    return data;
  }

  exportToJSON(fileName: string = "projects") {
    const json = JSON.stringify(this.list, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  importFromJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const json = reader.result;
      if (!json) { return; }
      const projects: IfcRow[] = JSON.parse(json as string);
      for (const project of projects) {
        try {
          this.newProject(project);
        } catch (error) {
        }
      }
    })
    input.addEventListener('change', () => {
      const filesList = input.files;
      if (!filesList) { return; }
      reader.readAsText(filesList[0]);
    })
    input.click();
  }
}