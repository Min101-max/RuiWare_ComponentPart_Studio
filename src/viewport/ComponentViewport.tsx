import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import { Boxes, Eye } from "lucide-react";
import type { ComponentMember } from "../domain/component";
import type { PublishedTemplate } from "../library/publishedLibrary";

type Props = { members: ComponentMember[]; mateCount: number; previewTemplate: PublishedTemplate | null };

export function ComponentViewport({ members, mateCount, previewTemplate }: Props) {
  return <section className="viewport" aria-label="组件三维视图">
    <div className="viewport-toolbar"><button className="tool active" type="button"><Eye size={15}/>预览</button><span>拖拽视图旋转 · 滚轮缩放</span><span className="view-status">{members.length} 个成员 · {mateCount} 个连接</span></div>
    <div className="viewport-scene"><Canvas camera={{ position: [7, 5, 7], up: [0, 0, 1], fov: 42 }}>
      <color attach="background" args={["#f5f7f9"]}/><ambientLight intensity={1.8}/><directionalLight position={[4, 6, 5]} intensity={2}/>
      <Grid args={[20, 20]} rotation={[Math.PI / 2, 0, 0]} cellSize={.5} cellThickness={.5} sectionSize={2.5} sectionThickness={1}/><OrbitControls makeDefault/>
    </Canvas></div>
    <div className="empty-overlay"><Boxes size={30}/><b>{previewTemplate ? `已选择：${previewTemplate.name}` : members.length ? "组件成员模型尚未加载" : "浏览已发布零部件"}</b><span>{previewTemplate ? `V${previewTemplate.version} · 模型预览尚未接入` : "点击左侧模板查看版本信息"}</span></div>
  </section>;
}
