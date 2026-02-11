import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { BCFTopics, newTopic, updateTopic } from "../../bim-components/BCFTopics";
import { topicListTable } from "../../ui-components/TopicList";
import { appIcons } from "../../globals";

export interface TopicListState {
  components: OBC.Components;
}

export const topicListTemplate: BUI.StatefullComponent<
  TopicListState
> = (state) => {
  const { components } = state;
  const bcfTopics = components.get(BCFTopics);
  const table = topicListTable(components);
  const newTopicModal = newTopic(components);
  const updateTopicModal = updateTopic(bcfTopics);

  bcfTopics.setupTable(table);

  return BUI.html`
    <bim-panel-section fixed icon=${appIcons.TASK} label="Topic List">
      <div style="display: flex; gap: 0.25rem">
        <bim-button @click=${() => bcfTopics.importBCF()} label="Import BCF" icon=${appIcons.IMPORT}></bim-button>
        <bim-button @click=${() => bcfTopics.exportBCF()} label="Export BCF" icon=${appIcons.EXPORT}></bim-button>
        <bim-button @click=${() => bcfTopics.saveBCFToDB()} label="Save To DB" icon=${appIcons.SAVE}></bim-button>
        <bim-button @click=${() => newTopicModal.showModal()} label="Create Topic" icon=${appIcons.ADD}></bim-button>
        <bim-button @click=${() => updateTopicModal.showModal(table.selection)} label="Update Topic" icon=${appIcons.REF}></bim-button>
        <bim-button @click=${() => bcfTopics.delete(table.selection)} label="Delete Topic" icon=${appIcons.DELETE}></bim-button>
      </div>
      ${table}
    </bim-panel-section>
  `;
};

export const topicList = (state: TopicListState) => {
  return BUI.Component.create<BUI.Panel, TopicListState>(topicListTemplate, state);
};