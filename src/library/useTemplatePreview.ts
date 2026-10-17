import { useEffect, useState } from "react";
import type { PublishedTemplate } from "./publishedLibrary";
import { loadTemplatePreview } from "./templatePreview";
import type { LoadedPreview, PreviewPhase } from "./templatePreview";

export function useTemplatePreview(selected: PublishedTemplate | null) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ selected: PublishedTemplate | null; phase: PreviewPhase; result: LoadedPreview | null; error: string }>({ selected: null, phase: "package", result: null, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    let resource: LoadedPreview | null = null;
    setState({ selected, phase: "package", result: null, error: "" });
    if (selected) {
      void loadTemplatePreview(selected, controller.signal, phase => {
        if (!controller.signal.aborted) setState({ selected, phase, result: null, error: "" });
      }).then(result => {
        if (controller.signal.aborted) { result.geometry.dispose(); return; }
        resource = result;
        setState({ selected, phase: "model", result, error: "" });
      }).catch(error => {
        if (!controller.signal.aborted) setState({ selected, phase: "package", result: null, error: error instanceof TypeError ? "无法连接组件后端，请检查服务后重试。" : error instanceof Error ? error.message : "模型读取失败，请重试。" });
      });
    }
    return () => { controller.abort(); resource?.geometry.dispose(); };
  }, [selected, attempt]);
  return {
    result: state.selected === selected ? state.result : null,
    error: state.selected === selected ? state.error : "",
    phase: state.selected === selected ? state.phase : "package",
    retry: () => setAttempt(value => value + 1),
  };
}
