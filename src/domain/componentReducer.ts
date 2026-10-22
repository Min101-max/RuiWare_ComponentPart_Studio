import { createComponentDocument, hasInterface } from "./component.ts";
import type { ComponentDefinition, ComponentDocument, ComponentMember, ComponentPort, Mate } from "./component.ts";

export type ComponentAction =
  | { type: "reset" }
  | { type: "definition.patch"; patch: Partial<ComponentDefinition> }
  | { type: "member.add"; member: ComponentMember }
  | { type: "member.patch"; id: string; patch: Partial<Pick<ComponentMember, "role" | "position" | "rotation" | "parameterValues">> }
  | { type: "member.remove"; id: string }
  | { type: "mate.add"; mate: Mate }
  | { type: "port.add"; port: ComponentPort }
  | { type: "parameter.value"; id: string; value: number | null }
  | { type: "rule.expression"; id: string; expression: string };

export function componentReducer(document: ComponentDocument, action: ComponentAction): ComponentDocument {
  const next = (patch: Partial<ComponentDocument>): ComponentDocument => ({ ...document, ...patch, revision: document.revision + 1 });
  switch (action.type) {
    case "reset": return createComponentDocument();
    case "definition.patch":
      if (Object.entries(action.patch).every(([key, value]) => document.definition[key as keyof ComponentDefinition] === value)) return document;
      return next({ definition: { ...document.definition, ...action.patch } });
    case "member.add":
      if (document.assembly.members.some(member => member.id === action.member.id)) return document;
      return next({ assembly: { ...document.assembly, members: [...document.assembly.members, structuredClone(action.member)] } });
    case "member.patch":
      if (!document.assembly.members.some(member => member.id === action.id)) return document;
      return next({ assembly: { ...document.assembly, members: document.assembly.members.map(member => member.id === action.id ? { ...member, ...structuredClone(action.patch) } : member) } });
    case "member.remove":
      if (!document.assembly.members.some(member => member.id === action.id)) return document;
      return next({
        assembly: {
          members: document.assembly.members.filter(member => member.id !== action.id),
          mates: document.assembly.mates.filter(mate => mate.from.memberId !== action.id && mate.to.memberId !== action.id),
        },
        ports: document.ports.filter(port => port.source.memberId !== action.id),
        bindings: document.bindings.filter(binding => binding.memberId !== action.id),
        slots: document.slots.map(slot => slot.memberId === action.id ? { ...slot, memberId: null } : slot),
      });
    case "mate.add": {
      const mate = action.mate;
      if (!hasInterface(document, mate.from) || !hasInterface(document, mate.to) || mate.from.memberId === mate.to.memberId ||
        document.assembly.mates.some(item => item.id === mate.id || (
          item.from.memberId === mate.from.memberId && item.from.interfaceId === mate.from.interfaceId &&
          item.to.memberId === mate.to.memberId && item.to.interfaceId === mate.to.interfaceId
        ))) return document;
      return next({ assembly: { ...document.assembly, mates: [...document.assembly.mates, structuredClone(mate)] } });
    }
    case "port.add":
      if (!hasInterface(document, action.port.source) || document.ports.some(port => port.id === action.port.id ||
        (port.source.memberId === action.port.source.memberId && port.source.interfaceId === action.port.source.interfaceId))) return document;
      return next({ ports: [...document.ports, structuredClone(action.port)] });
    case "parameter.value":
      if (!document.parameters.some(parameter => parameter.id === action.id && parameter.value !== action.value)) return document;
      return next({ parameters: document.parameters.map(parameter => parameter.id === action.id ? { ...parameter, value: action.value } : parameter) });
    case "rule.expression":
      if (!document.rules.some(rule => rule.id === action.id && rule.expression !== action.expression)) return document;
      return next({ rules: document.rules.map(rule => rule.id === action.id ? { ...rule, expression: action.expression } : rule) });
  }
}
