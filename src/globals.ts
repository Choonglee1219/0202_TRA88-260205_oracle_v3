import * as CUI from "@thatopen/ui-obc";

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
  FULLSCREEN: "/icons/mdi--fit-to-screen.svg",
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
};

export const tooltips = {
  FOCUS: {
    TITLE: "Items Focusing",
    TEXT: "Move the camera to focus the selected items. If no items are selected, all models will be focused.",
  },
  HIDE: {
    TITLE: "Hide Selection",
    TEXT: "Hide the currently selected items.",
  },
  ISOLATE: {
    TITLE: "Isolate Selection",
    TEXT: "Hide everything expect the currently selected items.",
  },
  GHOST: {
    TITLE: "Ghost Mode",
    TEXT: "Set all models transparent, so selections and colors can be seen better.",
  },
  SHOW_ALL: {
    TITLE: "Show All Items",
    TEXT: "Reset the visibility of all hidden items, so they become visible again.",
  },
};

export const users: CUI.TopicUserStyles = {
  "jhon.doe@example.com": {
    name: "Jhon Doe",
    picture:
      "https://www.profilebakery.com/wp-content/uploads/2023/04/Profile-Image-AI.jpg",
  },
  "user_a@something.com": {
    name: "User A",
    picture:
      "https://www.profilebakery.com/wp-content/uploads/2023/04/Portrait-Photography.jpg",
  },
  "user_b@something.com": {
    name: "User B",
    picture:
      "https://www.profilebakery.com/wp-content/uploads/2023/04/AI-Portrait.jpg",
  },
};
