"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Input, Label, Badge } from "@/components/ui";
import { Zap, User, Building2, ShieldCheck, CreditCard, Bell, ChevronRight, ChevronLeft, Loader2, CheckCircle2, Eye, EyeOff, Search } from "lucide-react";
import { validarCPF, validarCNPJ, validarEmail, validarTelefone, formatarCPF, formatarCNPJ, formatarTelefone, formatarCEP, buscarCEP, buscarCNPJBrasilAPI } from "@/lib/validacoes";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const ESPECIALIDADES = ["Civil","Elétrica","Mecânica","Estrutural","Ambiental","Outro"];
const PLANOS = [
  { id:"mensal", nome:"Mensal", preco:"R$ 129/mês", desc:"Cancele quando quiser", destaque:false },
  { id:"anual",  nome:"Anual",  preco:"R$ 99/mês", desc:"Cobrança anual — economize 23%", destaque:true },
];

const VAZIO = {
  // Pessoal
  nome:"", email:"", senha:"", senha_confirma:"", telefone:"",
  // Profissional
  tipo_registro:"CREA", numero_registro:"", uf_profissional:"",
  especialidade:"", cargo:"", empresa:"",
  // Fiscal
  tipo_pessoa:"PJ" as "PF"|"PJ", cpf_cnpj:"", razao_social:"",
  inscricao_estadual:"",
  cep:"", logradouro:"", numero:"", complemento:"", bairro:"", cidade:"", uf_end:"",
  // Plano
  plano:"anual",
  // Conformidade
  aceite_termos:false, aceite_privacidade:false, notificacoes:true,
};

const PASSOS = [
  { id:1, label:"Identificação", icon:User },
  { id:2, label:"Profissional", icon:ShieldCheck },
  { id:3, label:"Fiscal", icon:Building2 },
  { id:4, label:"Plano", icon:CreditCard },
  { id:5, label:"Confirmação", icon:Bell },
];

const selectCls = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default function CadastroPage() {
  const router = useRouter();
  const [passo, setPasso] = useState(1);
  const [form, setForm] = useState({...VAZIO});
  const [erros, setErros] = useState<Record<string,string>>({});
  const [showSenha, setShowSenha] = useState(false);
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);
  const [cnpjMsg, setCnpjMsg] = useState("");
  const [cepMsg, setCepMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [erroGeral, setErroGeral] = useState("");

  function setF(k: string, v: string | boolean) {
    setForm(f => ({...f, [k]: v}));
    setErros(e => { const n={...e}; delete n[k]; return n; });
  }

  async function handleCEP(val: string) {
    const fmt = formatarCEP(val);
    setF("cep", fmt);
    if (fmt.replace(/\D/g,"").length !== 8) { setCepMsg(""); return; }
    setBuscandoCEP(true); setCepMsg("Buscando...");
    const d = await buscarCEP(fmt);
    setBuscandoCEP(false);
    if (d) {
      setForm(f => ({...f, logradouro:d.logradouro||f.logradouro, bairro:d.bairro||f.bairro, cidade:d.localidade||f.cidade, uf_end:d.uf||f.uf_end}));
      setCepMsg("✓ CEP encontrado");
    } else setCepMsg("CEP não encontrado");
  }

  async function handleCNPJ(val: string) {
    const fmt = formatarCNPJ(val);
    setF("cpf_cnpj", fmt);
    if (fmt.replace(/\D/g,"").length !== 14) { setCnpjMsg(""); return; }
    setBuscandoCNPJ(true); setCnpjMsg("Buscando...");
    const d = await buscarCNPJBrasilAPI(fmt);
    setBuscandoCNPJ(false);
    if (d) {
      setForm(f => ({...f,
        razao_social: d.razao_social||f.razao_social,
        logradouro: d.logradouro||f.logradouro,
        bairro: d.bairro||f.bairro,
        cidade: d.municipio||f.cidade,
        uf_end: d.uf||f.uf_end,
        cep: d.cep ? formatarCEP(d.cep) : f.cep,
        telefone: d.telefone ? formatarTelefone(d.telefone) : f.telefone,
        email: d.email||f.email,
      }));
      setCnpjMsg(`✓ ${d.situacao_cadastral||"Dados preenchidos"}`);
    } else setCnpjMsg("CNPJ não encontrado");
  }

  const senhaForte = (s: string) => ({
    len: s.length >= 8,
    upper: /[A-Z]/.test(s),
    number: /\d/.test(s),
    special: /[^a-zA-Z0-9]/.test(s),
  });
  const sf = senhaForte(form.senha);
  const forcaOk = sf.len && sf.upper && sf.number;

  function validarPasso(p: number) {
    const e: Record<string,string> = {};
    if (p === 1) {
      if (!form.nome.trim()) e.nome = "Obrigatório";
      if (!validarEmail(form.email)) e.email = "E-mail inválido";
      if (!forcaOk) e.senha = "Senha fraca: mínimo 8 caracteres, 1 maiúscula, 1 número";
      if (form.senha !== form.senha_confirma) e.senha_confirma = "As senhas não conferem";
      if (form.telefone && !validarTelefone(form.telefone)) e.telefone = "Telefone inválido";
    }
    if (p === 2) {
      if (!form.numero_registro) e.numero_registro = "Obrigatório";
      if (!form.uf_profissional) e.uf_profissional = "Selecione a UF";
    }
    if (p === 3) {
      if (form.tipo_pessoa === "PF" && form.cpf_cnpj && !validarCPF(form.cpf_cnpj)) e.cpf_cnpj = "CPF inválido";
      if (form.tipo_pessoa === "PJ" && form.cpf_cnpj && !validarCNPJ(form.cpf_cnpj)) e.cpf_cnpj = "CNPJ inválido";
    }
    if (p === 5) {
      if (!form.aceite_termos) e.aceite_termos = "Obrigatório";
      if (!form.aceite_privacidade) e.aceite_privacidade = "Obrigatório";
    }
    setErros(e);
    return Object.keys(e).length === 0;
  }

  function avancar() {
    if (validarPasso(passo)) setPasso(p => Math.min(p+1, 5));
  }

  async function handleSubmit() {
    if (!validarPasso(5)) return;
    setLoading(true); setErroGeral("");
    try {
      // TODO: call API to register (admin approval flow)
      await new Promise(r => setTimeout(r, 1500)); // simula chamada
      setConcluido(true);
    } catch (e) {
      setErroGeral(e instanceof Error ? e.message : "Erro ao enviar cadastro");
    } finally { setLoading(false); }
  }

  if (concluido) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-8 pb-6 space-y-4">
          <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold">Solicitação enviada!</h2>
          <p className="text-sm text-foreground-muted">
            Seu cadastro foi recebido e será analisado pelo administrador. Você receberá as credenciais de acesso por e-mail em até 24h.
          </p>
          <Button asChild className="w-full"><Link href="/login">Ir para o login</Link></Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-start justify-center py-8 px-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-lg leading-none">PDA NBR 5419</div>
            <div className="text-xs text-foreground-muted">Solicitar cadastro</div>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-1">
          {PASSOS.map((p, i) => (
            <div key={p.id} className="flex items-center gap-1 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                passo > p.id ? "bg-green-500 text-white" :
                passo === p.id ? "bg-primary text-white" :
                "bg-background-secondary text-foreground-muted border border-border"
              }`}>
                {passo > p.id ? "✓" : p.id}
              </div>
              <span className={`text-[10px] hidden sm:block ${passo === p.id ? "text-primary font-medium" : "text-foreground-muted"}`}>
                {p.label}
              </span>
              {i < PASSOS.length - 1 && <div className={`flex-1 h-px mx-1 ${passo > p.id ? "bg-green-400" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <Card>
          {/* ── PASSO 1: Identificação ─────────────────────────────── */}
          {passo === 1 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="w-4 h-4 text-primary" /> Identificação pessoal</CardTitle>
                <CardDescription>Seus dados de acesso ao sistema.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Nome completo *</Label><Input value={form.nome} onChange={e=>setF("nome",e.target.value)} placeholder="Como aparecerá no laudo" className="mt-1"/>{erros.nome&&<p className="text-xs text-red-500 mt-1">{erros.nome}</p>}</div>
                <div><Label>E-mail profissional *</Label><Input type="email" value={form.email} onChange={e=>setF("email",e.target.value)} placeholder="seu@email.com" className="mt-1"/>{erros.email&&<p className="text-xs text-red-500 mt-1">{erros.email}</p>}</div>
                <div>
                  <Label>Senha *</Label>
                  <div className="relative mt-1">
                    <Input type={showSenha?"text":"password"} value={form.senha} onChange={e=>setF("senha",e.target.value)} placeholder="Mínimo 8 caracteres" className="pr-10"/>
                    <button type="button" onClick={()=>setShowSenha(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted">{showSenha?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button>
                  </div>
                  {form.senha && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {[["len","8+ chars"],["upper","Maiúscula"],["number","Número"],["special","Especial"]].map(([k,l])=>(
                        <span key={k} className={`text-[10px] px-1.5 py-0.5 rounded ${sf[k as keyof typeof sf]?"bg-green-100 text-green-700":"bg-background-secondary text-foreground-muted"}`}>{l}</span>
                      ))}
                    </div>
                  )}
                  {erros.senha&&<p className="text-xs text-red-500 mt-1">{erros.senha}</p>}
                </div>
                <div><Label>Confirme a senha *</Label><Input type="password" value={form.senha_confirma} onChange={e=>setF("senha_confirma",e.target.value)} className="mt-1"/>{erros.senha_confirma&&<p className="text-xs text-red-500 mt-1">{erros.senha_confirma}</p>}</div>
                <div><Label>Telefone / WhatsApp</Label><Input value={form.telefone} onChange={e=>setF("telefone",formatarTelefone(e.target.value))} placeholder="(11) 99999-9999" maxLength={15} inputMode="tel" className="mt-1"/>{erros.telefone&&<p className="text-xs text-red-500 mt-1">{erros.telefone}</p>}</div>
              </CardContent>
            </>
          )}

          {/* ── PASSO 2: Profissional ──────────────────────────────── */}
          {passo === 2 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Dados profissionais</CardTitle>
                <CardDescription>Registro profissional para assinatura de laudos técnicos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>Tipo de registro *</Label>
                    <select value={form.tipo_registro} onChange={e=>setF("tipo_registro",e.target.value)} className={selectCls+" mt-1"}>
                      {["CREA","CFT","CRT","outro"].map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Número do registro *</Label>
                    <Input value={form.numero_registro} onChange={e=>setF("numero_registro",e.target.value)} placeholder="Ex: 5062345678" className="mt-1"/>
                    {erros.numero_registro&&<p className="text-xs text-red-500 mt-1">{erros.numero_registro}</p>}
                  </div>
                  <div>
                    <Label>UF do conselho *</Label>
                    <select value={form.uf_profissional} onChange={e=>setF("uf_profissional",e.target.value)} className={selectCls+" mt-1"}>
                      <option value="">Selecione...</option>{UFS.map(u=><option key={u}>{u}</option>)}
                    </select>
                    {erros.uf_profissional&&<p className="text-xs text-red-500 mt-1">{erros.uf_profissional}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Especialidade</Label>
                    <select value={form.especialidade} onChange={e=>setF("especialidade",e.target.value)} className={selectCls+" mt-1"}>
                      <option value="">Selecione...</option>{ESPECIALIDADES.map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><Label>Cargo / Função</Label><Input value={form.cargo} onChange={e=>setF("cargo",e.target.value)} placeholder="Ex: Engenheiro Sênior" className="mt-1"/></div>
                </div>
                <div><Label>Nome da empresa / Escritório</Label><Input value={form.empresa} onChange={e=>setF("empresa",e.target.value)} placeholder="Empresa onde atua" className="mt-1"/></div>
              </CardContent>
            </>
          )}

          {/* ── PASSO 3: Fiscal ───────────────────────────────────── */}
          {passo === 3 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Dados fiscais e endereço</CardTitle>
                <CardDescription>Para emissão de notas fiscais e faturamento.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  {(["PJ","PF"] as ("PJ"|"PF")[]).map(t=>(
                    <button key={t} type="button" onClick={()=>{setF("tipo_pessoa",t);setF("cpf_cnpj","");setCnpjMsg("");}}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${form.tipo_pessoa===t?"border-primary bg-primary/10 text-primary":"border-border text-foreground-muted"}`}>
                      {t==="PJ"?"🏢 Pessoa Jurídica":"👤 Pessoa Física"}
                    </button>
                  ))}
                </div>

                <div>
                  <Label>{form.tipo_pessoa==="PJ"?"CNPJ":"CPF"}</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={form.cpf_cnpj}
                      onChange={e=>form.tipo_pessoa==="PJ"?handleCNPJ(e.target.value):setF("cpf_cnpj",formatarCPF(e.target.value))}
                      placeholder={form.tipo_pessoa==="PJ"?"00.000.000/0000-00":"000.000.000-00"}
                      maxLength={form.tipo_pessoa==="PJ"?18:14} inputMode="numeric" className="flex-1"/>
                    {form.tipo_pessoa==="PJ"&&buscandoCNPJ&&<Loader2 className="w-4 h-4 animate-spin self-center text-foreground-muted"/>}
                  </div>
                  {erros.cpf_cnpj&&<p className="text-xs text-red-500 mt-1">{erros.cpf_cnpj}</p>}
                  {cnpjMsg&&<p className={`text-xs mt-1 ${cnpjMsg.startsWith("✓")?"text-green-600":"text-amber-600"}`}>{cnpjMsg}</p>}
                </div>

                {form.tipo_pessoa==="PJ"&&(
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label>Razão Social</Label><Input value={form.razao_social} onChange={e=>setF("razao_social",e.target.value)} className="mt-1"/></div>
                    <div><Label>Inscrição Estadual</Label><Input value={form.inscricao_estadual} onChange={e=>setF("inscricao_estadual",e.target.value)} placeholder="Isento ou número" className="mt-1"/></div>
                  </div>
                )}

                <div className="border-t border-border pt-3 space-y-3">
                  <p className="text-xs font-medium text-foreground-muted">Endereço de cobrança</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label>CEP</Label>
                      <div className="flex gap-2 mt-1">
                        <Input value={form.cep} onChange={e=>handleCEP(e.target.value)} maxLength={9} inputMode="numeric" className="flex-1"/>
                        {buscandoCEP&&<Loader2 className="w-4 h-4 animate-spin self-center text-foreground-muted"/>}
                      </div>
                      {cepMsg&&<p className={`text-[10px] mt-1 ${cepMsg.startsWith("✓")?"text-green-600":"text-amber-600"}`}>{cepMsg}</p>}
                    </div>
                    <div className="sm:col-span-2"><Label>Logradouro</Label><Input value={form.logradouro} onChange={e=>setF("logradouro",e.target.value)} className="mt-1"/></div>
                    <div><Label>Número</Label><Input value={form.numero} onChange={e=>setF("numero",e.target.value)} className="mt-1"/></div>
                    <div><Label>Complemento</Label><Input value={form.complemento} onChange={e=>setF("complemento",e.target.value)} className="mt-1"/></div>
                    <div><Label>Bairro</Label><Input value={form.bairro} onChange={e=>setF("bairro",e.target.value)} className="mt-1"/></div>
                    <div><Label>Cidade</Label><Input value={form.cidade} onChange={e=>setF("cidade",e.target.value)} className="mt-1"/></div>
                    <div>
                      <Label>UF</Label>
                      <select value={form.uf_end} onChange={e=>setF("uf_end",e.target.value)} className={selectCls+" mt-1"}>
                        <option value="">UF</option>{UFS.map(u=><option key={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {/* ── PASSO 4: Plano ────────────────────────────────────── */}
          {passo === 4 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" /> Plano de assinatura</CardTitle>
                <CardDescription>Escolha o plano que melhor se adapta à sua necessidade.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {PLANOS.map(p => (
                    <button key={p.id} type="button" onClick={()=>setF("plano",p.id)}
                      className={`p-4 rounded-xl border-2 text-left transition-all relative ${
                        form.plano===p.id?"border-primary bg-primary/5":"border-border hover:border-border-secondary"
                      }`}>
                      {p.destaque&&<span className="absolute -top-2.5 right-3 bg-primary text-white text-[10px] px-2 py-0.5 rounded-full">Mais popular</span>}
                      <div className="font-bold">{p.nome}</div>
                      <div className="text-2xl font-bold text-primary mt-1">{p.preco}</div>
                      <div className="text-xs text-foreground-muted mt-1">{p.desc}</div>
                    </button>
                  ))}
                </div>
                <div className="p-3 rounded-lg bg-background-secondary text-xs text-foreground-muted space-y-1">
                  <p className="font-medium text-foreground">Incluso em todos os planos:</p>
                  {["Análise de risco R1, R3 e R4 conforme NBR 5419:2026","5.524 municípios do Anexo F","Laudo técnico em PDF com logo","Checklist de inspeção normativo","Suporte por e-mail"].map(i=>(
                    <p key={i} className="flex items-start gap-1.5"><span className="text-green-500 shrink-0">✓</span>{i}</p>
                  ))}
                </div>
                <div className="p-3 rounded-lg border border-border text-xs space-y-2">
                  <p className="font-medium">Forma de pagamento</p>
                  <p className="text-foreground-muted">Após aprovação do cadastro pelo administrador, você receberá um link seguro para inserir os dados de pagamento. Aceitamos cartão de crédito, boleto e PIX.</p>
                </div>
              </CardContent>
            </>
          )}

          {/* ── PASSO 5: Confirmação ──────────────────────────────── */}
          {passo === 5 && (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="w-4 h-4 text-primary" /> Confirmação e aceites</CardTitle>
                <CardDescription>Revise os dados e confirme sua solicitação de cadastro.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Resumo */}
                <div className="p-3 rounded-lg bg-background-secondary text-xs space-y-1">
                  <p className="font-medium text-foreground mb-2">Resumo do cadastro:</p>
                  {[
                    ["Nome", form.nome], ["E-mail", form.email], ["Telefone", form.telefone||"—"],
                    ["Registro", `${form.tipo_registro}-${form.uf_profissional} nº ${form.numero_registro}`],
                    ["Empresa", form.empresa||"—"], ["Plano", form.plano==="anual"?"Anual (R$ 99/mês)":"Mensal (R$ 129/mês)"],
                  ].map(([l,v])=>(
                    <div key={l} className="flex justify-between gap-2">
                      <span className="text-foreground-muted">{l}:</span>
                      <span className="font-medium text-right truncate max-w-[60%]">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Aceites */}
                <div className="space-y-3">
                  {[
                    { key:"aceite_termos", label:"Li e aceito os Termos de Uso do PDA NBR 5419", required:true, link:"/termos" },
                    { key:"aceite_privacidade", label:"Li e aceito a Política de Privacidade", required:true },
                    { key:"notificacoes", label:"Desejo receber novidades técnicas e atualizações normativas por e-mail", required:false },
                  ].map(({ key, label, required, link }: {key:string;label:string;required:boolean;link?:string}) => (
                    <label key={key} className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg border transition-colors ${
                      form[key as keyof typeof form] ? "border-primary bg-primary/5" : "border-border hover:border-border-secondary"
                    }`}>
                      <input type="checkbox"
                        checked={Boolean(form[key as keyof typeof form])}
                        onChange={e=>setF(key,e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-primary shrink-0"/>
                      <span className="text-sm">
                        {label}
                        {link && <Link href={link} target="_blank" className="ml-1 text-primary hover:underline text-xs">(ler →)</Link>}
                        {required&&<span className="text-red-500 ml-0.5">*</span>}
                      </span>
                    </label>
                  ))}
                  {erros.aceite_termos&&<p className="text-xs text-red-500">{erros.aceite_termos}</p>}
                  {erros.aceite_privacidade&&<p className="text-xs text-red-500">{erros.aceite_privacidade}</p>}
                </div>

                {erroGeral&&<div className="p-3 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{erroGeral}</div>}
              </CardContent>
            </>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2">
            {passo > 1 && (
              <Button variant="outline" onClick={()=>setPasso(p=>p-1)}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
            )}
            <Button variant="ghost" asChild><Link href="/login">Já tenho acesso</Link></Button>
          </div>
          {passo < 5 ? (
            <Button onClick={avancar}>
              Continuar <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Enviando...</> : "Enviar solicitação"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
