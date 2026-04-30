"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Badge } from "@/components/ui";
import { Users, Plus, Trash2, Search, Building, User, Loader2, X, Phone, Mail, MapPin } from "lucide-react";
import { listarClientes, criarCliente, deletarCliente, isAuthenticated, type Cliente } from "@/lib/api";
import { validarCPF, validarCNPJ, validarEmail, validarTelefone, formatarCPF, formatarCNPJ, formatarTelefone, formatarCEP, buscarCEP, buscarCNPJBrasilAPI } from "@/lib/validacoes";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const selectCls = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus-visible:outline-none";

const VAZIO = {
  tipo_pessoa: "PJ" as "PF"|"PJ", cpf_cnpj: "",
  razao_social: "", nome_fantasia: "", responsavel: "",
  contato_email: "", contato_telefone: "",
  cep: "", logradouro: "", numero: "", complemento: "",
  bairro: "", cidade: "", uf_cliente: "",
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busca, setBusca]       = useState("");
  const [error, setError]       = useState<string|null>(null);

  useEffect(() => {
    if (!isAuthenticated()) { setLoading(false); return; }
    listarClientes()
      .then(setClientes)
      .catch(() => setError("Erro ao carregar clientes"))
      .finally(() => setLoading(false));
  }, []);

  async function handleDeletar(id: string, nome: string) {
    if (!confirm(`Excluir "${nome}"?`)) return;
    try { await deletarCliente(id); setClientes(c => c.filter(x => x.id !== id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Erro ao excluir"); }
  }

  const filtrados = clientes.filter(c =>
    (c.razao_social||"").toLowerCase().includes(busca.toLowerCase()) ||
    ((c as any).contato_email||"").toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge variant={"outline" as any} className="mb-2 gap-1"><Users className="w-3 h-3" /> Clientes</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cadastro de Clientes</h1>
          <p className="text-sm text-foreground-muted mt-1">PF ou PJ com busca automática de CEP e CNPJ.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" /> Novo cliente
        </Button>
      </div>

      {showForm && (
        <ClienteForm
          onSuccess={(c) => { setClientes(prev => [c, ...prev]); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
        <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail..." className="pl-9" />
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-foreground-muted" /></div>
      ) : filtrados.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-foreground-muted">
          {clientes.length === 0 ? "Nenhum cliente. Clique em Novo cliente." : "Nenhum resultado."}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtrados.map(c => (
            <Card key={c.id} className="card-glass">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {(c as any).tipo_pessoa==="PF" ? <User className="w-4 h-4 text-primary"/> : <Building className="w-4 h-4 text-primary"/>}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{(c as any).nome_fantasia||c.razao_social}</div>
                      {(c as any).nome_fantasia && <div className="text-xs text-foreground-muted truncate">{c.razao_social}</div>}
                      {(c.cnpj||(c as any).cpf_cnpj) && <div className="text-xs text-foreground-muted">{c.cnpj||(c as any).cpf_cnpj}</div>}
                      <div className="text-xs text-foreground-muted space-y-0.5 mt-1">
                        {(c as any).contato_email&&<div className="flex items-center gap-1"><Mail className="w-3 h-3"/>{(c as any).contato_email}</div>}
                        {(c as any).contato_telefone&&<div className="flex items-center gap-1"><Phone className="w-3 h-3"/>{(c as any).contato_telefone}</div>}
                        {((c as any).cidade||(c as any).uf_cliente)&&<div className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{[(c as any).cidade,(c as any).uf_cliente].filter(Boolean).join(" – ")}</div>}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleDeletar(c.id, c.razao_social)}
                    className="p-1.5 rounded hover:bg-red-50 hover:text-red-600 text-foreground-muted transition-colors shrink-0">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ClienteForm({ onSuccess, onCancel }: { onSuccess: (c: Cliente) => void; onCancel: () => void }) {
  const [form, setForm]         = useState({...VAZIO});
  const [saving, setSaving]     = useState(false);
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);
  const [cnpjMsg, setCnpjMsg]   = useState("");
  const [cepMsg, setCepMsg]     = useState("");
  const [error, setError]       = useState<string|null>(null);
  const [erros, setErros]       = useState<Record<string,string>>({});

  function setF(k: string, v: string) { setForm(f=>({...f,[k]:v})); setErros(e=>{const n={...e};delete n[k];return n;}); }

  async function handleCEP(val: string) {
    const fmt = formatarCEP(val);
    setF("cep", fmt);
    const d = fmt.replace(/\D/g,"");
    if (d.length !== 8) return;
    setBuscandoCEP(true); setCepMsg("Buscando...");
    const dados = await buscarCEP(fmt);
    setBuscandoCEP(false);
    if (dados) {
      setForm(f => ({...f, logradouro: dados.logradouro||f.logradouro, bairro: dados.bairro||f.bairro, cidade: dados.localidade||f.cidade, uf_cliente: dados.uf||f.uf_cliente}));
      setCepMsg("CEP encontrado!");
    } else { setCepMsg("CEP não encontrado."); }
  }

  async function handleCNPJ() {
    if (!validarCNPJ(form.cpf_cnpj)) { setErros(e=>({...e,cpf_cnpj:"CNPJ inválido"})); return; }
    setBuscandoCNPJ(true); setCnpjMsg("Buscando...");
    const dados = await buscarCNPJBrasilAPI(form.cpf_cnpj);
    setBuscandoCNPJ(false);
    if (dados) {
      setForm(f => ({
        ...f,
        razao_social: dados.razao_social||f.razao_social,
        nome_fantasia: dados.nome_fantasia||f.nome_fantasia,
        responsavel: dados.razao_social ? (dados.nome_fantasia || dados.razao_social) : f.responsavel,
        contato_email: dados.email||f.contato_email,
        contato_telefone: dados.telefone ? formatarTelefone(dados.telefone) : f.contato_telefone,
        logradouro: [dados.logradouro,dados.numero].filter(Boolean).join(", ")||f.logradouro,
        bairro: dados.bairro||f.bairro, cidade: dados.municipio||f.cidade,
        uf_cliente: dados.uf||f.uf_cliente,
        cep: dados.cep ? formatarCEP(dados.cep) : f.cep,
      }));
      setCnpjMsg(`${dados.situacao_cadastral||"Dados preenchidos."}`);
    } else { setCnpjMsg("CNPJ não encontrado."); }
  }

  function validar() {
    const e: Record<string,string> = {};
    if (!form.razao_social.trim()) e.razao_social = "Nome/Razão Social obrigatório";
    // CPF/CNPJ obrigatório
    if (!form.cpf_cnpj.trim()) {
      e.cpf_cnpj = `${form.tipo_pessoa === "PF" ? "CPF" : "CNPJ"} obrigatório`;
    } else {
      if (form.tipo_pessoa==="PF" && !validarCPF(form.cpf_cnpj)) e.cpf_cnpj = "CPF inválido";
      if (form.tipo_pessoa==="PJ" && !validarCNPJ(form.cpf_cnpj)) e.cpf_cnpj = "CNPJ inválido";
    }
    // Email obrigatório
    if (!form.contato_email.trim()) e.contato_email = "E-mail obrigatório";
    else if (!validarEmail(form.contato_email)) e.contato_email = "E-mail inválido";
    // Telefone obrigatório
    if (!form.contato_telefone.trim()) e.contato_telefone = "Telefone obrigatório";
    else if (!validarTelefone(form.contato_telefone)) e.contato_telefone = "Telefone inválido";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validar()) return;
    setSaving(true); setError(null);
    try {
      const endereco = [form.logradouro, form.numero, form.complemento, form.bairro, form.cidade, form.uf_cliente].filter(Boolean).join(", ");
      const c = await criarCliente({
        razao_social: form.razao_social,
        cnpj: form.tipo_pessoa==="PJ" ? form.cpf_cnpj||undefined : undefined,
        tipo_pessoa: form.tipo_pessoa,
        cpf_cnpj: form.cpf_cnpj || undefined,
        nome_fantasia: form.nome_fantasia || undefined,
        responsavel: form.responsavel || undefined,
        contato_nome: form.responsavel||undefined,
        email: form.contato_email || undefined,
        telefone: form.contato_telefone || undefined,
        contato_email: form.contato_email||undefined,
        contato_telefone: form.contato_telefone||undefined,
        endereco: endereco || undefined,
        cidade: form.cidade || undefined,
        uf_cliente: form.uf_cliente || undefined,
        cep: form.cep || undefined,
      });
      onSuccess(c);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSaving(false); }
  }

  const isPJ = form.tipo_pessoa === "PJ";

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Novo cliente</CardTitle>
          <button type="button" onClick={onCancel}><X className="w-4 h-4 text-foreground-muted"/></button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo */}
          <div className="flex gap-2">
            {(["PJ","PF"] as ("PJ"|"PF")[]).map(t => (
              <button key={t} type="button" onClick={() => { setF("tipo_pessoa",t); setF("cpf_cnpj",""); setCnpjMsg(""); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${form.tipo_pessoa===t?"border-primary bg-primary/10 text-primary":"border-border text-foreground-muted"}`}>
                {t==="PJ"?<Building className="w-3 h-3"/>:<User className="w-3 h-3"/>}
                {t==="PJ"?"Empresa (PJ)":"Pessoa Física (PF)"}
              </button>
            ))}
          </div>

          {/* CPF / CNPJ */}
          <div>
            <Label className="text-xs">{isPJ?"CNPJ":"CPF"}</Label>
            <div className="flex gap-2 mt-1">
              <Input value={form.cpf_cnpj}
                onChange={e => setF("cpf_cnpj", isPJ ? formatarCNPJ(e.target.value) : formatarCPF(e.target.value))}
                placeholder={isPJ?"00.000.000/0000-00":"000.000.000-00"}
                maxLength={isPJ?18:14} inputMode="numeric" className="flex-1" disabled={saving} />
              {isPJ && (
                <Button type="button" variant="outline" size="sm" onClick={handleCNPJ}
                  disabled={buscandoCNPJ||form.cpf_cnpj.replace(/\D/g,"").length!==14}>
                  {buscandoCNPJ?<Loader2 className="w-3.5 h-3.5 animate-spin"/>:<Search className="w-3.5 h-3.5"/>}
                </Button>
              )}
            </div>
            {erros.cpf_cnpj&&<p className="text-xs text-red-500 mt-1">{erros.cpf_cnpj}</p>}
            {cnpjMsg&&<p className={`text-xs mt-1 ${cnpjMsg.includes("não")||cnpjMsg.includes("inválido")?"text-amber-600":"text-green-600"}`}>{cnpjMsg}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label className="text-xs">{isPJ?"Razão social *":"Nome completo *"}</Label>
              <Input value={form.razao_social} onChange={e=>setF("razao_social",e.target.value)} className="mt-1" disabled={saving}/>
              {erros.razao_social&&<p className="text-xs text-red-500 mt-1">{erros.razao_social}</p>}</div>
            {isPJ&&<div><Label className="text-xs">Nome fantasia</Label>
              <Input value={form.nome_fantasia} onChange={e=>setF("nome_fantasia",e.target.value)} className="mt-1" disabled={saving}/></div>}
            <div><Label className="text-xs">Responsável / Contato</Label>
              <Input value={form.responsavel} onChange={e=>setF("responsavel",e.target.value)} className="mt-1" disabled={saving}/></div>
            <div><Label className="text-xs">E-mail</Label>
              <Input type="email" value={form.contato_email} onChange={e=>setF("contato_email",e.target.value)} className="mt-1" disabled={saving}/>
              {erros.contato_email&&<p className="text-xs text-red-500 mt-1">{erros.contato_email}</p>}</div>
            <div><Label className="text-xs">Telefone</Label>
              <Input value={form.contato_telefone} onChange={e=>setF("contato_telefone",formatarTelefone(e.target.value))} maxLength={15} inputMode="tel" className="mt-1" disabled={saving}/>
              {erros.contato_telefone&&<p className="text-xs text-red-500 mt-1">{erros.contato_telefone}</p>}</div>
          </div>

          {/* Endereço */}
          <div className="border-t border-border pt-3 space-y-3">
            <p className="text-xs font-medium text-foreground-muted">Endereço</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label className="text-xs">CEP</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={form.cep} onChange={e=>handleCEP(e.target.value)} maxLength={9} inputMode="numeric" className="flex-1" disabled={saving}/>
                  {buscandoCEP&&<Loader2 className="w-4 h-4 animate-spin self-center text-foreground-muted"/>}
                </div>
                {cepMsg&&<p className={`text-[10px] mt-1 ${cepMsg.includes("não")?"text-amber-600":"text-green-600"}`}>{cepMsg}</p>}
              </div>
              <div className="sm:col-span-2"><Label className="text-xs">Logradouro</Label>
                <Input value={form.logradouro} onChange={e=>setF("logradouro",e.target.value)} className="mt-1" disabled={saving}/></div>
              <div><Label className="text-xs">Número</Label>
                <Input value={form.numero} onChange={e=>setF("numero",e.target.value)} className="mt-1" disabled={saving}/></div>
              <div><Label className="text-xs">Complemento</Label>
                <Input value={form.complemento} onChange={e=>setF("complemento",e.target.value)} className="mt-1" disabled={saving}/></div>
              <div><Label className="text-xs">Bairro</Label>
                <Input value={form.bairro} onChange={e=>setF("bairro",e.target.value)} className="mt-1" disabled={saving}/></div>
              <div><Label className="text-xs">Cidade</Label>
                <Input value={form.cidade} onChange={e=>setF("cidade",e.target.value)} className="mt-1" disabled={saving}/></div>
              <div><Label className="text-xs">UF</Label>
                <select value={form.uf_cliente} onChange={e=>setF("uf_cliente",e.target.value)} className={selectCls+" mt-1"} disabled={saving}>
                  <option value="">UF</option>{UFS.map(u=><option key={u}>{u}</option>)}</select></div>
            </div>
          </div>

          {error&&<div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving?<><Loader2 className="w-3 h-3 animate-spin mr-1"/>Salvando...</>:"Salvar cliente"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
