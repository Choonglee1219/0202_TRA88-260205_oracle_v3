import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";
import * as THREE from "three";
import { setModelTransparent } from "../../../ui-templates/toolbars/viewer-toolbar";
import { ClashMapDisplay } from "./clash-map";
import { Highlighter } from "../../Highlighter";

export class TopicViewpointManager {
  private components: OBC.Components;
  private clashMapDisplay: ClashMapDisplay;

  constructor(components: OBC.Components, clashMapDisplay: ClashMapDisplay) {
    this.components = components;
    this.clashMapDisplay = clashMapDisplay;
  }

  async createViewpointForTopic(topic: OBC.Topic) {
    const viewpoints = this.components.get(OBC.Viewpoints);
    const viewpoint = viewpoints.create();
    const worlds = this.components.get(OBC.Worlds);
    const world = worlds.list.values().next().value;
    if (world) {
      viewpoint.world = world;
      await viewpoint.updateCamera();

      if (world.renderer) {
        world.renderer.three.render(world.scene.three, world.camera.three);
        (topic as any).snapshot = world.renderer.three.domElement.toDataURL("image/png");
      }
    }

    const highlighter = this.components.get(Highlighter);
    const selection = highlighter.selection.select;
    if (Object.keys(selection).length > 0) {
      const fragments = this.components.get(OBC.FragmentsManager);
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
  }

  async restoreViewpoint(topic: OBC.Topic, options?: { updateSnapshot?: boolean }): Promise<boolean> {
    if (topic.viewpoints.size > 0) {
      const viewpointGuid = topic.viewpoints.values().next().value;
      if (viewpointGuid) {
        const viewpoints = this.components.get(OBC.Viewpoints);
        const viewpoint = viewpoints.list.get(viewpointGuid);
        if (viewpoint?.world) {
          await viewpoint.go();
          const highlighter = this.components.get(Highlighter);
          await highlighter.clear();
          const fragments = this.components.get(OBC.FragmentsManager);

          // 카메라 줌인을 위해 Sphere의 위치를 지워지기 전에 미리 복사해 둡니다.
          let targetSpherePosition: THREE.Vector3 | null = null;
          const clashPoint = (topic as any).clashPoint;
          if (clashPoint && Array.isArray(clashPoint) && clashPoint.length === 3) {
            targetSpherePosition = new THREE.Vector3(clashPoint[0], clashPoint[2], -clashPoint[1]);
          }

          // Clash Map이 활성화되어 있다면 종료하여 Highlighter를 켤 수 있게 합니다.
          if (this.clashMapDisplay.isClashMapActive) {
            this.clashMapDisplay.clearClashMap();
          }

          // Restore Selection
          const guids = Array.from(viewpoint.selectionComponents);
          if (guids.length > 0) {
            const modelIdMap = await fragments.guidsToModelIdMap(guids);
            setModelTransparent(this.components);
            await highlighter.highlightByID("select", modelIdMap);
          }

          // Restore Colors
          for (const [colorHex, guids] of viewpoint.componentColors) {
            if (!guids || guids.length === 0) continue;
            const styleName = `#${colorHex}`;
            highlighter.styles.set(styleName, {
              color: new THREE.Color(styleName),
              renderedFaces: FRAGS.RenderedFaces.ONE,
              opacity: 0.1,
              transparent: true,
              depthTest: false,
            });
            const colorModelIdMap = await fragments.guidsToModelIdMap(guids);
            await highlighter.highlightByID(styleName, colorModelIdMap, false, false);
          }

          const camera = viewpoint.world.camera as OBC.OrthoPerspectiveCamera;
          
          // 타겟 Sphere 좌표가 존재했다면 그곳으로 줌인
          if (targetSpherePosition) {
            const sphereBound = new THREE.Sphere(targetSpherePosition, 1.0);
            await camera.controls.fitToSphere(sphereBound, true);

            if (options?.updateSnapshot) {
              // 스냅샷을 찍기 전 잠시 대기하여 렌더링이 완료되도록 합니다.
              await new Promise(resolve => setTimeout(resolve, 200));
              const world = viewpoint.world;
              if (world.renderer) {
                world.renderer.three.render(world.scene.three, world.camera.three);
                (topic as any).snapshot = world.renderer.three.domElement.toDataURL("image/png");
                return true; // 스냅샷이 촬영되었음을 알립니다.
              }
            }

          } else {
            const guidsForCenter = Array.from(viewpoint.selectionComponents);
            if (guidsForCenter.length > 0) {
              const centerModelIdMap = await fragments.guidsToModelIdMap(guidsForCenter);
              const bboxes = await fragments.getBBoxes(centerModelIdMap);
              if (bboxes.length > 0) {
                const itemBox = new THREE.Box3();
                for (const box of bboxes) {
                  itemBox.union(box);
                }
                const sphereBound = new THREE.Sphere();
                itemBox.getBoundingSphere(sphereBound);
                sphereBound.radius *= 1.2;
                await camera.controls.fitToSphere(sphereBound, true);
              }
            }
          }
        }
      }
    }
    return false; // 스냅샷이 촬영되지 않았음을 알립니다.
  }
}