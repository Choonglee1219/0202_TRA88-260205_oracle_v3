import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";

export class Measurer extends OBC.Component {
  static uuid = "939bb2bc-7d31-4a44-811d-68e4dd286c35" as const;
  enabled = true;

  constructor(components: OBC.Components) {
    super(components);
    components.add(Measurer.uuid, this);
  }

  async getMeasure() {
    const highlighter = this.components.get(OBF.Highlighter);
    const modelIdMap = highlighter.selection.select;
    if (OBC.ModelIdMapUtils.isEmpty(modelIdMap)) return;

    const measurer = this.components.get(OBF.LengthMeasurement);
    measurer.list.clear();

    const fragments = this.components.get(OBC.FragmentsManager);
    for (const [modelId, localIds] of Object.entries(modelIdMap)) {
      if (localIds.size !== 2) continue;
      const model = fragments.list.get(modelId);
      if (!model) continue;

      const [boxA, boxB] = await model.getBoxes([...localIds]);

      const closestPoints = this.getClosestPoints(boxA, boxB);
      if (closestPoints) {
        const [pointA, pointB] = closestPoints;

        const line = new THREE.Line3(pointA, pointB);
        const direction = new THREE.Vector3();
        line.delta(direction);
        direction.normalize();

        direction.set(
          Math.abs(direction.x) >= Math.abs(direction.y) &&
            Math.abs(direction.x) >= Math.abs(direction.z)
            ? 1
            : 0,
          Math.abs(direction.y) >= Math.abs(direction.x) &&
            Math.abs(direction.y) >= Math.abs(direction.z)
            ? 1
            : 0,
          Math.abs(direction.z) >= Math.abs(direction.x) &&
            Math.abs(direction.z) >= Math.abs(direction.y)
            ? 1
            : 0,
        );

        const planeA = new THREE.Plane().setFromNormalAndCoplanarPoint(
          direction,
          boxA.min,
        );

        const targetA = new THREE.Vector3();
        planeA.projectPoint(boxB.min, targetA);
        const lineA = new THREE.Line3(boxB.min, targetA);

        const targetB = new THREE.Vector3();
        planeA.projectPoint(boxB.max, targetB);
        const lineB = new THREE.Line3(boxB.max, targetB);

        const closestBoundaryA =
          lineA.distance() < lineB.distance() ? lineA : lineB;

        const planeB = new THREE.Plane().setFromNormalAndCoplanarPoint(
          direction,
          boxA.max,
        );

        const targetC = new THREE.Vector3();
        planeB.projectPoint(boxB.min, targetC);
        const lineC = new THREE.Line3(boxB.min, targetC);

        const targetD = new THREE.Vector3();
        planeB.projectPoint(boxB.max, targetD);
        const lineD = new THREE.Line3(boxB.max, targetD);

        const closestBoundaryB =
          lineC.distance() < lineD.distance() ? lineC : lineD;

        const closestBoundary =
          closestBoundaryA.distance() < closestBoundaryB.distance()
            ? closestBoundaryA
            : closestBoundaryB;

        measurer.list.add(
          new OBF.Line(closestBoundary.start, closestBoundary.end),
        );
      }
    }
  }

  getClosestPoints = (boxA: THREE.Box3, boxB: THREE.Box3) => {
    const pointsA = [boxA.min, boxA.max];
    const pointsB = [boxB.min, boxB.max];

    let minDistance = Infinity;
    let closestPair: [THREE.Vector3, THREE.Vector3] | null = null;

    for (const pointA of pointsA) {
      for (const pointB of pointsB) {
        const distance = pointA.distanceTo(pointB);
        if (distance < minDistance) {
          minDistance = distance;
          closestPair = [pointA, pointB];
        }
      }
    }

    return closestPair;
  };
}

export * from "./src";
