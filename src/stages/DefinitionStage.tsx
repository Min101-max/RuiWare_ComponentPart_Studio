import type { ComponentDefinition } from "../domain/component";

type Props = { definition: ComponentDefinition; onChange: (patch: Partial<ComponentDefinition>) => void };

export function DefinitionStage({ definition, onChange }: Props) {
  return <>
    <label>组件名称<input value={definition.name} onChange={event => onChange({ name: event.target.value })}/></label>
    <label>组件编码<input value={definition.code} onChange={event => onChange({ code: event.target.value })}/></label>
    <label>组件类型<select value={definition.category} onChange={event => onChange({ category: event.target.value })}><option>货架组件</option><option>连接组件</option><option>支撑组件</option></select></label>
    <label>设计说明<textarea value={definition.description} onChange={event => onChange({ description: event.target.value })}/></label>
  </>;
}
