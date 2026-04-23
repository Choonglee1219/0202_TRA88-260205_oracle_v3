import * as CUI from "@thatopen/ui-obc";
import * as BUI from "@thatopen/ui";

export const CONTENT_GRID_ID = "app-content";
export const CONTENT_GRID_GAP = "1rem";
export const SMALL_COLUMN_WIDTH = "22rem";
export const MEDIUM_COLUMN_WIDTH = "25rem";

export const appIcons = {
  ADD: "/icons/mdi--plus.svg",
  SELECT: "/icons/solar--cursor-bold.svg",
  CLIPPING: "/icons/fluent--cut-16-filled.svg",
  SHOW: "/icons/mdi--eye.svg",
  HIDE: "/icons/mdi--eye-off.svg",
  LEFT: "/icons/tabler--chevron-compact-left.svg",
  RIGHT: "/icons/tabler--chevron-compact-right.svg",
  SETTINGS: "/icons/solar--settings-bold.svg",
  COLORIZE: "/icons/famicons--color-fill.svg",
  EXPAND: "/icons/eva--expand-fill.svg",
  EXPORT: "/icons/ph--export-fill.svg",
  IMPORT: "/icons/mdi--import.svg",
  TASK: "/icons/material-symbols--task.svg",
  CAMERA: "/icons/solar--camera-bold.svg",
  FOCUS: "/icons/ri--focus-mode.svg",
  TRANSPARENT: "/icons/mdi--ghost.svg",
  ISOLATE: "/icons/mdi--selection-ellipse.svg",
  RULER: "/icons/solar--ruler-bold.svg",
  MODEL: "/icons/mage--box-3d-fill.svg",
  TREE: "/icons/mdi--file-tree-outline.svg",
  LAYOUT: "/icons/tabler--layout-filled.svg",
  SEARCH: "/icons/gravity-ui--magnifier.svg",
  FULL_SCREEN: "/icons/mdi--fit-to-screen.svg",
  HELP: "/icons/mdi--help.svg",
  LINK: "/icons/mdi--external-link.svg",
  SAVE: "/icons/material-symbols--save.svg",
  REF: "/icons/mdi--file-document-outline.svg",
  OBSIDIAN: "/icons/simple-icons--obsidian.svg",
  PLANT: "/icons/openmoji--nuclear-power-plant.svg",
  OPEN: "/icons/mdi--open-in-app.svg",
  DOWNLOAD: "/icons/oi--cloud-download.svg",
  DELETE: "/icons/mdi--delete-forever.svg",
  EDIT: "/icons/mdi--edit.svg",
  REFRESH: "/icons/mdi--refresh.svg",
  CLEAR: "/icons/mdi--clear-circle-outline.svg",
  CLASH: "/icons/openmoji--overlapping-white-squares.svg",
  HOLD: "/icons/flowbite--circle-pause-outline.svg",
  MINOR: "/icons/mingcute--arrows-down-fill.svg",
  NORMAL: "/icons/fa7--grip-lines.svg",
  MAJOR: "/icons/mingcute--arrows-up-fill.svg",
  CRITICAL: "/icons/ph--warning.svg",
  STATUS: "/icons/prime--circle-fill.svg",
  IMAGE: "/icons/mdi--image-outline.svg",
  CHART: "/icons/mdi--chart-bar.svg",
  MAP: "/icons/mdi--map-marker-radius.svg",
  PLAY: "/icons/mdi--play.svg",
  IDS_CHECK: "/icons/mdi--check-bold.svg",
  TABLE: "/icons/mdi--table-filter.svg",
  BACK: "/icons/eva--arrow-ios-back-outline.svg",
  FORWARD: "/icons/eva--arrow-ios-forward-outline.svg",
  FLY: "/icons/mdi--airplane.svg",
  COMPASS: "/icons/mdi--compass.svg",
};

export const onToggleSection = (e: Event) => {
  const header = e.currentTarget as HTMLElement;
  const wrapper = header.parentElement as HTMLElement;
  const content = header.nextElementSibling as HTMLElement;
  const icon = header.querySelector(".toggle-icon") as any;
  
  if (content.style.display === "none") {
    content.style.display = "flex";
    icon.icon = appIcons.MINOR;
    if (wrapper.dataset.flex === "true") wrapper.style.flex = "1";
  } else {
    content.style.display = "none";
    icon.icon = appIcons.RIGHT;
    if (wrapper.dataset.flex === "true") wrapper.style.flex = "none";
  }
};

export const tooltips = {
  FOCUS: {
    TITLE: "Items Focusing (F)",
    TEXT: "Move the camera to focus the selected items. If no items are selected, all models will be focused.",
  },
  HIDE: {
    TITLE: "Hide Selection (H)",
    TEXT: "Hide the currently selected items.",
  },
  ISOLATE: {
    TITLE: "Isolate Selection (I)",
    TEXT: "Hide everything expect the currently selected items.",
  },
  GHOST: {
    TITLE: "Ghost Mode (G)",
    TEXT: "Set all models transparent, so selections and colors can be seen better.",
  },
  SHOW_ALL: {
    TITLE: "Show All Items (A)",
    TEXT: "Reset the visibility of all hidden items, so they become visible again.",
  },
  CLEARANCE: {
    TITLE: "Clearance Check",
    TEXT: "Measure the North-South or East-West clearance of the two selected objects.",
  },
};

export const users: CUI.TopicUserStyles = {
  "jhon.doe@example.com": {
    name: "John Doe",
    picture: "/profiles/john.jpg",
  },
  "user_a@something.com": {
    name: "User A",
    picture: "/profiles/user_a.jpg",
  },
  "user_b@something.com": {
    name: "User B",
    picture: "/profiles/user_b.jpg",
  },
};

export const tableDefaultContentTemplate = (value: any) => {
  const text = value !== null && value !== undefined ? String(value) : "";
  return BUI.html`<bim-label style="display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; width: 100%;" title=${text}>${text}</bim-label>`;
};

export const onTableCellCreated = (e: Event) => {
  const { detail } = e as CustomEvent<BUI.CellCreatedEventDetail<any>>;
  if (!detail) return;
  const { cell } = detail;
  cell.style.border = `1px solid var(--bim-ui_bg-contrast-20)`;
  cell.style.padding = "4px 8px";

  cell.style.whiteSpace = "nowrap";
  cell.style.overflow = "hidden";
  cell.style.textOverflow = "ellipsis";
  cell.style.userSelect = "text";
  cell.style.cursor = "copy";
  cell.style.minWidth = "0";

  // 우클릭 시 텍스트를 클립보드에 바로 복사
  cell.addEventListener("contextmenu", async (evt) => {
    evt.preventDefault();
    let textToCopy = cell.shadowRoot?.textContent?.trim() || cell.textContent?.trim();
    if (!textToCopy) {
      const col = (cell as any).column;
      if (col && cell.rowData && (cell.rowData as any)[col] !== undefined) {
        textToCopy = String((cell.rowData as any)[col]);
      }
    }
    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        const originalBg = cell.style.backgroundColor;
        cell.style.backgroundColor = "var(--bim-ui_bg-contrast-20)";
        setTimeout(() => { cell.style.backgroundColor = originalBg; }, 150);
      } catch (err) {}
    }
  });
};

export const onTableRowCreated = (e: Event) => {
  const customEvent = e as CustomEvent<BUI.RowCreatedEventDetail<any>>;
  customEvent.stopImmediatePropagation();
  if (!customEvent.detail) return;
  const { row } = customEvent.detail;
  row.style.minHeight = "2rem";
  row.style.margin = "0";
};

export const setupBIMTable = (table: BUI.Table<any>) => {
  table.defaultContentTemplate = tableDefaultContentTemplate;
  table.addEventListener("cellcreated", onTableCellCreated);
  table.addEventListener("rowcreated", onTableRowCreated);
};
