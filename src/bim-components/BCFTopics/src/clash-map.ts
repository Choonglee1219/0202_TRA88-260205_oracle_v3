import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";
import { ClashPointData } from "./clash-result-parser";
import { clashInput } from "./clash-input";

export class ClashMapDisplay {
  private components: OBC.Components;
  private onClashSphereClicked: OBC.Event<string>;
  private onClashMapCleared: OBC.Event<void>;
  private _clashModal: HTMLDialogElement | null = null;
  public _clashSpheres: THREE.Mesh[] = [];
  public isClashMapActive = false;
  private _raycaster = new THREE.Raycaster();
  private _mouse = new THREE.Vector2();

  constructor(components: OBC.Components, onClashSphereClicked: OBC.Event<string>, onClashMapCleared: OBC.Event<void>) {
    this.components = components;
    this.onClashSphereClicked = onClashSphereClicked;
    this.onClashMapCleared = onClashMapCleared;
  }

  drawClashMap(clashData: ClashPointData[]) {
    const worlds = this.components.get(OBC.Worlds);
    const world = worlds.list.values().next().value;
    if (!world) return;

    this.clearClashMap();

    this.isClashMapActive = true;
    const highlighter = this.components.get(OBF.Highlighter);
    highlighter.enabled = false;

    const geometry = new THREE.SphereGeometry(1.0, 32, 32);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xff0000,
      depthTest: false,
      transparent: true,
      opacity: 0.8
    });

    for (const item of clashData) {
      if (item.clash_point && item.clash_point.length === 3) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
          item.clash_point[0], 
          item.clash_point[2], 
          -item.clash_point[1]
        );
        mesh.userData.topicGuid = item.clash_guid;
        world.scene.three.add(mesh);
        this._clashSpheres.push(mesh);
      }
    }

    const container = world.renderer?.three.domElement;
    if (container) {
      container.addEventListener("click", this._onClashMapClick);
    }
  }

  clearClashMap() {
    if (!this.isClashMapActive) return;
    
    this.isClashMapActive = false;
    const highlighter = this.components.get(OBF.Highlighter);
    highlighter.enabled = true;

    const worlds = this.components.get(OBC.Worlds);
    const world = worlds.list.values().next().value;
    if (world) {
      const container = world.renderer?.three.domElement;
      if (container) {
        container.removeEventListener("click", this._onClashMapClick);
      }
    }

    for (const sphere of this._clashSpheres) {
      sphere.removeFromParent();
      sphere.geometry.dispose();
    }
    if (this._clashSpheres.length > 0 && this._clashSpheres[0].material) {
        (this._clashSpheres[0].material as THREE.Material).dispose();
    }
    this._clashSpheres = [];
    
    this.onClashMapCleared.trigger();
  }

  private _onClashMapClick = (event: MouseEvent) => {
    if (!this.isClashMapActive) return;
    const worlds = this.components.get(OBC.Worlds);
    const world = worlds.list.values().next().value;
    const container = world?.renderer?.three.domElement;
    if (!world || !container) return;

    const rect = container.getBoundingClientRect();
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(this._mouse, world.camera.three);
    const intersects = this._raycaster.intersectObjects(this._clashSpheres);

    if (intersects.length > 0) {
      const clickedSphere = intersects[0].object;
      const guid = clickedSphere.userData.topicGuid;
      if (guid) {
        this.onClashSphereClicked.trigger(guid);
      }
    }
  };

  openClashDetectionModal(onComplete: (buffer: ArrayBuffer, clashData: ClashPointData[]) => Promise<void>) {
    if (!this._clashModal) {
      this._clashModal = clashInput(this.components, onComplete);
    }
    this._clashModal?.showModal();
  }
}