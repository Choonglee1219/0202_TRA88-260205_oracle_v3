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

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    table.queryString = input.value;
  };

  return BUI.html`
    <bim-panel-section fixed icon=${appIcons.TASK} label="Topic List">
      <div style="display: flex; gap: 0.5rem;">
        <div style="display: flex; gap: 0.25rem; flex: 1;">
          <bim-button style="flex: 1;" @click=${() => newTopicModal.showModal()} label="Create Topic" icon=${appIcons.ADD}></bim-button>
          <bim-button style="flex: 1;" @click=${() => updateTopicModal.showModal(table.selection)} label="Update Topic" icon=${appIcons.REF}></bim-button>
          <bim-button style="flex: 1;" @click=${() => bcfTopics.delete(table.selection)} label="Delete Topic" icon=${appIcons.DELETE}></bim-button>
          <bim-button style="flex: 1;" @click=${() => bcfTopics.deleteAll()} label="Clear List" icon=${appIcons.CLEAR}></bim-button>
          <bim-button style="flex: 1;" @click=${() => bcfTopics.saveBCF()} label="Save BCF" icon=${appIcons.SAVE}></bim-button>
        </div>
        <bim-text-input @input=${onSearch} vertical placeholder="Search..." debounce="200" style="flex: 1;"></bim-text-input>
      </div>
      ${table}
    </bim-panel-section>
  `;
};

export const topicList = (state: TopicListState) => {
  return BUI.Component.create<BUI.Panel, TopicListState>(topicListTemplate, state);
};