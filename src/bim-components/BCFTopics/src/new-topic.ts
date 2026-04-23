import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { users } from "../../../setup/users";
import { topicFormTemplate, TopicFormUI } from "../../../ui-components/TopicsList/src/form-template";

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

  const formTemplate = (state: TopicFormUI) => {
    return BUI.html`
      <bim-panel-section fixed label="New Topic" name="topic">
        ${topicFormTemplate(state)}
      </bim-panel-section>
    `;
  };

  const [topicForm, updateTopicForm] = BUI.Component.create<BUI.Panel, TopicFormUI>(
    formTemplate,
    {
      components,
      styles: { users },
    }
  );

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
      
      setTimeout(() => {
        const bcfTopics = components.get(OBC.BCFTopics);
        const worlds = components.get(OBC.Worlds);
        const world = worlds.list.values().next().value;
        if (world && world.renderer) {
          world.renderer.three.render(world.scene.three, world.camera.three);
          const dataUrl = world.renderer.three.domElement.toDataURL("image/png");
          
          const topicsArray = Array.from(bcfTopics.list.values());
          if (topicsArray.length > 0) {
            const lastTopic = topicsArray[topicsArray.length - 1];
            (lastTopic as any).snapshot = dataUrl;
            bcfTopics.list.onItemUpdated.trigger({ key: lastTopic.guid, value: lastTopic });
          }
        }
      }, 100);

      alert("변경사항을 공유하려면 Save BCF 버튼을 눌러 데이터베이스에 저장하십시오.");
    },
  });

  const originalShowModal = modal.showModal.bind(modal);
  modal.showModal = () => {
    updateTopicForm({
      components,
      styles: { users },
    });
    originalShowModal();
  };

  return modal;
};