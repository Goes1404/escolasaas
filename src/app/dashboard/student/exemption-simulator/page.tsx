
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle,
  XCircle,
  Calculator,
  Sparkles,
  Loader2,
  HandHeart,
  AlertCircle,
} from "lucide-react";

interface EligibilityResult {
  isEligible: boolean;
  message: string;
  reason: string;
}

export default function ExemptionSimulatorPage() {
  const [familyIncome, setFamilyIncome] = useState("");
  const [schoolType, setSchoolType] = useState("");
  const [hasCadUnico, setHasCadUnico] = useState("");

  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSimulation = () => {
    setIsLoading(true);
    setResult(null);

    setTimeout(() => {
      const income = parseFloat(familyIncome);
      const minimumWage = 1412;

      if (hasCadUnico === "yes" && schoolType === "public" && income <= 1.5 * minimumWage) {
        setResult({
          isEligible: true,
          message: "Parabéns! Você tem alta probabilidade de ser elegível!",
          reason:
            "Você atende aos critérios principais: inscrição no CadÚnico, estudou em escola pública e possui renda familiar per capita de até 1,5 salário mínimo.",
        });
      } else if (schoolType === "public" && income <= 1.5 * minimumWage) {
        setResult({
          isEligible: true,
          message: "Você provavelmente é elegível!",
          reason:
            "Você atende aos critérios de renda e de ter cursado o ensino médio em escola pública. A inscrição no CadÚnico pode acelerar seu processo.",
        });
      } else {
        setResult({
          isEligible: false,
          message: "Pouco provável que você seja elegível.",
          reason:
            "Com base nos dados fornecidos, você não atende aos critérios principais de renda familiar ou tipo de escola exigidos pela maioria dos programas de isenção.",
        });
      }
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="pb-24 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Hero ── */}
      <div className="relative rounded-[2rem] overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 shadow-2xl shadow-emerald-200 p-6">
        <div className="absolute top-[-10%] right-[-5%] w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <HandHeart className="h-3 w-3 text-emerald-200" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80">
              Apoio Social
            </p>
          </div>
          <h1 className="text-2xl font-black italic tracking-tighter text-white leading-none">
            Simulador de Isenção
          </h1>
          <p className="text-white/80 text-xs font-semibold mt-1">
            Descubra se você tem direito à isenção da taxa
          </p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="bg-white border border-slate-100 shadow-sm rounded-[1.5rem] overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-emerald-600" />
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-600">
              Preencha os dados
            </p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
              Renda mensal total da família
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold pointer-events-none">
                R$
              </span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="2100,50"
                value={familyIncome}
                onChange={(e) => setFamilyIncome(e.target.value)}
                className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 text-sm font-bold text-primary placeholder:text-slate-400 outline-none focus:border-emerald-400 transition-all"
              />
            </div>
            <p className="text-[9px] text-slate-400 font-medium ml-1">
              Salário mínimo de referência: R$ 1.412,00
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
              Cursou todo o ensino médio em escola pública?
            </label>
            <Select value={schoolType} onValueChange={setSchoolType}>
              <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200 text-primary font-bold text-sm">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 bg-white">
                <SelectItem value="public" className="font-bold text-slate-700">Sim, escola pública</SelectItem>
                <SelectItem value="private" className="font-bold text-slate-700">Não, escola privada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
              Família inscrita no CadÚnico?
            </label>
            <Select value={hasCadUnico} onValueChange={setHasCadUnico}>
              <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-200 text-primary font-bold text-sm">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 bg-white">
                <SelectItem value="yes" className="font-bold text-slate-700">Sim</SelectItem>
                <SelectItem value="no" className="font-bold text-slate-700">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSimulation}
            disabled={isLoading || !familyIncome || !schoolType || !hasCadUnico}
            className="w-full h-13 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/30 border-none text-xs uppercase tracking-widest disabled:opacity-40 group"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Simular Agora
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* ── Result ── */}
      {result && (
        <div
          className={`relative rounded-[1.5rem] overflow-hidden border p-5 animate-in slide-in-from-bottom-4 duration-500 ${
            result.isEligible
              ? "bg-emerald-50 border-emerald-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                result.isEligible
                  ? "bg-emerald-100 border-emerald-200"
                  : "bg-red-100 border-red-200"
              }`}
            >
              {result.isEligible ? (
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className={`font-black italic text-base leading-tight ${
                  result.isEligible ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {result.message}
              </h3>
              <p
                className={`text-xs font-medium italic leading-relaxed mt-2 ${
                  result.isEligible ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {result.reason}
              </p>
              <div className={`flex items-start gap-1.5 mt-3 pt-3 border-t ${result.isEligible ? "border-emerald-100" : "border-red-100"}`}>
                <AlertCircle className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  Este é um resultado preliminar. A confirmação final depende das regras de cada edital de vestibular.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
