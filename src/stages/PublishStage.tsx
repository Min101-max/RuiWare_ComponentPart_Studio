import { Download } from "lucide-react";
import type { ValidationCheck } from "../domain/validation";

export function PublishStage({ checks, revision, onExport }: { checks: ValidationCheck[]; revision: number; onExport: () => void }) {
  const failed = checks.filter(check => check.status === "fail").length;
  const pending = checks.filter(check => check.status === "pending").length;
  return <>
    <div className="callout"><b>当前为组件草稿 R{revision}</b><br/>{failed} 项基础检查待处理，{pending} 项能力待接入。正式发布服务尚未接入。</div>
    <p className="empty-text">可导出当前草稿及检查结果。导出草稿不会生成正式发布版本。</p>
    <button className="primary full" onClick={onExport}><Download size={15}/>导出组件草稿</button>
  </>;
}
