import { useEffect, useRef } from "react";

export function useAutoScrollToBottom(dep) {
  const targetRef = useRef(null);

  useEffect(() => {
    targetRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [dep]);

  return targetRef;
}
