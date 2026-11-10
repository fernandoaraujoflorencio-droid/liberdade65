#!/usr/bin/env python3
"""Robô de cotações da página pública do Liberdade 65.

Atualiza cotacoes.js com uma lista AMPLA de ativos da B3 (universo.txt) —
não a carteira de ninguém —, para os gráficos de 3 meses do app.
Fonte: Yahoo Finance (yfinance), gratuito, sem token.

Formato compacto (as datas aparecem uma vez só):
  window.COTACOES = { atualizado_em, datas: ["AAAA-MM-DD", ...],
    ativos: { "TICK11": { preco, variacao, data, max, min, ant, vol,
                          h: [fechamento ou null, ... alinhado às datas] } } };
Só reescreve o arquivo quando alguma cotação mudou.
Uso: python scripts/cotacoes_publicas.py
"""
import datetime as dt
import json
import math
import os
import re
import sys

PASTA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIVERSO = os.environ.get("UNIVERSO_TXT", os.path.join(PASTA, "universo.txt"))
SAIDA = os.environ.get("COTACOES_JS", os.path.join(PASTA, "cotacoes.js"))
FUSO_BR = dt.timezone(dt.timedelta(hours=-3))
CABECALHO = ("/* Gerado por scripts/cotacoes_publicas.py — lista ampla da B3 (universo.txt), "
             "não é a carteira de ninguém. Não edite à mão. */\n")


def ler_universo(caminho):
    out = []
    with open(caminho, encoding="utf-8") as f:
        for linha in f:
            for t in linha.split("#", 1)[0].split():
                t = re.sub(r"[^A-Z0-9]", "", t.upper())
                if t and t not in out:
                    out.append(t)
    return out


def ler_anterior(caminho):
    try:
        texto = open(caminho, encoding="utf-8").read()
    except FileNotFoundError:
        return None
    m = re.search(r"window\.COTACOES\s*=\s*(\{.*\})\s*;?\s*$", texto, re.S)
    try:
        return json.loads(m.group(1)) if m else None
    except json.JSONDecodeError:
        return None


def num(v, casas=2):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(v) or v <= 0 else round(v, casas)


def coluna(df, ticker, campo):
    """Série de um campo para o ticker, com ou sem MultiIndex nas colunas."""
    sym = ticker + ".SA"
    if getattr(df.columns, "nlevels", 1) > 1:
        for chave in ((sym, campo), (campo, sym)):
            if chave in df.columns:
                return df[chave]
        return None
    return df[campo] if campo in df.columns else None


def main():
    tickers = ler_universo(UNIVERSO)
    try:
        import yfinance as yf
    except ImportError:
        print("yfinance não instalado")
        return 1
    print(f"{len(tickers)} ativos no universo — baixando 3 meses do Yahoo Finance…", flush=True)
    df = yf.download([t + ".SA" for t in tickers], period="3mo", interval="1d", group_by="ticker",
                     auto_adjust=False, threads=True, progress=False)
    if df is None or len(df.index) == 0:
        print("Nenhum dado recebido — cotacoes.js não foi alterado.")
        return 0
    datas = [d.date().isoformat() if hasattr(d, "date") else str(d)[:10] for d in df.index]
    anterior = ler_anterior(SAIDA)
    velhos = (anterior or {}).get("ativos", {})
    ativos, falhas = {}, []
    for t in tickers:
        fech = coluna(df, t, "Close")
        if fech is None:
            falhas.append(t)
            continue
        h = [num(v) for v in fech.tolist()]
        validos = [(i, v) for i, v in enumerate(h) if v]
        if len(validos) < 2:
            if t in velhos:
                ativos[t] = velhos[t]          # mantém o último preço conhecido
            else:
                falhas.append(t)
            continue
        (iu, ult), (_, ant) = validos[-1], validos[-2]
        d = dt.date.fromisoformat(datas[iu])
        e = {"preco": ult, "variacao": round((ult / ant - 1) * 100, 2),
             "data": dt.datetime(d.year, d.month, d.day, 18, 0, tzinfo=FUSO_BR).astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
             "ant": ant, "h": h}
        for chave, campo in (("max", "High"), ("min", "Low")):
            s = coluna(df, t, campo)
            if s is not None and num(s.tolist()[iu]):
                e[chave] = num(s.tolist()[iu])
        s = coluna(df, t, "Volume")
        if s is not None:
            try:
                v = float(s.tolist()[iu])
                if v > 0 and not math.isnan(v):
                    e["vol"] = int(v)
            except (TypeError, ValueError):
                pass
        ativos[t] = e
    print(f"{len(ativos)} com cotação · {len(falhas)} sem dados{': ' + ', '.join(falhas[:20]) if falhas else ''}")
    if anterior is not None and anterior.get("ativos") == ativos and anterior.get("datas") == datas:
        print("Nada mudou — cotacoes.js não foi alterado.")
        return 0
    saida = {"atualizado_em": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
             "datas": datas, "ativos": dict(sorted(ativos.items()))}
    with open(SAIDA, "w", encoding="utf-8", newline="\n") as f:
        f.write(CABECALHO + "window.COTACOES = " + json.dumps(saida, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"cotacoes.js atualizado ({os.path.getsize(SAIDA) // 1024} KB).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
