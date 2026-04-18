import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { users } from "../../globals";
import { ClashPointData } from "./src/clash-result-parser";
import { BCFFileOperations } from "./src/bcf-file-operations";
import { ClashMapDisplay } from "./src/clash-map";
import { TopicViewpointManager } from "./src/topic-viewpoint";

export * from "./src/new-topic";
export * from "./src/update-topic";
export * from "./src/clash-input";

export class BCFTopics extends OBC.Component {
  static uuid = "e7526972-853c-4392-b6c6-33435e123456" as const;
  enabled = true;
  readonly onRefresh = new OBC.Event<void>();
  public _bcf: OBC.BCFTopics;
  private _loading = false;

  // Events for ClashMapDisplay to trigger
  readonly onClashSphereClicked = new OBC.Event<string>();
  readonly onClashMapCleared = new OBC.Event<void>();

  private bcfFileOperations: BCFFileOperations;
  private clashMapDisplay: ClashMapDisplay;
  private topicViewpointManager: TopicViewpointManager;

  get list() {
    return this._bcf.list;
  }

  get isClashMapActive() {
    return this.clashMapDisplay.isClashMapActive;
  }

  clearClashMap() {
    this.clashMapDisplay.clearClashMap();
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

    // Initialize helper classes
    this.clashMapDisplay = new ClashMapDisplay(this.components, this.onClashSphereClicked, this.onClashMapCleared);
    this.topicViewpointManager = new TopicViewpointManager(this.components, this.clashMapDisplay);
    this.bcfFileOperations = new BCFFileOperations(this);

    this._bcf.list.onItemSet.add(async ({ value: topic }) => {
      if (this._loading) return;
      await this.topicViewpointManager.createViewpointForTopic(topic);
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

  async restoreViewpoint(topic: OBC.Topic, options?: { updateSnapshot?: boolean }): Promise<boolean> {
    return this.topicViewpointManager.restoreViewpoint(topic, options);
  }

  setupTable(table: BUI.Table<any>) {
    table.dataTransform.Title = (value: any, row: any) => {
      return BUI.html`
        <bim-label data-topic-guid=${row.Guid} style="cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" @click=${async () => {
          const topic = this.list.get(row.Guid);
          if (topic) await this.restoreViewpoint(topic);
        }}>${value}</bim-label>
      `;
    };
  }

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
      alert("변경사항을 공유하려면 Save BCF 버튼을 눌러 데이터베이스에 저장하십시오.");
    }
  }

  deleteAll() {
    if (this.list.size === 0) return;
    const confirmation = confirm(`현재 토픽 목록(Topic List)에 있는 ${this.list.size}개의 토픽을 삭제하시겠습니까?`);
    if (confirmation) {
      const guids = Array.from(this.list.keys());
      for (const guid of guids) {
        this._bcf.list.delete(guid);
      }
    }
  }

  importBCF() {
    this.bcfFileOperations.importBCF();
  }

  exportBCF(name?: string) {
    this.bcfFileOperations.exportBCF(name);
  }

  saveBCF() {
    this.bcfFileOperations.saveBCF();
  }

  exportJSON() {
    this.bcfFileOperations.exportJSON();
  }

  saveBCFToDB() {
    this.bcfFileOperations.saveBCFToDB();
  }

  async loadBCFContent(buffer: ArrayBuffer | Uint8Array) {
    this._loading = true;
    try {
      await this.bcfFileOperations.loadBCFContent(buffer);
    } finally {
      this._loading = false;
    }
  }

  drawClashMap(clashData: ClashPointData[]) {
    this.clashMapDisplay.drawClashMap(clashData);
  }

  openClashDetectionModal() {
    this.clashMapDisplay.openClashDetectionModal(async () => {
      // 간섭 체크 완료 후 무거운 자동 로드(프리징 원인)를 생략하고 목록 갱신 이벤트만 발생시켜 BCF List에 새 항목 표시
      this.onRefresh.trigger();
    });
  }
}
