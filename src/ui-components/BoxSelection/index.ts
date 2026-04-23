import * as THREE from "three";
import * as OBC from "@thatopen/components";
import { Highlighter } from "../../bim-components/Highlighter";

export function setupBoxSelection(
  components: OBC.Components,
  world: OBC.World,
  viewport: HTMLElement,
  highlighter: Highlighter
) {
  const fragments = components.get(OBC.FragmentsManager);

  let selectionStart: THREE.Vector2 | null = null;
  let selectionBox: HTMLDivElement | null = null;
  let originalCursor: string = "";

  const onPointerDown = (event: PointerEvent) => {
    // Ctrl + 좌클릭 조합일 때만 작동하도록 설정
    if (event.button !== 0 || !event.ctrlKey) return;

    originalCursor = document.body.style.cursor;
    document.body.style.cursor = "crosshair";

    const rect = viewport.getBoundingClientRect();
    selectionStart = new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top);

    selectionBox = document.createElement("div");
    selectionBox.style.position = "absolute";
    selectionBox.style.border = "1px solid rgba(143, 188, 12, 0.8)";
    selectionBox.style.backgroundColor = "rgba(143, 188, 12, 0.2)";
    selectionBox.style.pointerEvents = "none";
    selectionBox.style.zIndex = "999";
    selectionBox.style.left = `${selectionStart.x}px`;
    selectionBox.style.top = `${selectionStart.y}px`;
    selectionBox.style.width = "0px";
    selectionBox.style.height = "0px";

    viewport.append(selectionBox);

    if (world.camera.controls) {
      world.camera.controls.enabled = false;
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!selectionStart || !selectionBox) return;

    const rect = viewport.getBoundingClientRect();
    const current = new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top);

    const minX = Math.min(selectionStart.x, current.x);
    const minY = Math.min(selectionStart.y, current.y);
    const width = Math.abs(selectionStart.x - current.x);
    const height = Math.abs(selectionStart.y - current.y);

    selectionBox.style.left = `${minX}px`;
    selectionBox.style.top = `${minY}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;
  };

  const onPointerUp = async (event: PointerEvent) => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);

    document.body.style.cursor = originalCursor;

    if (world.camera.controls) {
      world.camera.controls.enabled = true;
    }

    if (!selectionStart || !selectionBox) {
      selectionBox?.remove();
      selectionStart = null;
      selectionBox = null;
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const end = new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top);

    const topLeft = new THREE.Vector2(Math.min(selectionStart.x, end.x), Math.min(selectionStart.y, end.y));
    const bottomRight = new THREE.Vector2(Math.max(selectionStart.x, end.x), Math.max(selectionStart.y, end.y));

    selectionBox.remove();
    selectionStart = null;
    selectionBox = null;

    // 박스 크기가 너무 작으면 단순 클릭으로 간주
    if (Math.abs(bottomRight.x - topLeft.x) < 5 && Math.abs(bottomRight.y - topLeft.y) < 5) {
      return;
    }

    const raycastTopLeft = new THREE.Vector2(topLeft.x + rect.left, topLeft.y + rect.top);
    const raycastBottomRight = new THREE.Vector2(bottomRight.x + rect.left, bottomRight.y + rect.top);

    const modelIdMap: OBC.ModelIdMap = {};

    for (const [, model] of fragments.list) {
      if (!model.object.visible) continue;

      const res = await (model as any).rectangleRaycast({
        camera: world.camera.three,
        dom: world.renderer!.three.domElement,
        topLeft: raycastTopLeft,
        bottomRight: raycastBottomRight,
        fullyIncluded: true,
      });

      if (res && res.localIds.length) {
        modelIdMap[model.modelId] = new Set(res.localIds);
      }
    }

    if (Object.keys(modelIdMap).length > 0) {
      await highlighter.highlightByID(
        highlighter.config.selectName,
        modelIdMap,
        true,
        false
      );
    } else {
      await highlighter.clear(highlighter.config.selectName);
    }
  };

  viewport.addEventListener("pointerdown", onPointerDown);
}