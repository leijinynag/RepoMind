import ThoughtNode from "./ThoughtNode";
import ActionNode from "./ActionNode";
import ObservationNode from "./ObservationNode";
import AnswerNode from "./AnswerNode";
import SkillNode from "./SkillNode";
import PlannerNode from "./PlannerNode";
import SummaryNode from "./SummaryNode";

export const nodeTypes = {
  thought: ThoughtNode,
  action: ActionNode,
  observation: ObservationNode,
  answer: AnswerNode,
  skill: SkillNode,
  planner: PlannerNode,
  summary: SummaryNode,
};

export { SkillNode, PlannerNode, SummaryNode };
export type { SkillNodeData } from './SkillNode';
export type { PlannerNodeData } from './PlannerNode';
export type { SummaryNodeData } from './SummaryNode';