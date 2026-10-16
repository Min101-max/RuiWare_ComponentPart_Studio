import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Html } from "@react-three/drei";
import { Download, Eye, Link2, Plus, CheckCircle2, AlertTriangle, Boxes, Settings2, Trash2 } from "lucide-react";
import "./styles.css";

type Stage = "定义" | "装配" | "接口与槽位" | "参数" | "规则" | "验证" | "发布";
type Interface = { id: string; name: string; type: "plane" | "axis" | "point"; tags: string[]; used?: boolean };
type Part = { id: string; code: string; name: string; color: string; size: [number, number, number]; interfaces: Interface[]; defaults: Record<string, number> };
type Member = Part & { memberId: string; role: string; position: [number, number, number]; rotation: [number, number, number]; bindings: Record<string, string | number> };
type Mate = { id: string; from: string; to: string; relation: "贴合" | "同轴" | "重合"; offset: number };
type Port = { id: string; name: string; sourceMemberId: string; sourceInterfaceId: string; tags: string[] };

const parts: Part[] = [
  { id: "RW-TPL-BEAM-001", code: "BEAM-2400", name: "横梁", color: "#4f83cc", size: [4.8, .45, .45], interfaces: [{ id: "end-left", name: "左端面", type: "plane", tags: ["end-face", "beam"] }, { id: "end-right", name: "右端面", type: "plane", tags: ["end-face", "beam"] }, { id: "mount-axis", name: "安装轴", type: "axis", tags: ["axis"] }], defaults: { length: 2400, sectionHeight: 45 } },
  { id: "RW-TPL-HOOK-001", code: "HOOK-100", name: "柱抓", color: "#d48650", size: [.38, .75, .28], interfaces: [{ id: "beam-face", name: "横梁连接面", type: "plane", tags: ["mounting-face", "beam"] }, { id: "column-face", name: "立柱连接面", type: "plane", tags: ["mounting-face", "column"] }], defaults: { length: 100, thickness: 3 } },
  { id: "RW-TPL-COLUMN-001", code: "COLUMN-3000", name: "立柱", color: "#6d9b70", size: [.35, .35, 6], interfaces: [{ id: "hook-face", name: "柱抓连接面", type: "plane", tags: ["mounting-face", "column"] }, { id: "base-point", name: "底部基准点", type: "point", tags: ["datum"] }], defaults: { length: 3000, sectionWidth: 70 } },
  { id: "RW-TPL-BRACE-001", code: "BRACE-1800", name: "斜撑", color: "#9270ae", size: [3.2, .18, .18], interfaces: [{ id: "brace-start", name: "起点接口", type: "plane", tags: ["brace"] }, { id: "brace-end", name: "终点接口", type: "plane", tags: ["brace"] }], defaults: { length: 1800, thickness: 2 } },
];

function App() {
  const [stage, setStage] = useState<Stage>("定义");
  const [templateName, setTemplateName] = useState("横梁组件");
  const [members, setMembers] = useState<Member[]>([]);
  const [mates, setMates] = useState<Mate[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [parameter, setParameter] = useState("2400");
  const [rule, setRule] = useState("组件总长必须在 1000~6000 mm 范围内");
  const [message, setMessage] = useState("先定义组件，再从左侧发布库加入零部件");
  const selectedMember = members.find((m) => m.memberId === selected);
  const stageIndex = ["定义", "装配", "接口与槽位", "参数", "规则", "验证", "发布"].indexOf(stage);
  const validation = useMemo(() => {
    const checks: Array<[string, boolean]> = [
      ["组件名称", templateName.trim().length > 0],
      ["装配成员", members.length > 0],
      ["接口连接", mates.length > 0],
      ["外部接口", ports.length > 0],
      ["参数范围", Number(parameter) >= 1000 && Number(parameter) <= 6000],
      ["引用版本", members.every((m) => m.id.startsWith("RW-TPL-"))],
    ];
    return checks;
  }, [templateName, members, mates, ports, parameter]);

  function addPart(part: Part) {
    const count = members.filter((m) => m.id === part.id).length + 1;
    const member: Member = { ...structuredClone(part), memberId: `${part.id}-${count}`, role: members.length === 0 ? "基准成员" : `${part.name}${count}`, position: [members.length * 1.2 - 1.2, 0, 0], rotation: [0, 0, 0], bindings: { ...part.defaults } };
    setMembers((current) => [...current, member]); setSelected(member.memberId); setStage("装配"); setMessage(`已加入 ${member.name}，请建立接口连接或调整成员位置`);
  }
  function connect() {
    if (members.length < 2) return setMessage("至少加入两个零部件后才能建立接口连接");
    const a = members[0], b = members[1]; const from = `${a.memberId}.${a.interfaces[0].id}`, to = `${b.memberId}.${b.interfaces[0].id}`;
    if (mates.some((m) => m.from === from && m.to === to)) return setMessage("这两个接口已经连接");
    setMates((x) => [...x, { id: `mate-${x.length + 1}`, from, to, relation: "贴合", offset: 0 }]); setMessage("已建立接口贴合关系，成员位置由该关系驱动");
  }
  function inherit() {
    if (!selectedMember) return setMessage("请先在三维视图或成员列表中选择一个零部件");
    const iface = selectedMember.interfaces.find((x) => !x.used) || selectedMember.interfaces[0]; const id = `${selectedMember.memberId}.${iface.id}`;
    if (ports.some((p) => p.sourceMemberId === selectedMember.memberId && p.sourceInterfaceId === iface.id)) return setMessage("该接口已经继承到组件");
    setPorts((x) => [...x, { id: `port-${x.length + 1}`, name: `${selectedMember.name}-${iface.name}`, sourceMemberId: selectedMember.memberId, sourceInterfaceId: iface.id, tags: iface.tags }]); setStage("接口与槽位"); setMessage(`已将 ${iface.name} 继承为组件对外接口`);
  }
  function exportTemplate() {
    const data = { schemaVersion: "component-1.0", templateKind: "component", name: templateName, stages: { definition: { name: templateName }, assembly: { members: members.map(({ memberId, id, role, position, rotation, bindings }) => ({ memberId, partTemplateVersion: id, role, position, rotation, bindings })), mates }, ports, parameters: { componentLength: Number(parameter) }, rules: [{ id: "rule-1", expression: rule }], validation: validation.map(([name, passed]) => ({ name, passed })) } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${templateName}.component.json`; a.click(); URL.revokeObjectURL(url); setMessage("组件模板 JSON 已导出");
  }
  return <div className="app">
    <header className="topbar"><div className="brand"><div className="brand-mark">R</div><div><b>组件模板生成器</b><span>Component Template Studio · 第一版</span></div></div><div className="top-actions"><button className="ghost" onClick={() => { setMembers([]); setMates([]); setPorts([]); setStage("定义"); }}>新建</button><button className="primary" onClick={exportTemplate}><Download size={16}/>导出模板</button></div></header>
    <nav className="stagebar">{(["定义", "装配", "接口与槽位", "参数", "规则", "验证", "发布"] as Stage[]).map((item, i) => <button key={item} className={`${item === stage ? "active" : ""} ${i <= stageIndex ? "visited" : ""}`} onClick={() => setStage(item)}><span>{i + 1}</span>{item}</button>)}</nav>
    <main className="layout">
      <aside className="sidebar library"><div className="panel-title"><span><Boxes size={16}/>已发布零部件</span><small>{parts.length}</small></div><p className="hint">只显示可被组件模板引用的发布版本</p>{parts.map((part) => <button className="part-card" key={part.id} onClick={() => addPart(part)}><i style={{ background: part.color }}/><span><b>{part.name}</b><small>{part.code} · {part.id}</small></span><Plus size={16}/></button>)}<div className="panel-title member-title"><span>组件成员</span><small>{members.length}</small></div>{members.map((m) => <button className={`member-row ${selected === m.memberId ? "selected" : ""}`} key={m.memberId} onClick={() => setSelected(m.memberId)}><i style={{ background: m.color }}/><span>{m.role}<small>{m.code}</small></span><Trash2 size={14} onClick={(e) => { e.stopPropagation(); setMembers((x) => x.filter((v) => v.memberId !== m.memberId)); }}/></button>)}</aside>
      <section className="viewport"><div className="viewport-toolbar"><button className="tool active"><Eye size={15}/>预览</button><span>拖拽视图旋转 · 滚轮缩放</span><span className="view-status">{members.length} 个成员 · {mates.length} 个连接</span></div><Canvas camera={{ position: [7, 5, 7], fov: 42 }}><color attach="background" args={["#f5f7f9"]}/><ambientLight intensity={1.8}/><directionalLight position={[4, 6, 5]} intensity={2}/><Grid args={[20, 20]} cellSize={.5} cellThickness={.5} sectionSize={2.5} sectionThickness={1}/><OrbitControls makeDefault/>{members.map((m) => <mesh key={m.memberId} position={m.position} rotation={m.rotation} onClick={(e) => { e.stopPropagation(); setSelected(m.memberId); }}><boxGeometry args={m.size}/><meshStandardMaterial color={selected === m.memberId ? "#f0b429" : m.color} roughness={.7}/><Html distanceFactor={10} position={[0, m.size[1] / 2 + .15, 0]}><span className="model-label">{m.role}</span></Html></mesh>)}</Canvas>{members.length === 0 && <div className="empty-overlay"><Boxes size={30}/><b>从左侧添加零部件</b><span>组件由已发布的零部件模板组成</span></div>}</section>
      <aside className="sidebar inspector"><section className="inspector-section"><h3>当前阶段 · {stage}</h3>{stage === "定义" && <><label>组件名称<input value={templateName} onChange={(e) => setTemplateName(e.target.value)}/></label><label>组件类型<select><option>货架组件</option><option>连接组件</option><option>支撑组件</option></select></label><label>设计说明<textarea defaultValue="由多个已发布零部件组成的可复用组件模板"/></label></>}{stage === "装配" && <><div className="action-row"><button className="primary" onClick={connect}><Link2 size={15}/>连接前两个接口</button><button className="ghost" onClick={inherit}>继承所选接口</button></div><h4>接口连接</h4>{mates.length === 0 ? <p className="empty-text">尚未建立内部连接</p> : mates.map((m) => <div className="info-row" key={m.id}><Link2 size={14}/><span>{m.from.split(".")[1]} <b>→</b> {m.to.split(".")[1]}<small>{m.relation} · 偏置 {m.offset} mm</small></span></div>)}</>}{stage === "接口与槽位" && <><div className="callout">组件接口来源于装配阶段显式继承的零部件接口，源接口变化时自动更新。</div>{ports.map((p) => <div className="info-row" key={p.id}><CheckCircle2 size={14}/><span>{p.name}<small>来源：{p.sourceMemberId} · {p.tags.join(", ")}</small></span></div>)}{ports.length === 0 && <p className="empty-text">在装配阶段选择成员后点击“继承所选接口”</p>}</>}{stage === "参数" && <><label>组件总长 (mm)<input type="number" value={parameter} onChange={(e) => setParameter(e.target.value)}/></label><div className="callout">参数将传递给绑定了 length 的组件成员，并在验证阶段检查范围。</div></>}{stage === "规则" && <><label>工程限制<textarea value={rule} onChange={(e) => setRule(e.target.value)}/></label><div className="rule-line"><Settings2 size={14}/>规则将在组件验证时执行</div></>}{stage === "验证" && <><div className="validation-list">{validation.map(([name, passed]) => <div key={name} className={passed ? "pass" : "fail"}>{passed ? <CheckCircle2 size={15}/> : <AlertTriangle size={15}/>}<span>{name}<small>{passed ? "通过" : "需要处理"}</small></span></div>)}</div><button className="primary full" onClick={() => setMessage(validation.every(([, ok]) => ok) ? "验证通过，可以进入发布" : "验证未通过，请处理失败项")}>重新验证</button></>}{stage === "发布" && <><div className="publish-box"><CheckCircle2 size={24}/><b>组件模板准备发布</b><span>发布后将冻结零部件模板版本和装配关系</span></div><button className="primary full" onClick={exportTemplate}><Download size={15}/>导出发布包</button></>}{stage !== "验证" && stage !== "发布" && <div className="next-hint">{message}</div>}</section><section className="inspector-section"><h3>数据摘要</h3><div className="stats"><div><b>{members.length}</b><span>成员</span></div><div><b>{mates.length}</b><span>内部连接</span></div><div><b>{ports.length}</b><span>组件接口</span></div></div></section></aside>
    </main><footer className="statusbar"><span><i className="status-dot"/>{message}</span><span>组件模板草案 · 未发布</span></footer>
  </div>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
