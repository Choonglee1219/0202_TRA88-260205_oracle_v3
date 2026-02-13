import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import * as TEMPLATES from "..";
import {
  CONTENT_GRID_GAP,
  CONTENT_GRID_ID,
  MEDIUM_COLUMN_WIDTH,
} from "../../globals";

type Viewer = "viewer";

type IFCList = {
  name: "ifcList";
  state: TEMPLATES.IFCListPanelState;
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

type TopicList = {
  name: "topicList";
  state: TEMPLATES.TopicListState;
};

type BCFList = {
  name: "bcfList";
  state: TEMPLATES.BCFListPanelState;
};

export type ContentGridElements = [
  Viewer,
  IFCList,
  ElementData,
  Viewpoints,
  Queries,
  SpatialTree,
  ViewTemplater,
  PropsManager,
  TopicList,
  BCFList,
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
      ifcList: {
        template: TEMPLATES.ifcListPanelTemplate,
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
      topicList: {
        template: TEMPLATES.topicListTemplate,
        initialState: { components },
      },
      bcfList: {
        template: TEMPLATES.bcfListPanelTemplate,
        initialState: { components },
      },
      viewer: state.viewportTemplate,
    };

    grid.layouts = {
      Viewer: {
        template: `
          "ifcList viewer elementData" auto
          "spatialTree viewer elementData" 1fr
          "spatialTree viewer viewTemplater" auto
          / ${MEDIUM_COLUMN_WIDTH} 1fr ${MEDIUM_COLUMN_WIDTH}
        `,
      },
      BCFManager: {
        template: `
          "ifcList viewer bcfList" 1fr
          "topicList topicList topicList" 1fr
          / ${MEDIUM_COLUMN_WIDTH} 1fr ${MEDIUM_COLUMN_WIDTH}
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
