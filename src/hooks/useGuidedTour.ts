"use client";

import { useCallback, useRef } from "react";
import { driver, type DriveStep, type Config } from "driver.js";
import "driver.js/dist/driver.css";

interface UseGuidedTourOptions {
  steps: DriveStep[];
  onComplete?: () => void;
  onSkip?: () => void;
}

export function useGuidedTour({ steps, onComplete, onSkip }: UseGuidedTourOptions) {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  const start = useCallback(() => {
    // Limpa instância anterior se existir
    if (driverRef.current) {
      driverRef.current.destroy();
    }

    const driverInstance = driver({
      showProgress: true,
      animate: true,
      overlayColor: "rgba(0, 0, 0, 0.75)",
      stagePadding: 8,
      stageRadius: 12,
      popoverClass: "app-tour-popover",
      nextBtnText: "Próximo →",
      prevBtnText: "← Anterior",
      doneBtnText: "Concluir ✓",
      progressText: "{{current}} de {{total}}",
      onDestroyStarted: () => {
        if (driverInstance.hasNextStep()) {
          // Usuário clicou em fechar/pular antes de terminar
          onSkip?.();
        } else {
          // Completou todos os steps
          onComplete?.();
        }
        driverInstance.destroy();
      },
      steps,
    });

    driverRef.current = driverInstance;
    driverInstance.drive();
  }, [steps, onComplete, onSkip]);

  const stop = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, []);

  return { start, stop };
}
