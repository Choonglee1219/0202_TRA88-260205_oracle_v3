import JSZip from "jszip";

export interface ClashPointData {
  clash_set: string;
  clash_guid: string;
  guid1: string | null;
  guid2: string | null;
  clash_point: [number, number, number] | null;
}

export interface UnzippedClashResult {
  bcfBlob: Blob | null;
  clashData: ClashPointData[];
}

export const processClashZip = async (zipBlob: Blob): Promise<UnzippedClashResult> => {
  const zip = new JSZip();
  await zip.loadAsync(zipBlob);

  let bcfBlob: Blob | null = null;
  let clashData: ClashPointData[] = [];

  for (const [filename, file] of Object.entries(zip.files)) {
    if (filename.endsWith(".bcf")) {
      bcfBlob = await file.async("blob");
    } else if (filename.endsWith(".json")) {
      const jsonString = await file.async("string");
      try {
        clashData = JSON.parse(jsonString);
      } catch (e) {
        console.error("Failed to parse clash json from zip", e);
      }
    }
  }

  return { bcfBlob, clashData };
};