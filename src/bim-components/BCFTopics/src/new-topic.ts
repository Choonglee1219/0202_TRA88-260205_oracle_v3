import * as BUI from "@thatopen/ui";
import * as CUI from "@thatopen/ui-obc";
import * as OBC from "@thatopen/components";
import { users } from "../../../globals";

const addBackdropStyles = () => {
  const styleId = "new-topic-modal-styles";
  if (document.getElementById(styleId)) return;
  const styles = `
    dialog.new-topic-modal::backdrop {
      backdrop-filter: blur(4px);
      background-color: rgba(0, 0, 0, 0.4);
    }
  `;
  const styleElement = document.createElement("style");
  styleElement.id = styleId;
  styleElement.textContent = styles;
  document.head.append(styleElement);
};

export const newTopic = (components: OBC.Components) => {
  const bcf = components.get(OBC.BCFTopics);
  const [topicForm, updateTopicForm] = CUI.forms.topic({
    components,
    styles: { users },
  });

  const authorDropdown = document.createElement("bim-dropdown") as BUI.Dropdown;
  authorDropdown.label = "Author";
  authorDropdown.vertical = true;

  for (const [email, user] of Object.entries(users)) {
    const option = document.createElement("bim-option") as any;
    option.label = user.name;
    option.value = email;
    if (user.picture) option.setAttribute("img", user.picture);
    authorDropdown.append(option);
  }

  if (bcf.config.author) {
    authorDropdown.value = [bcf.config.author];
  }

  authorDropdown.addEventListener("change", () => {
    if (authorDropdown.value.length > 0) {
      bcf.config.author = authorDropdown.value[0];
    }
  });

  const modal = BUI.Component.create<HTMLDialogElement>(() => {
    return BUI.html`
      <dialog class="new-topic-modal" style="margin: auto; border-radius: 1rem; border: none; padding: 0; overflow: hidden;">
       <bim-panel style="width: 50rem;">
        <bim-panel-section label="Author" fixed>
          ${authorDropdown}
        </bim-panel-section>
        ${topicForm}
       </bim-panel> 
      </dialog>
    `;
  });

  addBackdropStyles();
  document.body.append(modal);

  updateTopicForm({
    onCancel: () => {
      modal.close();
    },
    onSubmit: () => {
      modal.close();
      alert("변경사항을 공유하려면 Save BCF 버튼을 눌러 데이터베이스에 저장하십시오.");
    },
  });

  return modal;
};