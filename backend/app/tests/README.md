# Bateria de testes automatizados — NBR 5419:2026

Esta pasta contém testes de regressão para o motor de cálculo do backend.

## Como rodar

No diretório `backend`:

```bash
python -m pytest -q
```

Em ambientes onde plugins globais do pytest interferirem:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -q
```

## Escopo coberto

- Tabelas B.8/PLD e B.9/PLI, com consulta exata e rejeição de `UW` fora do domínio do cálculo completo.
- Tabelas principais da Parte 3 usadas pelo dimensionamento básico do SPDA: esfera rolante, malha, distância entre descidas, `ki`, `kc` e distância de segurança simplificada.
- Motor central `app.engine.calculo_completo.calcular_pda`:
  - áreas equivalentes `AD`, `AM`, `AL`, `AI`;
  - eventos `ND`, `NM`, `NL`, `NI`, `NDJ`;
  - perdas `LA`, `LB`, `LC`;
  - probabilidades `PC`, `PM`, `PMS`, `KS1`, `KS2`, `KS4`;
  - componentes `RA`, `RB`, `RC`, `RM`, `RU`, `RV`, `RW`, `RZ`;
  - composição de `R1` com e sem D3-L1;
  - frequência `F`, incluindo `FB`, `FC`, `FM`, `FV`, `FW`, `FZ`;
  - patrimônio cultural `R3`;
  - perdas econômicas `R4`, em modo representativo e por relações econômicas;
  - consolidação multizona.
- Adaptadores HTTP/legados:
  - `/calcular`;
  - `/analise-risco/wizard`;
  - `/analise-risco/calcular-multi-zona`.

Sempre que uma regra normativa for alterada no motor, estes testes devem ser atualizados somente após conferir a alteração diretamente nos PDFs carregados da ABNT NBR 5419:2026.
