import * as BUI from "@thatopen/ui";
import { quantityChartTemplate } from "..";

const addBackdropStyles = () => {
  const styleId = "quantity-chart-modal-styles";
  if (document.getElementById(styleId)) return;
  const styles = `
    dialog.quantity-chart-modal::backdrop {
      backdrop-filter: blur(4px);
      background-color: rgba(0, 0, 0, 0.4);
    }
  `;
  const styleElement = document.createElement("style");
  styleElement.id = styleId;
  styleElement.textContent = styles;
  document.head.append(styleElement);
};

export const quantityChartModal = () => {
  const [chart, updateChart] = BUI.Component.create(
    quantityChartTemplate,
    { elementData: [] }
  );

  const modal = BUI.Component.create<HTMLDialogElement>(() => {
    return BUI.html`
      <dialog class="quantity-chart-modal" style="margin: auto; border-radius: 1rem; border: none; padding: 0; overflow: hidden; resize: both; width: 70vw; height: 75vh; min-width: 50rem; min-height: 35rem;">
        <bim-panel style="width: 100%; height: 100%;">
          <bim-panel-section label="Quantity Summary">
            ${chart}
          </bim-panel-section>
          <div style="display: flex; justify-content: flex-end; padding: 0 1rem 1rem 1rem;">
            <bim-button @click=${() => modal.close()} label="Close"></bim-button>
          </div>
        </bim-panel> 
      </dialog>
    `;
  });

  addBackdropStyles();
  document.body.append(modal);

  // Attach a custom method to show the modal with data
  (modal as any).show = (elementData: any[]) => {
    updateChart({ elementData });
    modal.showModal();
  };

  return modal;
};