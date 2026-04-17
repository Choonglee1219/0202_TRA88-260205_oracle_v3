import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { FragmentsModel } from "@thatopen/fragments";
import { appIcons } from "../../globals";
import { spatialTree } from "../../ui-components/SpatialTree";
import { Highlighter } from "../../bim-components/Highlighter";

export interface SpatialTreePanelState {
  components: OBC.Components;
  models?: Map<string, FragmentsModel>;
}

export const spatialTreePanelTemplate: BUI.StatefullComponent<
  SpatialTreePanelState
> = (state) => {
  const { components, models } = state;
  
  const [spatialTreeTable] = spatialTree({ components, models: models ? [...models.values()] : [] });
  
  spatialTreeTable.preserveStructureOnFilter = true;

  let searchInput: BUI.TextInput | undefined;

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    spatialTreeTable.queryString = input.value;
  };

  const onClearSearch = () => {
    if (!searchInput) return;
    searchInput.value = "";
    spatialTreeTable.queryString = null;
  };

  const toggleExpanded = async (e: Event) => {
    const btn = e.currentTarget as BUI.Button;
    btn.loading = true;
    
    await new Promise((resolve) => setTimeout(resolve, 50));
    spatialTreeTable.expanded = !spatialTreeTable.expanded;
    btn.loading = false;
  };

  const onSearchSelection = async (e: Event) => {
    const btn = e.target as BUI.Button;
    const highlighter = components.get(Highlighter);
    const selection = highlighter.selection.select;
    const modelIds = Object.keys(selection);
    
    if (modelIds.length === 0 || selection[modelIds[0]].size === 0) {
      alert("먼저 Viewport에서 객체를 선택해주세요.");
      return;
    }

    btn.loading = true;
    try {
      const modelId = modelIds[0];
      const localId = Array.from(selection[modelId])[0]; // 첫 번째 선택된 객체의 ID
      
      const fragments = components.get(OBC.FragmentsManager);
      const model = fragments.list.get(modelId);
      
      if (model) {
        const [itemData] = await model.getItemsData([localId], { 
          attributesDefault: true, 
          relationsDefault: { attributes: false, relations: false } 
        });

        if (itemData && itemData.Name) {
          const nameVal = typeof itemData.Name === "object" && "value" in itemData.Name ? itemData.Name.value : itemData.Name;
          const nameStr = String(nameVal);
          if (searchInput) searchInput.value = nameStr; // 입력창에도 검색어 반영
          spatialTreeTable.queryString = nameStr; // 테이블 필터링 적용
          spatialTreeTable.expanded = true; // 트리를 확장해서 결과를 보여줌
        } else {
          alert("선택된 객체에서 이름(Name) 속성을 찾을 수 없습니다.");
        }
      }
    } finally {
      btn.loading = false;
    }
  };

  return BUI.html`
    <bim-panel-section fixed icon=${appIcons.TREE} label="Spatial Tree">
      <div style="display: flex; gap: 0.375rem; flex: 0;">
        <bim-text-input ${BUI.ref((e) => { searchInput = e as BUI.TextInput; })} @input=${onSearch} vertical placeholder="Search..." debounce="200"></bim-text-input>
        <bim-button style="flex: 0;" @click=${onClearSearch} icon=${appIcons.CLEAR} tooltip-title="Clear Search"></bim-button>
        <bim-button style="flex: 0;" @click=${toggleExpanded} icon=${appIcons.EXPAND} tooltip-title="Toggle Expanded"></bim-button>
        <bim-button style="flex: 0;" @click=${onSearchSelection} icon=${appIcons.SEARCH} tooltip-title="Search Selection"></bim-button>
      </div>
      ${spatialTreeTable}
    </bim-panel-section> 
  `;
};
