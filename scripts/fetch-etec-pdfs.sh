#!/usr/bin/env bash
# Baixa provas + gabaritos oficiais do Vestibulinho ETEC e extrai o texto (pdftotext).
#
# Uso:
#   bash scripts/fetch-etec-pdfs.sh                 # todas as edições conhecidas
#   bash scripts/fetch-etec-pdfs.sh 2024-1 2023-2   # só as edições indicadas
#   OUT=/caminho bash scripts/fetch-etec-pdfs.sh
#
# Saída: <OUT>/<ano>-<sem>.prova.txt e <ano>-<sem>.gabarito.txt
# (consumidos por `npm run import:etec`). Requer pdftotext (poppler).
#
# ── Por que um manifesto fixo ───────────────────────────────────────────────
# A versão anterior raspava https://vestibulinho.etec.sp.gov.br/provas-gabaritos
# para descobrir os links. Esse site responde **HTTP 403 para IPs de datacenter**
# (CI, contêiner, servidor), então o download falhava silenciosamente em qualquer
# ambiente que não fosse uma máquina doméstica.
#
# Os PDFs em si ficam no bucket S3 oficial do Centro Paula Souza
# (fatweb.s3.amazonaws.com), que responde 200 de qualquer lugar. O manifesto
# abaixo aponta direto para lá — mesma fonte oficial, sem o bloqueio.
#
# Para acrescentar uma edição nova: abra a página de provas e gabaritos num
# navegador comum, copie o id numérico do link do PDF e some uma linha aqui.
set -uo pipefail

OUT="${OUT:-${TMPDIR:-/tmp}/etec}"
BASE="https://fatweb.s3.amazonaws.com/vestibulinhoetec/gabarito"

# rotulo|id-no-s3|arquivo-da-prova|arquivo-do-gabarito
MANIFEST=$(cat <<'L'
2025-1|20251468190|Prova.pdf|Gabarito.pdf
2024-2|20242918930|Prova.pdf|Gabarito-retificado.pdf
2024-1|202423718|Prova.pdf|Gabarito.pdf
2023-2|202323718|Prova.pdf|Gabarito.pdf
2023-1|202311698|Prova.pdf|Gabarito.pdf
2022-2|2022027483|Prova.pdf|Gabarito.pdf
2020-1|202017430|Prova_1modulo.pdf|Gabarito_1modulo-retificado.pdf
2019-2|201927134|Prova_1modulo.pdf|Gabarito_1modulo.pdf
2019-1|201917532|Prova_1modulo.pdf|Gabarito_1modulo.pdf
2018-2|201826901|Prova_1modulo.pdf|Gabarito_1modulo.pdf
2018-1|201816012|Prova_1modulo.pdf|Gabarito_1modulo.pdf
2017-2|201727490|Prova_1modulo.pdf|Gabarito_1modulo_retificado.pdf
2017-1|201718301|Prova_1modulo.pdf|Gabarito_1modulo.pdf
2016-2|20162639|Prova_1modulo.pdf|Gabarito_1modulo.pdf
2016-1|20161738|Prova_1modulo.pdf|Gabarito_1modulo.pdf
2015-2|20152679|Prova_1modulo.pdf|Gabarito_1modulo.pdf
2015-1|20147534|Prova_1modulo.pdf|Gabarito_1modulo.pdf
L
)

command -v pdftotext >/dev/null || { echo "❌ pdftotext ausente (instale poppler-utils)"; exit 1; }

WANTED="$*"
mkdir -p "$OUT"
echo "📥 Vestibulinho ETEC → $OUT"

ok=0; bad=0
while IFS='|' read -r rot id prova gab; do
  [ -z "${rot:-}" ] && continue
  # Se o usuário pediu edições específicas, ignora as demais.
  if [ -n "$WANTED" ] && ! printf '%s\n' $WANTED | grep -qx "$rot"; then continue; fi

  cp=$(curl -s -o "$OUT/$rot.prova.pdf" -w '%{http_code}' -L "$BASE/$id/$prova")
  cg=$(curl -s -o "$OUT/$rot.gab.pdf"   -w '%{http_code}' -L "$BASE/$id/$gab")

  if [ "$cp" != "200" ] || [ "$cg" != "200" ] || [ ! -s "$OUT/$rot.prova.pdf" ]; then
    echo "  ⚠️  $rot: download falhou (prova=$cp gabarito=$cg)"
    rm -f "$OUT/$rot".*.pdf
    bad=$((bad + 1))
    continue
  fi

  pdftotext -layout -enc UTF-8 "$OUT/$rot.prova.pdf" "$OUT/$rot.prova.txt" 2>/dev/null
  pdftotext -layout -enc UTF-8 "$OUT/$rot.gab.pdf"   "$OUT/$rot.gabarito.txt" 2>/dev/null
  echo "  ✔ $rot ($(wc -l < "$OUT/$rot.prova.txt") linhas)"
  ok=$((ok + 1))
done <<< "$MANIFEST"

echo "🏁 $ok edições baixadas, $bad falhas. Agora rode: npm run import:etec -- --dir $OUT"
