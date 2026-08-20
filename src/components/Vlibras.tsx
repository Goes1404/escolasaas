
"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

/**
 * Componente VLibras adaptado para máxima estabilidade e evitar erros de hidratação.
 */
export function Vlibras() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const initVlibras = () => {
      try {
        if (typeof window !== "undefined" && (window as any).VLibras) {
          // Pequeno delay para garantir que o DOM está pronto para a injeção
          setTimeout(() => {
            new (window as any).VLibras.Widget("https://vlibras.gov.br/app");
          }, 500);
        }
      } catch (e) {
        console.warn("VLibras init failed:", e);
      }
    };

    if ((window as any).VLibras) {
      initVlibras();
    } else {
      window.addEventListener("vlibras-loaded", initVlibras);
    }

    return () => window.removeEventListener("vlibras-loaded", initVlibras);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <Script 
        src="https://vlibras.gov.br/app/vlibras-plugin.js" 
        strategy="lazyOnload"
        onLoad={() => {
          window.dispatchEvent(new Event("vlibras-loaded"));
        }}
      />
      <div data-vw="true" className="enabled">
        <div data-vw-access-button="true" className="active"></div>
        <div data-vw-plugin-wrapper="true">
          <div className="vw-plugin-top-wrapper"></div>
        </div>
      </div>
    </>
  );
}
