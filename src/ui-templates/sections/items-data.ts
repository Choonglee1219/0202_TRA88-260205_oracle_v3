import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { appIcons } from "../../globals";
import { itemsData } from "../../ui-components/ItemsData";
import { Highlighter } from "../../bim-components/Highlighter";

export interface ItemsDataPanelState {
  components: OBC.Components;
}

export const itemsDataPanelTemplate: BUI.StatefullComponent<
  ItemsDataPanelState
> = (state) => {
  const { components } = state;

  const highlighter = components.get(Highlighter);

  const [propsTable, updatePropsTable] = itemsData({
    components,
    modelIdMap: {},
  });

  propsTable.preserveStructureOnFilter = true;

  let section: BUI.PanelSection | undefined;

  // --- Pagination State ---
  let currentPage = 0;
  const pageSize = 30;
  let totalItems = 0;
  let totalPages = 0;
  let allItemsCache: { modelId: string; expressId: number }[] = [];

  // --- Pagination UI Refs ---
  let paginationContainer: HTMLDivElement;
  let pageInfoLabel: BUI.Label;
  let prevButton: BUI.Button;
  let nextButton: BUI.Button;

  const getSlicedMap = (page: number) => {
    const start = page * pageSize;
    const end = start + pageSize;
    const pageItems = allItemsCache.slice(start, end);

    const pageModelIdMap: OBC.ModelIdMap = {};
    for (const item of pageItems) {
      if (!pageModelIdMap[item.modelId]) {
        pageModelIdMap[item.modelId] = new Set();
      }
      pageModelIdMap[item.modelId].add(item.expressId);
    }
    return pageModelIdMap;
  };

  const updatePage = () => {
    const slicedMap = getSlicedMap(currentPage);
    updatePropsTable({ modelIdMap: slicedMap });

    if (section) {
      section.label = `Selection Data (${totalItems})`;
    }
    if (paginationContainer) {
      paginationContainer.style.display = totalPages > 1 ? "flex" : "none";
    }
    if (pageInfoLabel) {
      pageInfoLabel.textContent = `Page ${currentPage + 1} / ${totalPages}`;
    }
    if (prevButton) {
      prevButton.disabled = currentPage === 0;
    }
    if (nextButton) {
      nextButton.disabled = currentPage >= totalPages - 1;
    }
  };

  const onPrevPage = () => {
    if (currentPage > 0) {
      currentPage--;
      updatePage();
    }
  };

  const onNextPage = () => {
    if (currentPage < totalPages - 1) {
      currentPage++;
      updatePage();
    }
  };

  const processSelection = (modelIdMap: OBC.ModelIdMap) => {
    totalItems = 0;
    allItemsCache = [];
    for (const modelId in modelIdMap) {
      const ids = modelIdMap[modelId];
      totalItems += ids.size;
      for (const expressId of ids) {
        allItemsCache.push({ modelId, expressId });
      }
    }

    totalPages = Math.ceil(totalItems / pageSize);
    currentPage = 0;
    updatePage();
  };

  if (highlighter.events.select) {
    highlighter.events.select.onHighlight.add((modelIdMap) => {
      processSelection(modelIdMap);
    });

    highlighter.events.select.onClear.add(() => {
      allItemsCache = [];
      totalItems = 0;
      totalPages = 0;
      currentPage = 0;
      updatePropsTable({ modelIdMap: {} });
      if (section) section.label = "Selection Data (0)";
      if (paginationContainer) paginationContainer.style.display = "none";
    });
  }

  let searchInput: BUI.TextInput | undefined;

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    propsTable.queryString = input.value;
  };

  const onClearSearch = () => {
    if (!searchInput) return;
    searchInput.value = "";
    propsTable.queryString = null;
  };

  const toggleExpanded = () => {
    propsTable.expanded = !propsTable.expanded;
  };

  const sectionId = BUI.Manager.newRandomId();

  return BUI.html`
    <bim-panel-section ${BUI.ref((e) => {
      section = e as BUI.PanelSection;
      const selection = highlighter.selection.select;
      if (Object.keys(selection).length > 0) {
        processSelection(selection);
      }
    })} fixed id=${sectionId} icon=${appIcons.TASK} label="Selection Data (0)">
      <div style="display: flex; gap: 0.375rem; align-items: center;">
        <bim-text-input ${BUI.ref((e) => { searchInput = e as BUI.TextInput; })} @input=${onSearch} vertical placeholder="Search..." debounce="200" style="flex: 1;"></bim-text-input>
        <div ${BUI.ref(e => paginationContainer = e as HTMLDivElement)} style="display: none; gap: 0.25rem; align-items: center; justify-content: center; background: var(--bim-ui_bg-contrast-10); border-radius: 4px; padding: 0.125rem 0.25rem; flex-shrink: 0;">
          <bim-button ${BUI.ref(e => prevButton = e as BUI.Button)} @click=${onPrevPage} icon="eva:arrow-ios-back-outline" tooltip-title="Previous Page" style="flex: 0; margin: 0;"></bim-button>
          <bim-label ${BUI.ref(e => pageInfoLabel = e as BUI.Label)} style="font-weight: bold; white-space: nowrap; margin: 0 0.25rem; font-size: 0.875rem;"></bim-label>
          <bim-button ${BUI.ref(e => nextButton = e as BUI.Button)} @click=${onNextPage} icon="eva:arrow-ios-forward-outline" tooltip-title="Next Page" style="flex: 0; margin: 0;"></bim-button>
        </div>
        <bim-button style="flex: 0;" @click=${onClearSearch} icon=${appIcons.CLEAR} tooltip-title="Clear Search"></bim-button>
        <bim-button style="flex: 0;" @click=${toggleExpanded} icon=${appIcons.EXPAND} tooltip-title="Toggle Expanded"></bim-button>
        <bim-button style="flex: 0;" @click=${() => propsTable.downloadData("ElementData", "json")} icon=${appIcons.EXPORT} tooltip-title="Export Data" tooltip-text="Export the shown properties."></bim-button>
      </div>
      ${propsTable}
    </bim-panel-section> 
  `;
};
