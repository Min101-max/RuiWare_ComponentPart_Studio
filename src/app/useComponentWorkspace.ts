import { useMemo, useReducer, useState } from "react";
import { createComponentDocument } from "../domain/component";
import { componentReducer } from "../domain/componentReducer";
import { serializeComponent } from "../domain/serialization";
import { validateComponent } from "../domain/validation";
import type { PublishedTemplate } from "../library/publishedLibrary";
import type { StageId } from "./stages";

const initialMessage = "左侧可浏览已发布零部件，点击模板预览模型和版本信息";

export function useComponentWorkspace() {
  const [document, dispatch] = useReducer(componentReducer, undefined, createComponentDocument);
  const [stage, setStage] = useState<StageId>("definition");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<PublishedTemplate | null>(null);
  const [selectionResetToken, setSelectionResetToken] = useState(0);
  const [message, setMessage] = useState(initialMessage);
  const checks = useMemo(() => validateComponent(document), [document]);
  const selectedMember = document.assembly.members.find(member => member.id === selectedMemberId);

  function newDraft() {
    dispatch({ type: "reset" });
    setStage("definition");
    setSelectedMemberId(null);
    setPreviewTemplate(null);
    setSelectionResetToken(token => token + 1);
    setMessage(initialMessage);
  }

  function removeMember(id: string) {
    dispatch({ type: "member.remove", id });
    if (selectedMemberId === id) setSelectedMemberId(null);
    setMessage("已删除成员，并清理关联的连接、接口及参数绑定");
  }

  function connectFirstInterfaces() {
    const [a, b] = document.assembly.members;
    if (!a || !b) return setMessage("至少加入两个零部件后才能记录内部连接");
    const from = a.interfaces[0], to = b.interfaces[0];
    if (!from || !to) return setMessage("成员缺少可连接接口，请先读取零部件接口定义");
    if (document.assembly.mates.some(mate => mate.from.memberId === a.id && mate.from.interfaceId === from.id && mate.to.memberId === b.id && mate.to.interfaceId === to.id)) return setMessage("这两个接口已记录连接关系");
    dispatch({ type: "mate.add", mate: { id: crypto.randomUUID(), from: { memberId: a.id, interfaceId: from.id }, to: { memberId: b.id, interfaceId: to.id }, relation: "贴合", offset: 0 } });
    setMessage("已记录接口贴合关系；装配求解尚未接入，成员位置未改变");
  }

  function inheritInterface() {
    if (!selectedMember) return setMessage("请先选择一个组件成员");
    const sourceInterface = selectedMember.interfaces.find(item => !document.ports.some(port => port.source.memberId === selectedMember.id && port.source.interfaceId === item.id));
    if (!sourceInterface) return setMessage("该成员没有尚未继承的接口");
    dispatch({ type: "port.add", port: { id: crypto.randomUUID(), name: `${selectedMember.name}-${sourceInterface.name}`, source: { memberId: selectedMember.id, interfaceId: sourceInterface.id }, tags: [...sourceInterface.tags] } });
    setStage("interfaces");
    setMessage(`已继承 ${sourceInterface.name} 为组件对外接口`);
  }

  function exportDraft() {
    const blob = new Blob([serializeComponent(document)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    const filename = document.definition.name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_") || "组件模板";
    link.href = url;
    link.download = `${filename}.component.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage("组件草稿已导出，正式发布尚未接入");
  }

  return { document, dispatch, stage, setStage, selectedMemberId, selectedMember, setSelectedMemberId, previewTemplate, setPreviewTemplate, selectionResetToken, message, setMessage, checks, newDraft, removeMember, connectFirstInterfaces, inheritInterface, exportDraft };
}
