import { useEffect, useState, useCallback } from "react";
import { repositories, useGlobalStore } from "@/store/global.store";
import { Script } from "@/store/repositories/entities/script";

export const useScripts = () => {
  const [globalState] = useGlobalStore();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);

  const loadScripts = useCallback(async () => {
    setLoading(true);
    try {
      const allScripts = await repositories.scripts.getAll();
      setScripts(allScripts);
    } catch (error) {
      console.error("Failed to load scripts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScripts();
  }, [loadScripts, globalState.createVariableDialog.isOpen]);

  return { scripts, loading, refresh: loadScripts };
};
