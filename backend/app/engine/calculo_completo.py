"""
Motor central de cálculo PDA — única fonte de verdade para cálculos normativos.
100% conforme NBR 5419-2:2026, Anexos A, B, C, D e Seção 7.

CORREÇÕES aplicadas vs versão anterior:
1. LA/LB/LC incluem rs (Tabela C.7) — faltava
2. LB usa LF correto por tipo de estrutura (Tabela C.2)
3. LC usa LO correto — só ativo se tem_lo (risco explosão/vida imediata)
4. RU/RV/RW usam (NL + NDJ) — estrutura adjacente implementada (Eq. A.4)
5. FV = (NL+NDJ) × PEB (Tabela 7 — corrente impulsiva)
6. FW = (NL+NDJ) × PW, com PW = PSPD × PLD × CLD (Tabela 7 / Eq. B.10)
9. PA = PTA × PB (Eq. B.1)
10. PM = PSPD × PMS quando houver sistema coordenado de DPS (Eq. B.3)
11. AD com saliência avalia max(AD_base, AD_saliência), conforme Eq. A.1/A.2
7. rs, tipo_estrutura, tipo_construcao como parâmetros da estrutura
8. R4 com valores econômicos por zona (Anexo D) corrigido com ct_global e D3
9. R1 aplica RC/RM/RW/RZ apenas quando D3-L1 é aplicável
   (risco de explosão ou falha de sistemas internos com risco imediato à vida/meio ambiente).
"""
import math
from fastapi import HTTPException

from app.nbr5419.parte2_linhas import (
    calcular_pld_tabela_b8,
    calcular_pli_tabela_b9,
)

from app.schemas.calcular import (
    CalcRequest, CalcResponse, LinhaCalcOut, TrechoCalcOut, ZonaCalcOut, LinhaContribOut,
)



# Tabelas B.8 e B.9 são consultadas em app.nbr5419.parte2_linhas.
# A consulta é exata: não há interpolação nem escolha por valor mais próximo.


# ─── Tabelas de fatores ────────────────────────────────────────────────────────
_CD = {"CERCADA_OBJETOS_MAIS_ALTOS":0.25,"CERCADA_MESMA_ALTURA":0.50,"ISOLADA":1.00,"ISOLADA_TOPO_COLINA":2.00}
_CI = {"AEREO":1.0,"ENTERRADO":0.5,"ENT_MALHA":0.01}
_CT = {"BT_SINAL":1.0,"AT_COM_TRAFO":0.2}
_CE = {"RURAL":1.0,"SUBURBANO":0.5,"URBANO":0.1,"URBANO_ALTAS":0.01}
_CLD_CLI: dict[str,tuple[float,float]] = {
    "AEREO_NAO_BLINDADO":(1.0,1.0),"ENTERRADO_NAO_BLINDADO":(1.0,1.0),
    "LINHA_ENERGIA_AT_NEUTRO_MULTI_ATERRADO":(1.0,0.2),"ENTERRADO_BLINDADO_NAO_ATERRADO":(1.0,0.3),
    "AEREO_BLINDADO_NAO_ATERRADO":(1.0,0.1),"AEREO_BLINDADO_ATERRADO":(1.0,0.0),
    "CABO_PROTECAO_METALICO":(0.0,0.0),"SEM_LINHA_EXTERNA":(0.0,0.0),
    "INTERFACE_ISOLANTE_PROTEGIDA_POR_DPS":(0.0,0.0),
}
LT = 1e-2  # Tab.C.2 D1

# Tabela D.2 — LF/LO para L4.
# A NBR 5419-2:2026 não lista "edifício cívico" nem "residencial" em D.2;
# quando esses tipos forem recebidos, eles caem em OUTROS.
_LF_D2 = {
    "RISCO_EXPLOSAO": 1.0,
    "HOSPITAL": 0.5, "INDUSTRIAL": 0.5, "MUSEU": 0.5, "AGRICULTURA": 0.5,
    "HOTEL": 0.2, "ESCOLA": 0.2, "ESCRITORIO": 0.2, "IGREJA": 0.2,
    "ENTRETENIMENTO_PUBLICO": 0.2, "COMERCIAL": 0.2,
    "OUTROS": 0.1,
}
_LO_D2 = {
    "RISCO_EXPLOSAO": 1e-1,
    "HOSPITAL": 1e-2, "INDUSTRIAL": 1e-2, "ESCRITORIO": 1e-2,
    "HOTEL": 1e-2, "COMERCIAL": 1e-2,
    "MUSEU": 1e-3, "AGRICULTURA": 1e-3, "ESCOLA": 1e-3,
    "IGREJA": 1e-3, "ENTRETENIMENTO_PUBLICO": 1e-3,
    "OUTROS": 1e-4,
}

_LF_L1 = {"RISCO_EXPLOSAO":1e-1,"HOSPITAL":1e-1,"HOTEL":1e-1,"ESCOLA":1e-1,"EDIFICIO_CIVICO":1e-1,
           "ENTRETENIMENTO_PUBLICO":5e-2,"IGREJA":5e-2,"MUSEU":5e-2,"INDUSTRIAL":2e-2,"COMERCIAL":2e-2,
           "RESIDENCIAL":1e-2,"AGRICULTURA":1e-2,"ESCRITORIO":1e-2,"OUTROS":1e-2}
_LO_L1 = {"RISCO_EXPLOSAO":1e-1,"HOSPITAL":1e-2,"HOTEL":1e-3,"ESCOLA":1e-3,"EDIFICIO_CIVICO":1e-3,
           "ENTRETENIMENTO_PUBLICO":1e-3,"IGREJA":1e-3,"MUSEU":1e-3,"INDUSTRIAL":1e-3,"COMERCIAL":1e-3,
           "RESIDENCIAL":1e-3,"AGRICULTURA":1e-3,"ESCRITORIO":1e-3,"OUTROS":1e-3}


# Tab. C.7: Simples (madeira/alvenaria simples)=2, Robusta (metálica/concreto)=1
_RS = {"ALV_CONCRETO":1.0,"METALICA":1.0,"MADEIRA":2.0}
LF_L3 = 1e-1  # Tab.C.9
_PTU = {"NENHUMA":1.0,"AVISOS_ALERTA":0.1,"ISOLACAO_ELETRICA_DESCIDA":0.01,
        "RESTRICOES_FISICAS_FIXAS":0.0}
# Tab. B.7: PEB por NP do DPS Classe I (III-IV combinados = 0.05)
_PEB = {"NENHUM":1.0,"IV":0.05,"III":0.05,"II":0.02,"I":0.01,"NP1_PLUS":0.005,"NP1_MAX":0.001}


def _pld(rs: str, uw: float) -> float:
    """Tabela B.8 — PLD por condição de blindagem/roteamento e UW, com consulta exata."""
    try:
        return calcular_pld_tabela_b8(rs, uw)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _pli(tipo_linha: str, uw: float) -> float:
    """Tabela B.9 — PLI por tipo da linha elétrica e UW, com consulta exata."""
    try:
        return calcular_pli_tabela_b9(tipo_linha, uw)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

def _calc_ndj(ng:float, adj, ct_key:str)->float:
    """Eq. A.4 — NDJ (estrutura adjacente ligada à linha)."""
    if adj is None: return 0.0
    la = getattr(adj, "l_adj", 0)
    wa = getattr(adj, "w_adj", 0)
    ha = getattr(adj, "h_adj", 0)
    if la <= 0 or wa <= 0 or ha <= 0: return 0.0
    ADJ = la*wa + 2*3*ha*(la+wa) + math.pi*(3*ha)**2
    CDJ = _CD.get(getattr(adj, "cdj", "ISOLADA"), 1.0)
    CT  = _CT.get(getattr(adj, "ct_adj", ct_key), 1.0)
    return ng * ADJ * CDJ * CT * 1e-6


def _combined_probability(probabilities:list[float])->float:
    """Combinação conforme Eq. 12/13 e Eq. 17/18: 1 - Π(1-Pi)."""
    if not probabilities:
        return 0.0
    p_no_damage = 1.0
    for p in probabilities:
        p = max(0.0, min(float(p), 1.0))
        p_no_damage *= (1.0 - p)
    return 1.0 - p_no_damage


def _ks3_values_for_zone(z, linhas)->list[float]:
    """Retorna KS3 por sistema interno (energia/sinal) para combinação de PC/PM."""
    has_energy = any(getattr(l, "tipo_linha", "ENERGIA") == "ENERGIA" for l in linhas)
    has_signal = any(getattr(l, "tipo_linha", "ENERGIA") == "SINAL" for l in linhas)
    fallback = float(getattr(z, "ks3", 1.0))
    vals = []
    if has_energy:
        vals.append(float(getattr(z, "ks3_energia", fallback)))
    if has_signal:
        vals.append(float(getattr(z, "ks3_sinal", fallback)))
    if not vals:
        vals.append(fallback)
    return vals


def calcular_pda(req: CalcRequest) -> CalcResponse:
    e = req.estrutura
    CD = _CD.get(e.loc, 1.0)

    # Áreas e eventos globais
    # Eq. A.1 para a estrutura retangular. Se houver saliência/proeminência,
    # compara-se AD_base com AD' (Eq. A.2), em vez de aplicar Hp à edificação toda.
    AD_base = e.L*e.W + 2*3*e.H*(e.L+e.W) + math.pi*(3*e.H)**2
    Hp = getattr(e, "Hp", 0) or 0
    AD_salien = math.pi*(3*Hp)**2 if Hp > 0 else 0.0
    AD = max(AD_base, AD_salien)                                    # Eq. A.1/A.2
    ND = e.NG * AD * CD * 1e-6                                      # Eq. A.3
    AM = 2*500*(e.L+e.W) + math.pi*500**2                          # Eq. A.6
    NM = e.NG * AM * 1e-6                                           # Eq. A.5

    PB = e.pb                                                       # Tab. B.2 → B.3
    PTA = e.pta                                                     # Tab. B.1
    PA = PTA * PB                                                   # Eq. B.1: PA = PTA × PB

    tipo_struct = getattr(e, "tipo_estrutura", "OUTROS")
    tipo_const  = getattr(e, "tipo_construcao", "ALV_CONCRETO")
    LF_base = _LF_L1.get(tipo_struct, 1e-2)
    LO_base = _LO_L1.get(tipo_struct, 1e-3)
    rs = _RS.get(tipo_const, 1.0)   # Tab. C.7

    # Linhas
    linhas_out:list[LinhaCalcOut] = []
    L_nl={}; L_ni={}; L_ndj={}; L_pld={}; L_pli={}; L_cld={}; L_cli={}
    L_nl_pld={}; L_ni_pli={}; L_ndj_pld={}  # ponderados por PLD/PLI (6.4.3)

    for linha in req.linhas:
        cld,cli = _CLD_CLI.get(linha.cld_cli,(1.0,1.0))
        trechos_out=[]; nl_tot=0.0; ni_tot=0.0; al_tot=0.0; ai_tot=0.0; pld_s=0.0; pli_s=0.0

        # Somas ponderadas por NL para cálculo correto com múltiplos trechos (6.4.3)
        nl_x_pld = 0.0   # Σ(NL_trecho × PLD_trecho) — para PV e PU
        ni_x_pli = 0.0   # Σ(NI_trecho × PLI_trecho) — para PZ
        pld_avg = 0.0    # PLD médio para exibição

        for t in linha.trechos:
            ci=_CI.get(t.instalacao_ci,1.0); ct=_CT.get(t.tipo_ct,1.0); ce=_CE.get(t.ambiente_ce,1.0)
            AL_t = 40 * t.comprimento_m                              # Eq. A.8
            AI_t = 4000 * t.comprimento_m                            # Eq. A.10
            nl_t = e.NG * AL_t * ci*ct*ce * 1e-6                    # Eq. A.7/A.8
            ni_t = e.NG * AI_t * ci*ct*ce * 1e-6                    # Eq. A.9/A.10
            pld_t = _pld(t.blindagem_rs, t.uw_kv)
            # PLI depende do TIPO DE LINHA (ENERGIA/SINAL), não do CT do trecho (Tab. B.9)
            pli_t = _pli(linha.tipo_linha, t.uw_kv)
            nl_tot+=nl_t; ni_tot+=ni_t; al_tot+=AL_t; ai_tot+=AI_t
            nl_x_pld += nl_t * pld_t          # NL ponderado por PLD
            ni_x_pli += ni_t * pli_t           # NI ponderado por PLI
            pld_avg  += pld_t
            trechos_out.append(TrechoCalcOut(id=t.id,AL=AL_t,AI=AI_t,NL=nl_t,NI=ni_t,PLD=pld_t,PLI=pli_t))

        n = max(len(linha.trechos),1)
        pld_avg /= n   # só para exibição
        # Eq. A.4 — NDJ: descarga na estrutura adjacente ligada à linha
        ct_key = linha.trechos[0].tipo_ct if linha.trechos else "BT_SINAL"
        ndj_l = _calc_ndj(e.NG, linha.adj, ct_key)
        # NDJ usa PLD médio da linha (conservador)
        ndj_x_pld = ndj_l * pld_avg if nl_tot > 0 else 0.0

        linhas_out.append(LinhaCalcOut(id=linha.id,nome=linha.nome,tipo_linha=linha.tipo_linha,AL_total=al_tot,AI_total=ai_tot,NL_total=nl_tot,NI_total=ni_tot,NDJ=ndj_l,trechos=trechos_out))
        L_nl[linha.id]=nl_tot; L_ni[linha.id]=ni_tot; L_ndj[linha.id]=ndj_l
        # Armazena somas ponderadas para uso nas zonas (6.4.3)
        L_nl_pld[linha.id]=nl_x_pld    # Σ(NL×PLD) por trecho
        L_ni_pli[linha.id]=ni_x_pli    # Σ(NI×PLI) por trecho
        # NDJ usa max(PLD) dos trechos — descarga direta → pior trecho é relevante (6.4.3)
        pld_values = [_pld(t.blindagem_rs, t.uw_kv) for t in linha.trechos]
        pld_max_val = max(pld_values) if pld_values else pld_avg
        ndj_x_pld = ndj_l * pld_max_val   # NDJ × max(PLD) dos trechos
        L_ndj_pld[linha.id]=ndj_x_pld  # NDJ × max(PLD)
        L_pld[linha.id]=pld_avg; L_pli[linha.id]=ni_x_pli/max(ni_tot,1e-20)
        L_cld[linha.id]=cld; L_cli[linha.id]=cli

    # Zonas
    zonas_out:list[ZonaCalcOut] = []

    # Cálculo do valor total da estrutura (ct) para L4 — Anexo D.
    # ct é a soma de todas as zonas para animais, edificação, conteúdo e sistemas internos.
    # Não pode ser forçado para 1, pois isso altera as relações ca/ct, (ca+cb+cc+cs)/ct e cs/ct.
    ct_global = sum((getattr(zo, "val_animais", 0.0) +
                     getattr(zo, "val_edificio", 0.0) +
                     getattr(zo, "val_conteudo", 0.0) +
                     getattr(zo, "val_sistemas", 0.0)) for zo in req.zonas)
    usa_relacoes_l4 = any(getattr(zo, "habilitar_l4", False) and getattr(zo, "l4_usar_relacoes_valor", False) for zo in req.zonas)
    if usa_relacoes_l4 and ct_global <= 0:
        raise HTTPException(status_code=422, detail="Para L4 com relações econômicas habilitadas, informe valores econômicos para que ct > 0.")

    for z in req.zonas:
        tz_h = min(z.tz_valor if z.tz_mode=="h_ano" else z.tz_valor*365, 8760.0)
        fp = (z.nz / max(e.nt,1)) * (tz_h/8760.0)   # fator de permanência

        # PB/PTA podem ser informados por zona em adaptadores legados/multizona.
        # Quando não informados, usa-se o valor global da estrutura, preservando
        # o comportamento do endpoint principal /calcular.
        PB_z = float(getattr(z, "pb", None) if getattr(z, "pb", None) is not None else PB)
        PTA_z = float(getattr(z, "pta", None) if getattr(z, "pta", None) is not None else PTA)
        PA_z = PTA_z * PB_z

        lf_z = z.lf_valor if getattr(z,"lf_custom",False) else LF_base
        lo_z = LO_base  # LO de L3 é só para risco explosão; padrão = base

        # Perdas L1 (Tab. C.1)
        LA = z.rt * LT * fp * rs                        # Eq. C.1
        LB = z.rp * z.rf * z.hz * lf_z * fp * rs       # Eq. C.3
        # D3 em L1: RC/RM/RW/RZ aplicam-se somente para estruturas com
        # risco de explosão ou quando falhas dos sistemas internos podem
        # imediatamente colocar em risco a vida humana ou o meio ambiente.
        # Quando aplicável e não houver LO customizado na zona, usa-se o LO
        # típico do tipo de estrutura (Tabela C.2).
        d3_l1_aplicavel = bool(getattr(z, "tem_lo", False)) or tipo_struct == "RISCO_EXPLOSAO"
        lo_custom = float(getattr(z, "lo", 0.0) or 0.0)
        lo_efetivo = (lo_custom if lo_custom > 0 else LO_base) if d3_l1_aplicavel else 0.0
        LC = lo_efetivo * fp * rs                        # Eq. C.4

        PSPD = z.pspd  # Tab. B.3 — sistema coordenado de DPS; 1 = nenhum DPS coordenado

        # PC — descarga NA estrutura causando falha dos sistemas internos.
        # Eq. B.2: PCi = PSPD × CLD. Se houver mais de um sistema interno
        # na zona, combinar conforme Eq. 12: PC = 1 - Π(1 - PCi).
        pc_values = [PSPD * L_cld[l.id] for l in req.linhas] if req.linhas else [PSPD]
        PC = _combined_probability(pc_values)

        # PM — descarga PRÓXIMA à estrutura causando falha dos sistemas internos.
        # Eq. B.3/B.4: PMi = PSPD × (KS1 × KS2 × KS3i × KS4)^2.
        # Se houver mais de um sistema interno na zona, combinar conforme Eq. 13.
        wm1  = getattr(z, "wm1", 20.0)
        wm2  = getattr(z, "wm2", 0.0)
        uw_equip = getattr(z, "uw_equip", 1.0)
        blindagem = getattr(z, "blindagem", False)

        # KS1 — blindagem/malha da estrutura, SPDA em malha ou descidas naturais
        # na interface ZPR0/1. A NBR limita KS1 a no máximo 1.
        # Sem malha/descidas/blindagem informada, considerar KS1=1.
        KS1 = min(0.12 * wm1, 1.0) if wm1 and wm1 > 0 else 1.0

        # KS2 — blindagem espacial interna. Só é aplicado quando a blindagem
        # espacial interna da zona está habilitada e há largura de malha informada.
        KS2 = min(0.12 * wm2, 1.0) if blindagem and wm2 and wm2 > 0 else 1.0

        # KS4 — fator da tensão suportável nominal do equipamento.
        KS4 = min(1.0 / max(uw_equip, 0.01), 1.0)

        ks3_values = _ks3_values_for_zone(z, req.linhas)

        # PMSi conforme Eq. B.4. Para mais de um sistema interno, combina-se por
        # 1 - Π(1 - PMSi), mesmo critério usado nas Eq. 12/13.
        pms_values = [(KS1 * KS2 * ks3_i * KS4) ** 2 for ks3_i in ks3_values]
        PMS = _combined_probability(pms_values)

        # PM = PMS sem DPS coordenado; com DPS coordenado, PM = PSPD × PMS.
        # Como PSPD=1 representa ausência de DPS coordenado, a expressão abaixo
        # atende ambos os casos.
        pm_values = [PSPD * pms_i for pms_i in pms_values]
        PM = _combined_probability(pm_values)

        # S1 — Eq. 4,5,6
        RA = ND * PA_z * LA
        RB = ND * PB_z * LB
        RC = ND * PC * LC

        # S2 — Eq. 7
        RM = NM * PM * LC

        # S3/S4 — Eqs. 8,9,10,11
        RU=RV=RW=RZ = 0.0
        linhas_contrib = []
        for linha in req.linhas:
            nl=L_nl[linha.id]; ni=L_ni[linha.id]; ndj=L_ndj[linha.id]
            cld=L_cld[linha.id]; cli=L_cli[linha.id]
            ptu=_PTU.get(getattr(z, "ptu", None) or linha.ptu,1.0); peb=_PEB.get(getattr(z, "peb", None) or linha.peb,1.0)
            nl_pld = L_nl_pld[linha.id]
            ni_pli = L_ni_pli[linha.id]
            ndj_pld = L_ndj_pld[linha.id]

            # PU = PTU × PEB × PLD × CLD; PV = PEB × PLD × CLD;
            # PW = PSPD × PLD × CLD. Portanto, S3 usa NL e NDJ ponderados por PLD.
            s3_evento = nl_pld + ndj_pld

            ru_l = (ptu * peb * cld * s3_evento) * LA
            rv_l = (peb * cld * s3_evento) * LB
            rw_l = (PSPD * cld * s3_evento) * LC
            rz_l = PSPD * cli * ni_pli * LC
            
            RU += ru_l; RV += rv_l; RW += rw_l; RZ += rz_l
            linhas_contrib.append(LinhaContribOut(id=linha.id, nome=linha.nome,
                RU=ru_l, RV=rv_l, RW=rw_l, RZ=rz_l))

        # R1 — mantém a composição normativa completa apenas quando D3-L1
        # é aplicável. Caso contrário, os componentes por falha de sistemas
        # internos não entram no risco de perda de vida humana.
        if d3_l1_aplicavel:
            R1 = RA + RB + RC + RM + RU + RV + RW + RZ
        else:
            R1 = RA + RB + RU + RV

        # L3 — Tab. C.8 (Eq. C.7)
        R3=0.0; RB3=0.0; RV3=0.0
        if z.tem_l3:
            LB3 = z.rp * z.rf * LF_L3 * z.cp_l3   # sem fp/rs para patrimônio
            RB3 = ND * PB_z * LB3
            # RV3 = (NL + NDJ) × PV × LV3, com PV = PEB × PLD × CLD.
            RV3 = sum((L_nl_pld[l.id] + L_ndj_pld[l.id]) * _PEB.get(getattr(z, "peb", None) or l.peb, 1.0) * L_cld[l.id] * LB3 for l in req.linhas)
            R3 = RB3+RV3

        # F — Seção 7, Tabela 7
        F=0.0; FB=0.0; FC=0.0; FM=0.0; FV=0.0; FW=0.0; FZ=0.0
        if z.habilitar_f:
            FB = (ND*PB_z) if z.zpr0a else 0.0
            FC = ND*PC
            # Tabela 7: FM = NM × PM.
            FM = NM * PM
            FV=FW=FZ=0.0
            for idx_l, linha in enumerate(req.linhas):
                cld=L_cld[linha.id]; cli=L_cli[linha.id]
                peb=_PEB.get(getattr(z, "peb", None) or linha.peb,1.0)
                nl=L_nl[linha.id]; ndj=L_ndj[linha.id]
                nl_pld = L_nl_pld[linha.id]
                ni_pli = L_ni_pli[linha.id]
                ndj_pld = L_ndj_pld[linha.id]
                
                fv_l = peb * (nl + ndj)                    
                fw_l = PSPD * cld * (nl_pld + ndj_pld)      
                fz_l = PSPD * cli * ni_pli                   
                
                FV += fv_l; FW += fw_l; FZ += fz_l
                if idx_l < len(linhas_contrib):
                    linhas_contrib[idx_l].FV = fv_l
                    linhas_contrib[idx_l].FW = fw_l
                    linhas_contrib[idx_l].FZ = fz_l
            F = FB+FC+FM+FV+FW+FZ

        # R4 — Anexo D (informativo)
        R4=0.0; RA4=0.0; RB4=0.0; RC4=0.0; RM4=0.0; RU4=0.0; RV4=0.0; RW4=0.0; RZ4=0.0
        if z.habilitar_l4:
            ca = getattr(z, "val_animais", 0.0)
            cb = getattr(z, "val_edificio", 0.0)
            cc = getattr(z, "val_conteudo", 0.0)
            cs = getattr(z, "val_sistemas", 0.0)

            # L4 — Anexo D, Tabela D.1/D.2.
            # LF/LO vêm diretamente da Tabela D.2.
            tipo_l4 = getattr(z, "tipo_estrutura_l4", None) or "USAR_TIPO_L1"
            tipo_l4_ref = tipo_struct if tipo_l4 in ("", "USAR_TIPO_L1", None) else tipo_l4
            if tipo_l4_ref not in _LF_D2:
                tipo_l4_ref = "OUTROS"
            LF_d2 = _LF_D2[tipo_l4_ref]
            LO_d2 = _LO_D2[tipo_l4_ref]

            usar_relacoes_l4 = bool(getattr(z, "l4_usar_relacoes_valor", False))
            if usar_relacoes_l4:
                fator_d1 = ca / ct_global
                fator_d2 = (ca + cb + cc + cs) / ct_global
                fator_d3 = cs / ct_global
            else:
                # Quando se usa o RT4 representativo, a nota da Tabela D.1 substitui
                # ca/ct, (ca+cb+cc+cs)/ct e cs/ct por 1.
                # D1 em L4 só é aplicável quando há animais com valor econômico.
                fator_d1 = 1.0 if ca > 0 else 0.0
                fator_d2 = 1.0
                fator_d3 = 1.0

            # Tab. D.1: LA4/LU4, LB4/LV4 e LC4/LM4/LW4/LZ4
            LA4 = z.rt * LT * fator_d1
            LB4 = z.rp * z.rf * LF_d2 * fator_d2
            LC4 = LO_d2 * fator_d3

            RA4 = ND * PA_z * LA4
            RB4 = ND * PB_z * LB4
            RC4 = ND * PC * LC4
            RM4 = NM * PM * LC4

            RU4=0.0; RV4=0.0; RW4=0.0; RZ4=0.0
            for idx_l, linha in enumerate(req.linhas):
                cld = L_cld[linha.id]
                cli = L_cli[linha.id]
                ptu = _PTU.get(getattr(z, "ptu", None) or linha.ptu, 1.0)
                peb = _PEB.get(getattr(z, "peb", None) or linha.peb, 1.0)

                nl_pld = L_nl_pld[linha.id]
                ni_pli = L_ni_pli[linha.id]
                ndj_pld = L_ndj_pld[linha.id]

                # PU/PV/PW/PZ mantêm PLD/PLI e CLD/CLI conforme Anexo B.
                s3_evento_l4 = nl_pld + ndj_pld

                ru4_l = ptu * peb * cld * s3_evento_l4 * LA4
                rv4_l = peb * cld * s3_evento_l4 * LB4
                rw4_l = PSPD * cld * s3_evento_l4 * LC4
                rz4_l = PSPD * cli * ni_pli * LC4

                RU4 += ru4_l
                RV4 += rv4_l
                RW4 += rw4_l
                RZ4 += rz4_l

                if idx_l < len(linhas_contrib):
                    linhas_contrib[idx_l].RU4 = ru4_l
                    linhas_contrib[idx_l].RV4 = rv4_l
                    linhas_contrib[idx_l].RW4 = rw4_l
                    linhas_contrib[idx_l].RZ4 = rz4_l

            R4 = RA4 + RB4 + RC4 + RM4 + RU4 + RV4 + RW4 + RZ4

        zonas_out.append(ZonaCalcOut(
            id=z.id,nome=z.nome,linhas_contrib=linhas_contrib,
            RA=RA,RB=RB,RC=RC,RM=RM,RU=RU,RV=RV,RW=RW,RZ=RZ,R1=R1,
            R3=R3,RB3=RB3 if z.tem_l3 else 0.0,RV3=RV3 if z.tem_l3 else 0.0,
            F=F,
            FB=FB if z.habilitar_f else 0.0,
            FC=FC if z.habilitar_f else 0.0,
            FM=FM if z.habilitar_f else 0.0,
            FV=FV if z.habilitar_f else 0.0,
            FW=FW if z.habilitar_f else 0.0,
            FZ=FZ if z.habilitar_f else 0.0,
            R4=R4,
            RA4=RA4 if z.habilitar_l4 else 0.0,
            RB4=RB4 if z.habilitar_l4 else 0.0,
            RC4=RC4 if z.habilitar_l4 else 0.0,
            RM4=RM4 if z.habilitar_l4 else 0.0,
            RU4=RU4 if z.habilitar_l4 else 0.0,
            RV4=RV4 if z.habilitar_l4 else 0.0,
            RW4=RW4 if z.habilitar_l4 else 0.0,
            RZ4=RZ4 if z.habilitar_l4 else 0.0,
            LA=LA,LB=LB,LC=LC,
            PC_calc=PC,
            PM_calc=PM,
            PMS_calc=PMS,
            KS1_calc=KS1,
            KS2_calc=KS2,
            KS4_calc=KS4,
        ))

    R1g=sum(z.R1 for z in zonas_out); R3g=sum(z.R3 for z in zonas_out)
    Fg=sum(z.F for z in zonas_out); R4g=sum(z.R4 for z in zonas_out)

    # FT deve vir da zona/sistema/equipamento avaliado. Para o painel global,
    # usa-se o FT mais restritivo apenas como referência; a conformidade de F
    # é verificada por zona, comparando cada F_zona com o seu ft_sistema.
    zonas_habilitadas_f = [z for z in req.zonas if getattr(z, "habilitar_f", False)]
    ft_global = min((float(getattr(z, "ft_sistema", 0.1) or 0.1) for z in zonas_habilitadas_f), default=0.1)
    zonas_fora_ft = []
    for zin, zout in zip(req.zonas, zonas_out):
        if getattr(zin, "habilitar_f", False):
            ft_z = float(getattr(zin, "ft_sistema", 0.1) or 0.1)
            if zout.F > ft_z:
                zonas_fora_ft.append(f"{zout.nome}: F={zout.F:.3e} > FT={ft_z:.3e}")
    f_atende = len(zonas_fora_ft) == 0
    conforme_norma = (R1g <= 1e-5) and (R3g <= 1e-4 or R3g == 0) and f_atende

    return CalcResponse(
        AD=AD,AM=AM,AL=sum(l.AL_total for l in linhas_out),AI=sum(l.AI_total for l in linhas_out),ND=ND,NM=NM,linhas=linhas_out,zonas=zonas_out,
        R1_global=R1g,R3_global=R3g,F_global=Fg,R4_global=R4g,FT_global=ft_global,F_atende=f_atende,conforme_norma=conforme_norma,zonas_fora_ft=zonas_fora_ft,
        RA_g=sum(z.RA for z in zonas_out),RB_g=sum(z.RB for z in zonas_out),
        RC_g=sum(z.RC for z in zonas_out),RM_g=sum(z.RM for z in zonas_out),
        RU_g=sum(z.RU for z in zonas_out),RV_g=sum(z.RV for z in zonas_out),
        RW_g=sum(z.RW for z in zonas_out),RZ_g=sum(z.RZ for z in zonas_out),
    )