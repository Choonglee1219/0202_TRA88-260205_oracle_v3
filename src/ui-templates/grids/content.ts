import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import * as TEMPLATES from "..";
import {
  CONTENT_GRID_GAP,
  CONTENT_GRID_ID,
  SMALL_COLUMN_WIDTH,
} from "../../globals";

type Viewer = "viewer";

type Models = {
  name: "models";
  state: TEMPLATES.ModelsPanelState;
};

type ElementData = {
  name: "elementData";
  state: TEMPLATES.ElementsDataPanelState;
};

type Queries = {
  name: "queries";
  state: TEMPLATES.QueriesPanelState;
};

type Viewpoints = {
  name: "viewpoints";
  state: TEMPLATES.ViewpointsPanelState;
};

type ViewTemplater = {
  name: "viewTemplater";
  state: TEMPLATES.ViewTemplatesPanelState;
};

type SpatialTree = {
  name: "spatialTree";
  state: TEMPLATES.SpatialTreePanelState;
};

type PropsManager = {
  name: "propsManager";
  state: TEMPLATES.GlobalPropsSectionState;
};

type BCFManager = {
  name: "bcfManager";
  state: TEMPLATES.BCFManagerState;
};

export type ContentGridElements = [
  Viewer,
  Models,
  ElementData,
  Viewpoints,
  Queries,
  SpatialTree,
  ViewTemplater,
  PropsManager,
  BCFManager,
];

export type ContentGridLayouts = ["Viewer", "BCFManager", "Queries", "Properties", "FullScreen"];

export interface ContentGridState {
  components: OBC.Components;
  id: string;
  viewportTemplate: BUI.StatelessComponent;
}

export const contentGridTemplate: BUI.StatefullComponent<ContentGridState> = (
  state,
) => {
  const { components } = state;
  const fragments = components.get(OBC.FragmentsManager);

  const onCreated = (e?: Element) => {
    if (!e) return;
    const grid = e as BUI.Grid<ContentGridLayouts, ContentGridElements>;

    grid.elements = {
      spatialTree: {
        template: TEMPLATES.spatialTreePanelTemplate,
        initialState: { components, models: fragments.list },
      },
      queries: {
        template: TEMPLATES.queriesPanelTemplate,
        initialState: { components, isAdmin: true },
      },
      models: {
        template: TEMPLATES.modelsPanelTemplate,
        initialState: { components },
      },
      elementData: {
        template: TEMPLATES.elementsDataPanelTemplate,
        initialState: { components },
      },
      viewTemplater: {
        template: TEMPLATES.viewTemplatesPanelTemplate,
        initialState: { components },
      },
      viewpoints: {
        template: TEMPLATES.viewpointsPanelTemplate,
        initialState: { components },
      },
      propsManager: {
        template: TEMPLATES.globalPropsPanelTemplate,
        initialState: { components },
      },
      bcfManager: {
        template: TEMPLATES.bcfManagerTemplate,
        initialState: { components },
      },
      viewer: state.viewportTemplate,
    };

    grid.layouts = {
      Viewer: {
        template: `
          "models viewer elementData" auto
          "spatialTree viewer elementData" 1fr
          "spatialTree viewer viewTemplater" auto
          / ${SMALL_COLUMN_WIDTH} 1fr ${SMALL_COLUMN_WIDTH}
        `,
      },
      BCFManager: {
        template: `
          "models viewer" 1fr
          "bcfManager bcfManager" 1fr
          / ${SMALL_COLUMN_WIDTH} 1fr
        `,
      },
      Queries: {
        template: `
          "queries viewer" 1fr
          "elementData viewer" 1fr
          / 1fr 1fr
        `,
      },
      Properties: {
        template: `
          "propsManager viewer" auto
          "elementData viewer" 1fr
          / 1fr 1fr
        `,
      },
      FullScreen: {
        template: `
          "viewer" 1fr
          / 1fr
        `,
      },
    };
  };

  return BUI.html`
    <bim-grid id=${state.id} style="padding: ${CONTENT_GRID_GAP}; gap: ${CONTENT_GRID_GAP}" ${BUI.ref(onCreated)}></bim-grid>
  `;
};

export const getContentGrid = () => {
  const contentGrid = document.getElementById(CONTENT_GRID_ID) as BUI.Grid<
    ContentGridLayouts,
    ContentGridElements
  > | null;

  return contentGrid;
};
