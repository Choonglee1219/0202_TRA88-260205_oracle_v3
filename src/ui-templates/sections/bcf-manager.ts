import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { BCFTopics, newTopic, detailTopic } from "../../bim-components/BCFTopics";
import { topicsListTable } from "../../ui-components/TopicsList";
import { appIcons } from "../../globals";

export interface BCFManagerState {
  components: OBC.Components;
}

export const bcfManagerTemplate: BUI.StatefullComponent<
  BCFManagerState
> = (state) => {
  const { components } = state;
  const bcfTopics = components.get(BCFTopics);
  const table = topicsListTable(components);
  const newTopicModal = newTopic(components);
  const detailTopicModal = detailTopic(bcfTopics);

  bcfTopics.setupTable(table);

  return BUI.html`
    <bim-panel-section fixed icon=${appIcons.TASK} label="Topics List">
      <div style="display: flex; gap: 0.25rem">
        <bim-button @click=${() => bcfTopics.export()} label="Export BCF" icon=${appIcons.EXPORT}></bim-button>
        <bim-button @click=${() => bcfTopics.loadBCF()} label="Load BCF" icon=${appIcons.IMPORT}></bim-button>
        <bim-button @click=${() => newTopicModal.showModal()} label="Create Topic" icon=${appIcons.ADD}></bim-button>
        <bim-button @click=${() => detailTopicModal.showModal(table.selection)} label="Update Topic" icon=${appIcons.REF}></bim-button>
        <bim-button @click=${() => bcfTopics.delete(table.selection)} label="Delete" icon=${appIcons.DELETE}></bim-button>
      </div>
      ${table}
    </bim-panel-section>
  `;
};

export const bcfManager = (state: BCFManagerState) => {
  return BUI.Component.create<BUI.Panel, BCFManagerState>(bcfManagerTemplate, state);
};