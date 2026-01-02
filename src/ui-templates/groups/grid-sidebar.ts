import * as BUI from "@thatopen/ui";
import { appIcons } from "../../globals";

export interface GridSidebarState {
  grid: BUI.Grid<any, any>;
  isCompact: boolean;
  layoutIcons: Record<string, string>;
}

export const gridSidebarTemplate: BUI.StatefullComponent<GridSidebarState> = (
  state,
  update,
) => {
  const { grid, isCompact, layoutIcons } = state;

  const onToggleCompact = () => {
    update({ isCompact: !state.isCompact });
  };

  const containerStyle = {
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    borderRight: "1px solid var(--bim-ui_bg-contrast-40)",
    padding: "0.5rem",
  };

  const collapseBtnStyle = {
    width: "fit-content",
    flex: "0",
    backgroundColor: "transparent",
    borderRadius: isCompact ? "100%" : "0",
  };

  return BUI.html`
  <div style=${BUI.styleMap(containerStyle)}>
    <div class="sidebar">
      ${Object.keys(grid.layouts).map((layout) => {
        const layoutIcon = layoutIcons[layout];
        const icon = !layoutIcon ? appIcons.LAYOUT : layoutIcon;
        return BUI.html`
          <bim-button ?active=${grid.layout === layout} @click=${() => (grid.layout = layout)} ?label-hidden=${isCompact} icon=${icon} label=${layout}></bim-button>
        `;
      })}
    </div>
    <bim-button ?label-hidden=${isCompact} label="Collapse" style=${BUI.styleMap(collapseBtnStyle)} icon=${isCompact ? appIcons.RIGHT : appIcons.LEFT} @click=${onToggleCompact}></bim-button>
  </div>
`;
};
