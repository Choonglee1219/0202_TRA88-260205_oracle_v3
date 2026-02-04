import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";

const addBackdropStyles = () => {
  const styleId = "detail-topic-modal-styles";
  if (document.getElementById(styleId)) return;
  const styles = `
    dialog.detail-topic-modal::backdrop {
      backdrop-filter: blur(4px);
      background-color: rgba(0, 0, 0, 0.4);
    }
  `;
  const styleElement = document.createElement("style");
  styleElement.id = styleId;
  styleElement.textContent = styles;
  document.head.append(styleElement);
};

export const detailTopic = (bcfTopics: any) => {
  const components = bcfTopics.components as OBC.Components;
  const bcf = components.get(OBC.BCFTopics);

  let currentTopic: OBC.Topic | null = null;

  const titleInput = document.createElement("bim-text-input") as BUI.TextInput;
  titleInput.label = "Title";
  titleInput.vertical = true;

  const typeDropdown = document.createElement("bim-dropdown") as BUI.Dropdown;
  typeDropdown.label = "Type";
  typeDropdown.vertical = true;

  const priorityDropdown = document.createElement("bim-dropdown") as BUI.Dropdown;
  priorityDropdown.label = "Priority";
  priorityDropdown.vertical = true;

  const labelsDropdown = document.createElement("bim-dropdown") as BUI.Dropdown;
  labelsDropdown.label = "Labels";
  labelsDropdown.vertical = true;
  labelsDropdown.multiple = true;

  const assigneeDropdown = document.createElement("bim-dropdown") as BUI.Dropdown;
  assigneeDropdown.label = "Assignee";
  assigneeDropdown.vertical = true;

  const dueDateInput = document.createElement("bim-text-input") as BUI.TextInput;
  dueDateInput.label = "Due Date";
  dueDateInput.vertical = true;
  dueDateInput.type = "date";

  const statusDropdown = document.createElement("bim-dropdown") as BUI.Dropdown;
  statusDropdown.label = "Status";
  statusDropdown.vertical = true;

  const stageDropdown = document.createElement("bim-dropdown") as BUI.Dropdown;
  stageDropdown.label = "Stage";
  stageDropdown.vertical = true;

  const descriptionInput = document.createElement("bim-text-input") as BUI.TextInput;
  descriptionInput.label = "Description";
  descriptionInput.vertical = true;
  descriptionInput.type = "area";
  descriptionInput.rows = 5;
  descriptionInput.resize = "vertical";

  const onCancel = () => {
    modal.close();
  };

  const onUpdate = async () => {
    if (!currentTopic) return;
    
    currentTopic.title = titleInput.value;
    if (typeDropdown.value.length > 0) currentTopic.type = typeDropdown.value[0];
    if (priorityDropdown.value.length > 0) currentTopic.priority = priorityDropdown.value[0];
    if (statusDropdown.value.length > 0) currentTopic.status = statusDropdown.value[0];
    if (stageDropdown.value.length > 0) (currentTopic as any).stage = stageDropdown.value[0];
    if (assigneeDropdown.value.length > 0) currentTopic.assignedTo = assigneeDropdown.value[0];
    
    currentTopic.description = descriptionInput.value;
    
    if (dueDateInput.value) {
      currentTopic.dueDate = new Date(dueDateInput.value);
    } else {
      currentTopic.dueDate = undefined;
    }

    currentTopic.labels = new Set(labelsDropdown.value);

    await bcf.list.set(currentTopic.guid, currentTopic);
    modal.close();
  };

  const modal = BUI.Component.create<HTMLDialogElement>(() => {
    return BUI.html`
      <dialog class="detail-topic-modal" style="margin: auto; border-radius: 1rem; border: none; padding: 0; overflow: hidden;">
       <bim-panel style="width: 50rem;">
        <bim-panel-section label="Topic Details" fixed>
          ${titleInput}
          <div style="display: flex; gap: 0.5rem;">
            ${typeDropdown}
            ${priorityDropdown}
          </div>
          <div style="display: flex; gap: 0.5rem;">
            ${labelsDropdown}
            ${assigneeDropdown}
          </div>
          <div style="display: flex; gap: 0.5rem;">
            ${dueDateInput}
            ${stageDropdown}
          </div>
        ${descriptionInput}
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem; align-items: flex-end;">
            ${statusDropdown}
            <bim-button style="flex: 0;" label="Cancel" icon="close" @click=${onCancel}></bim-button>
            <bim-button style="flex: 0;" label="Update" icon="done" @click=${onUpdate}></bim-button>
          </div>
        </bim-panel-section>
       </bim-panel> 
      </dialog>
    `;
  });

  addBackdropStyles();
  document.body.append(modal);

  const updateForm = (topic: OBC.Topic) => {
    currentTopic = topic;
    titleInput.value = topic.title;
    descriptionInput.value = topic.description ?? "";
    
    const populate = (dropdown: BUI.Dropdown, values: Set<string> | string[] | undefined, selected?: string | Set<string>) => {
      const options: HTMLElement[] = [];
      if (values) {
        for (const val of values) {
          const opt = document.createElement("bim-option") as any;
          opt.label = val;
          opt.value = val;
          if (selected) {
            if (typeof selected === "string" && val === selected) opt.checked = true;
            else if (selected instanceof Set && selected.has(val)) opt.checked = true;
          }
          options.push(opt);
        }
      }
      // 'elements' is a protected property of BUI.Component.
      // We cast to 'any' to access it and clear the internal cache of the dropdown
      // to prevent option duplication issues when repopulating.
      if ((dropdown as any).elements) {
        (dropdown as any).elements.clear();
      }
      dropdown.replaceChildren(...options);
    };

    populate(typeDropdown, bcf.config.types, topic.type);
    populate(priorityDropdown, bcf.config.priorities, topic.priority);
    populate(labelsDropdown, bcf.config.labels, topic.labels);
    populate(assigneeDropdown, bcf.config.users, topic.assignedTo);
    populate(stageDropdown, bcf.config.stages, topic.stage);
    populate(statusDropdown, bcf.config.statuses, topic.status);
    
    if (topic.dueDate) {
      dueDateInput.value = topic.dueDate.toISOString().split('T')[0];
    } else {
      dueDateInput.value = "";
    }
    
    modal.showModal();
  };

  const showModal = (selection: Set<any>) => {
    const selectedTopics = bcfTopics.getSelectedTopics(selection);
    if (selectedTopics.length > 0) {
      updateForm(selectedTopics[0]);
    }
  };

  return { modal, showModal };
};