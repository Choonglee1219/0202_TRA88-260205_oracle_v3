import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";

type TopicTableData = {
  Title: string;
  Status: string;
  Description: string;
  Author: string;
  Assignee: string;
  Date: string;
  DueDate: string;
  Type: string;
  Priority: string;
  Actions: string;
}

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

export const detailTopic = () => {
  let table: BUI.Table<TopicTableData> | null = null;

  const onTableCreated = (e?: Element) => {
    if (!e) return;
    table = e as BUI.Table<TopicTableData>;
    table.columns = [
      { name: "Title", width: "12rem" },
      { name: "Status", width: "8rem" },
      { name: "Type", width: "8rem" },
      { name: "Priority", width: "6rem" },
      { name: "Assignee", width: "10rem" },
      { name: "Author", width: "10rem" },
      { name: "Date", width: "8rem" },
      { name: "DueDate", width: "8rem" },
      { name: "Description", width: "15rem" },
    ];
  };

  const modal = BUI.Component.create<HTMLDialogElement>(() => {
    return BUI.html`
      <dialog class="detail-topic-modal" style="margin: auto; border-radius: 1rem; border: none; padding: 0; overflow: hidden;">
       <bim-panel style="width: 100rem;">
        <bim-panel-section label="Topic Details" fixed>
          <bim-table no-indentation ${BUI.ref(onTableCreated)}></bim-table>
        </bim-panel-section>
       </bim-panel> 
      </dialog>
    `;
  });

  addBackdropStyles();
  document.body.append(modal);

  const updateForm = (data: OBC.Topic | OBC.Topic[]) => {
    const topics = Array.isArray(data) ? data : [data];
    if (table) {
      table.data = topics.map((topic) => {
        return {
          data: {
            Title: topic.title,
            Status: topic.status,
            Description: topic.description ?? "",
            Author: topic.creationAuthor,
            Assignee: topic.assignedTo ?? "",
            Date: topic.creationDate.toDateString(),
            DueDate: topic.dueDate?.toDateString() ?? "",
            Type: topic.type,
            Priority: topic.priority ?? "",
            Actions: "",
          },
        };
      });
    }
    modal.showModal();
  };

  return { modal, updateForm };
};