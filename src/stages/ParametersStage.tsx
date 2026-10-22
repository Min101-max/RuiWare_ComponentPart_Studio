import type { ComponentParameter, ParameterBinding } from "../domain/component";

type Props = { parameters: ComponentParameter[]; bindings: ParameterBinding[]; onChange: (id: string, value: number | null) => void };

export function ParametersStage({ parameters, bindings, onChange }: Props) {
  return <>
    {parameters.map(parameter => <label key={parameter.id}>{parameter.label} ({parameter.unit})<input type="number" value={parameter.value ?? ""} min={parameter.min} max={parameter.max} onChange={event => onChange(parameter.id, event.target.value === "" ? null : event.target.valueAsNumber)}/><small>范围：{parameter.min}～{parameter.max} {parameter.unit}</small></label>)}
    <h4>成员参数绑定</h4>
    {bindings.map(binding => <div className="info-row" key={binding.id}><span>{binding.parameterId}<small>→ {binding.memberId} / {binding.memberParameterId}</small></span></div>)}
    <div className="callout">当前保存参数值并检查范围。成员参数绑定编辑和几何重建尚未接入。</div>
  </>;
}
