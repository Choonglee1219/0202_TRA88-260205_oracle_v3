import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";

export interface CategoricalTreeState {
  components: OBC.Components;
  models: Iterable<FRAGS.FragmentsModel>;
  selectHighlighterName?: string;
}

export type CategoricalTreeData = {
  modelId: string;
  localId?: number;
  Name: string;
  children?: string;
};