import { Trash2 } from "lucide-react";
import { PublishedTemplateLibrary } from "../library/PublishedTemplateLibrary";
import { ComponentViewport } from "../viewport/ComponentViewport";
import { DefinitionStage } from "../stages/DefinitionStage";
import { AssemblyStage } from "../stages/AssemblyStage";
import { InterfacesStage } from "../stages/InterfacesStage";
import { ParametersStage } from "../stages/ParametersStage";
import { RulesStage } from "../stages/RulesStage";
import { ValidationStage } from "../stages/ValidationStage";
import { PublishStage } from "../stages/PublishStage";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { useComponentWorkspace } from "./useComponentWorkspace";
import { STAGES } from "./stages";
import "../styles/workspace.css";

export function App() {
  const workspace = useComponentWorkspace();
  const { document, dispatch, stage, checks } = workspace;
  const { members, mates } = document.assembly;

  function renderStage() {
    switch (stage) {
      case "definition": return <DefinitionStage definition={document.definition} onChange={patch => dispatch({ type: "definition.patch", patch })}/>;
      case "assembly": return <AssemblyStage mates={mates} onConnect={workspace.connectFirstInterfaces} onInherit={workspace.inheritInterface}/>;
      case "interfaces": return <InterfacesStage ports={document.ports} slots={document.slots}/>;
      case "parameters": return <ParametersStage parameters={document.parameters} bindings={document.bindings} onChange={(id, value) => dispatch({ type: "parameter.value", id, value })}/>;
      case "rules": return <RulesStage rules={document.rules} onChange={(id, expression) => dispatch({ type: "rule.expression", id, expression })}/>;
      case "validation": return <ValidationStage checks={checks} revision={document.revision} onValidate={() => workspace.setMessage(checks.some(check => check.status === "fail") ? "基础数据检查未通过，请处理失败项" : "基础数据检查通过；装配求解和工程规则执行仍待接入")}/>;
      case "publish": return <PublishStage checks={checks} revision={document.revision} onExport={workspace.exportDraft}/>;
    }
  }

  return <WorkspaceLayout stage={stage} onStageChange={workspace.setStage} onNew={workspace.newDraft} onExport={workspace.exportDraft} message={workspace.message} revision={document.revision}
    library={<>
      <PublishedTemplateLibrary onPreview={workspace.setPreviewTemplate} selectionResetToken={workspace.selectionResetToken}/>
      <div className="panel-title member-title"><span>组件成员</span><small>{members.length}</small></div>
      {members.length === 0 && <p className="hint">暂无成员，模板包解析接入后可加入装配</p>}
      {members.map(member => <div className={`member-row ${workspace.selectedMemberId === member.id ? "selected" : ""}`} key={member.id}>
        <button className="member-select" onClick={() => workspace.setSelectedMemberId(member.id)}><span>{member.role}<small>{member.code} · V{member.template.version}</small></span></button>
        <button className="member-remove" onClick={() => workspace.removeMember(member.id)} aria-label={`删除成员 ${member.role}`}><Trash2 size={14}/></button>
      </div>)}
    </>}
    viewport={<ComponentViewport members={members} mateCount={mates.length} previewTemplate={workspace.previewTemplate}/>}
    inspector={<>
      <section className="inspector-section" aria-label="当前阶段面板"><h3>当前阶段 · {STAGES.find(item => item.id === stage)?.label}</h3>{renderStage()}{stage !== "validation" && stage !== "publish" && <div className="next-hint" role="status">{workspace.message}</div>}</section>
      <section className="inspector-section"><h3>数据摘要</h3><div className="stats"><div><b>{members.length}</b><span>成员</span></div><div><b>{mates.length}</b><span>内部连接</span></div><div><b>{document.ports.length}</b><span>组件接口</span></div></div></section>
    </>}
  />;
}
