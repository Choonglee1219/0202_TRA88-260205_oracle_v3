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
  const [topicForm, updateTopicForm] = CUI.forms.topic({
    components,
    styles: { users },
  });

  const modal = BUI.Component.create<HTMLDialogElement>(() => {
    return BUI.html`
      <dialog class="new-topic-modal" style="margin: auto; border-radius: 1rem; border: none; padding: 0; overflow: hidden;">
       <bim-panel style="width: 50rem;">
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
    },
  });

  return modal;
};