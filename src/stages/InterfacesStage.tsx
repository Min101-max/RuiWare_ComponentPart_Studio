import { useState } from "react";
import { CheckCircle2, CircleHelp, Link2 } from "lucide-react";
import type { ComponentMember, ComponentPort, ComponentSlot, InterfaceSelection, PartInterface, ResolvedPartInterface, Mate } from "../domain/component";
import { sameInterfaceSelection, supportsInterfacePreview } from "../domain/interfaceGeometry";

function interfaceSummary(item: PartInterface): string {
  const size = item.interfaceSize;
  const sizeText = size?.diameter ? `Ø${size.diameter} ${size.unit || "mm"}`
    : size && [size.width, size.height, size.depth].some(value => value !== undefined)
      ? `${[size.width, size.height, size.depth].filter(value => value !== undefined).join(" × ")} ${size.unit || "mm"}`
      : undefined;
  const region = item.region?.uSpan !== undefined && item.region.vSpan !== undefined ? `区域 ${item.region.uSpan} × ${item.region.vSpan} mm` : undefined;
  return [item.type, item.interfaceType, item.locatingType, item.connectionMethod, sizeText, region].filter(Boolean).join(" / ") || "未声明类型";
}

export function InterfacesStage({ members, ports, slots, mates, selectedInterface, interfacePreview, onSelectInterface, onConnect, onRemoveConnection }: { members: ComponentMember[]; ports: ComponentPort[]; slots: ComponentSlot[]; mates: Mate[]; selectedInterface: InterfaceSelection | null; interfacePreview?: { selection: InterfaceSelection; status: "loading" | "ready" | "error"; resolvedInterfaces?: ResolvedPartInterface[] }; onSelectInterface: (selection: InterfaceSelection) => void; onConnect: (from: InterfaceSelection, to: InterfaceSelection) => void; onRemoveConnection: (id: string) => void }) {
  const [from, setFrom] = useState<InterfaceSelection | null>(null);
  const [to, setTo] = useState<InterfaceSelection | null>(null);
  const selectionLabel = (selection: InterfaceSelection | null) => {
    if (!selection) return "点击下方接口选择";
    const member = members.find(item => item.id === selection.memberId);
    const item = member?.interfaces.find(interfaceItem => interfaceItem.id === selection.interfaceId);
    return `${member?.role || member?.name || selection.memberId} · ${item?.name || selection.interfaceId}`;
  };
  const chooseConnectionInterface = (selection: InterfaceSelection) => {
    if (!from || (from.memberId === selection.memberId && from.interfaceId === selection.interfaceId)) { setFrom(selection); setTo(null); return; }
    if (!to && from.memberId !== selection.memberId) { setTo(selection); return; }
    setFrom(selection); setTo(null);
  };
  return <>
    <div className="callout">组件接口保留其来源成员和零部件接口引用，发布版本保持固定。</div>
    <h4>对外接口</h4>
    {ports.map(port => <div className="info-row" key={port.id}><CheckCircle2 size={14}/><span>{port.name}<small>来源：{port.source.memberId} / {port.source.interfaceId}</small><small>{port.tags.join(", ")}</small>{port.interface && <small>{[port.interface.interfaceType || port.interface.type, port.interface.locatingType, port.interface.region?.mode, port.interface.region?.uSpan !== undefined && port.interface.region?.vSpan !== undefined ? `${port.interface.region.uSpan} × ${port.interface.region.vSpan} mm` : undefined, port.interface.region?.uSpanExpression || port.interface.region?.vSpanExpression ? `U ${port.interface.region?.uSpanExpression || "?"} × V ${port.interface.region?.vSpanExpression || "?"}` : undefined, port.interface.region?.countExpression ? `数量表达式 ${port.interface.region.countExpression}` : undefined].filter(Boolean).join(" / ")}</small>}</span></div>)}
    {ports.length === 0 && <p className="empty-text">在装配阶段选择成员后点击“继承所选接口”</p>}
    <h4>连接窗口</h4>
    <div className="interface-connection-window">
      <div className="interface-connection-choice"><b>接口 A</b><span>{selectionLabel(from)}</span></div>
      <span className="interface-connection-arrow" aria-hidden="true"><Link2 size={15}/></span>
      <div className="interface-connection-choice"><b>接口 B</b><span>{selectionLabel(to)}</span></div>
      <button type="button" className="primary full" disabled={!from || !to || from.memberId === to.memberId} onClick={() => { if (from && to) { onConnect(from, to); setFrom(null); setTo(null); } }}><Link2 size={15}/>连接接口</button>
    </div>
    <h4>已连接接口</h4>
    <div className="connected-interface-list">
      {mates.length === 0 && <p className="empty-text">暂无连接接口</p>}
      {mates.map(mate => {
        const fromMember = members.find(member => member.id === mate.from.memberId), toMember = members.find(member => member.id === mate.to.memberId);
        const fromInterface = fromMember?.interfaces.find(item => item.id === mate.from.interfaceId), toInterface = toMember?.interfaces.find(item => item.id === mate.to.interfaceId);
        const selected = selectedInterface?.memberId === mate.from.memberId && selectedInterface.interfaceId === mate.from.interfaceId;
        return <div className={`connected-interface-row ${selected ? "selected" : ""}`} key={mate.id}><Link2 size={14}/><button type="button" className="connected-interface-preview" aria-pressed={selected} onClick={() => onSelectInterface(mate.from)}><strong>{fromMember?.role || fromMember?.name || mate.from.memberId} · {fromInterface?.name || mate.from.interfaceId}</strong><b>→</b><strong>{toMember?.role || toMember?.name || mate.to.memberId} · {toInterface?.name || mate.to.interfaceId}</strong><small>{mate.relation} · 偏置 {mate.offset} mm · 已约束移动</small></button><button type="button" className="icon-button" title="删除连接" aria-label="删除连接" onClick={() => onRemoveConnection(mate.id)}>×</button></div>;
      })}
    </div>
    <h4>零部件接口</h4>
    <div className="member-interface-list">
      {members.map(member => <section className="member-interface-group" key={member.id} aria-label={`${member.name}接口`}>
        <div className="member-interface-heading"><b>{member.role || member.name}</b><small>{member.interfaces.length} 个 · {member.code}</small></div>
        {member.interfaces.length === 0 && <p className="empty-text">该零部件未定义接口</p>}
        <div className="member-interface-items">
        {member.interfaces.map(item => {
          const selected = sameInterfaceSelection(selectedInterface, { memberId: member.id, interfaceId: item.id });
          const activePreview = selected && sameInterfaceSelection(interfacePreview?.selection || null, selectedInterface) ? interfacePreview : undefined;
          const resolvedInterfaces = activePreview?.status === "ready" ? activePreview.resolvedInterfaces : member.resolvedInterfaces;
          const previewable = supportsInterfacePreview(item, resolvedInterfaces);
          const occurrence = member.resolvedInterfaces?.find(entry => entry.id === item.id);
          const sourceId = occurrence?.sourceInterfaceId || item.id;
          const sourceFeature = occurrence?.sourceFeatureId || occurrence?.sourceFeatureRuleId;
          return <button type="button" className={`interface-select ${selected ? "selected" : ""}`} aria-pressed={selected} key={`${member.id}:${item.id}`} onClick={() => { const selection = { memberId: member.id, interfaceId: item.id }; onSelectInterface(selection); chooseConnectionInterface(selection); }}>
            <span className="interface-select-name"><b>{item.name}</b><small>ID：{item.id}</small><small>{interfaceSummary(item)}</small><small>来源 ID：{sourceId}{sourceFeature ? ` · 特征：${sourceFeature}` : ""}</small>{item.geometryRefs?.length ? <small>语义面：{item.geometryRefs.join("、")}</small> : null}</span>
            {previewable ? <CheckCircle2 size={14} aria-label="可按语义面预览"/> : <CircleHelp size={14} aria-label="缺少可定位几何数据"/>}
          </button>;
        })}
        </div>
      </section>)}
      {members.length === 0 && <p className="empty-text">添加零部件后可查看已定义接口</p>}
    </div>
    {selectedInterface && (() => {
      const member = members.find(item => item.id === selectedInterface.memberId);
      const item = member?.interfaces.find(interfaceItem => interfaceItem.id === selectedInterface.interfaceId);
      if (!member || !item) return null;
      return <p className="interface-preview-note" role="status">
        {sameInterfaceSelection(interfacePreview?.selection || null, selectedInterface) && interfacePreview?.status === "loading"
          ? "正在按该零部件当前参数解析接口的具体位置…"
          : supportsInterfacePreview(item, interfacePreview?.status === "ready" ? interfacePreview.resolvedInterfaces : member.resolvedInterfaces)
            ? "已定位接口的具体区域，中央三维视图已同步高亮。"
            : "接口已定义，但当前缺少可定位几何数据；中央三维视图仅保留零部件模型。"}
      </p>;
    })()}
    <h4>可替换槽位</h4>
    {slots.map(slot => <div className="info-row" key={slot.id}><span>{slot.name}<small>{slot.required ? "必填" : "可选"} · {slot.memberId || "未放置成员"}</small></span></div>)}
    {slots.length === 0 && <p className="empty-text">暂无槽位，槽位编辑尚未接入</p>}
  </>;
}
