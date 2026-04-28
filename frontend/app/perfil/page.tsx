"use client";
import { useState, useEffect, useRef, ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Input, Label, Badge } from "@/components/ui";
import { User, Building2, ShieldCheck, KeyRound, Upload, X, Save, Loader2, CheckCircle2, Mail, Clock, Shield, Search, MapPin } from "lucide-react";
import { atualizarPerfil, trocarSenha, getCurrentUser, type UsuarioInfo } from "@/lib/api";
import { formatarCPF, validarCPF, formatarTelefone, validarTelefone, formatarCEP, buscarCEP, buscarCNPJBrasilAPI } from "@/lib/validacoes";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function PerfilPage() {
  const [user, setUser] = useState<UsuarioInfo | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); setUser(getCurrentUser()); }, []);
  if (!mounted) return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-foreground-muted" /></div>;
  if (!user) return null;
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Badge variant="primary" className="mb-2"><User className="w-3 h-3" /> Meu perfil</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{user.nome}</h1>
        <p className="text-sm text-foreground-muted mt-1 flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{user.email}</span>
          {user.role === "ADMIN" && <Badge variant="warning"><Shield className="w-3 h-3" /> Admin</Badge>}
          {user.validade && <span className="flex items-center gap-1 text-[11px]"><Clock className="w-3 h-3" /> Válido até {new Date(user.validade).toLocaleDateString("pt-BR")}</span>}
        </p>
      </div>
      <DadosProfissionaisForm user={user} onUpdate={setUser} />
      <TrocarSenhaForm />
    </div>
  );
}

function DadosProfissionaisForm({ user, onUpdate }: { user: UsuarioInfo; onUpdate: (u: UsuarioInfo) => void }) {
  const [form, setForm] = useState({
    nome: user.nome ?? "",
    empresa: (user as any).empresa ?? "",
    cnpj_empresa: "",
    uf_profissional: (user as any).uf_profissional ?? "",
    tipo_registro: (user as any).tipo_registro ?? "CREA",
    numero_registro: (user as any).numero_registro ?? "",
    telefone: (user as any).telefone ?? "",
    cpf: (user as any).cpf ?? "",
    cep: "",
    logradouro: (user as any).endereco?.split(",")[0] ?? "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf_end: "",
    endereco: (user as any).endereco ?? "",
    logo_base64: (user as any).logo_base64 ?? "",
  });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function setF(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); setErros(e => { const n={...e}; delete n[k]; return n; }); }

  async function handleBuscarCEP(cep: string) {
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) return;
    setBuscandoCEP(true);
    const dados = await buscarCEP(cep);
    setBuscandoCEP(false);
    if (dados) {
      setForm(f => ({
        ...f,
        logradouro: dados.logradouro || f.logradouro,
        bairro: dados.bairro || f.bairro,
        cidade: dados.localidade || f.cidade,
        uf_end: dados.uf || f.uf_end,
      }));
    }
  }

  async function handleBuscarCNPJ() {
    const dados = await buscarCNPJBrasilAPI(form.cnpj_empresa);
    if (dados) {
      setF("empresa", dados.razao_social || form.empresa);
    }
  }

  function montarEndereco() {
    return [form.logradouro, form.numero, form.complemento, form.bairro, form.cidade, form.uf_end].filter(Boolean).join(", ");
  }

  function handleLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || file.size > 500_000) return;
    const reader = new FileReader();
    reader.onload = () => setF("logo_base64", reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Obrigatório";
    if (form.cpf && !validarCPF(form.cpf)) e.cpf = "CPF inválido";
    if (form.telefone && !validarTelefone(form.telefone)) e.telefone = "Inválido";
    if (!form.uf_profissional) e.uf_profissional = "Selecione a UF";
    if (!form.tipo_registro) e.tipo_registro = "Selecione";
    if (!form.numero_registro) e.numero_registro = "Obrigatório";
    setErros(e);
    if (Object.keys(e).length) return;
    setSaving(true); setErro(null);
    try {
      const updated = await atualizarPerfil({
        nome: form.nome, empresa: form.empresa,
        logo_base64: form.logo_base64, uf_profissional: form.uf_profissional,
        tipo_registro: form.tipo_registro, numero_registro: form.numero_registro,
        telefone: form.telefone, cpf: form.cpf, endereco: montarEndereco(),
      });
      onUpdate(updated); setSucesso(true); setTimeout(() => setSucesso(false), 3000);
    } catch (ex) { setErro(ex instanceof Error ? ex.message : "Erro"); }
    finally { setSaving(false); }
  }

  const selectCls = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Logo */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Building2 className="w-4 h-4 text-primary" /> Logo da empresa</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {form.logo_base64 ? (
              <div className="relative w-24 h-20 rounded-lg border bg-white flex items-center justify-center overflow-hidden">
                <img src={form.logo_base64} alt="Logo" className="max-w-full max-h-full object-contain" />
                <button type="button" onClick={() => setF("logo_base64", "")} className="absolute top-1 right-1 bg-background rounded-full p-0.5 border"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <div className="w-24 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-foreground-muted"><Upload className="w-6 h-6" /></div>
            )}
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-1" />{form.logo_base64 ? "Trocar" : "Enviar logo"}</Button>
              <p className="text-xs text-foreground-muted mt-1">PNG/JPG, máx. 500 KB</p>
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogo} />
          </div>
        </CardContent>
      </Card>

      {/* Dados pessoais */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dados pessoais</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Nome completo *</Label><Input value={form.nome} onChange={e => setF("nome", e.target.value)} disabled={saving} />{erros.nome && <p className="text-xs text-red-500 mt-1">{erros.nome}</p>}</div>
          <div><Label>E-mail</Label><Input value={user.email} disabled /></div>
          <div><Label>CPF</Label><Input value={form.cpf} onChange={e => setF("cpf", formatarCPF(e.target.value))} placeholder="000.000.000-00" maxLength={14} inputMode="numeric" disabled={saving} />{erros.cpf && <p className="text-xs text-red-500 mt-1">{erros.cpf}</p>}</div>
          <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => setF("telefone", formatarTelefone(e.target.value))} placeholder="(11) 99999-9999" maxLength={15} inputMode="tel" disabled={saving} />{erros.telefone && <p className="text-xs text-red-500 mt-1">{erros.telefone}</p>}</div>
        </CardContent>
      </Card>

      {/* Empresa */}
      <Card>
        <CardHeader><CardTitle className="text-base">Empresa / Escritório</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>CNPJ da empresa (opcional)</Label>
            <div className="flex gap-2">
              <Input value={form.cnpj_empresa} onChange={e => setF("cnpj_empresa", e.target.value)} placeholder="00.000.000/0000-00" maxLength={18} inputMode="numeric" className="flex-1" />
              <Button type="button" variant="outline" size="sm" onClick={handleBuscarCNPJ} disabled={buscandoCNPJ || form.cnpj_empresa.replace(/\D/g,"").length !== 14}>
                {buscandoCNPJ ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <div className="md:col-span-2"><Label>Nome da empresa</Label><Input value={form.empresa} onChange={e => setF("empresa", e.target.value)} placeholder="Nome da empresa ou escritório" disabled={saving} /></div>
        </CardContent>
      </Card>

      {/* Endereço com CEP */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="w-4 h-4 text-primary" /> Endereço</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>CEP</Label>
            <div className="flex gap-2">
              <Input value={form.cep} onChange={e => { const v=formatarCEP(e.target.value); setF("cep",v); if(v.replace(/\D/g,"").length===8) handleBuscarCEP(v); }} placeholder="00000-000" maxLength={9} inputMode="numeric" className="flex-1" disabled={saving} />
              {buscandoCEP && <Loader2 className="w-4 h-4 animate-spin self-center text-foreground-muted" />}
            </div>
          </div>
          <div className="md:col-span-2"><Label>Logradouro</Label><Input value={form.logradouro} onChange={e => setF("logradouro", e.target.value)} placeholder="Rua, Av..." disabled={saving} /></div>
          <div><Label>Número</Label><Input value={form.numero} onChange={e => setF("numero", e.target.value)} placeholder="123" disabled={saving} /></div>
          <div><Label>Complemento</Label><Input value={form.complemento} onChange={e => setF("complemento", e.target.value)} placeholder="Sala, Apto..." disabled={saving} /></div>
          <div><Label>Bairro</Label><Input value={form.bairro} onChange={e => setF("bairro", e.target.value)} disabled={saving} /></div>
          <div><Label>Cidade</Label><Input value={form.cidade} onChange={e => setF("cidade", e.target.value)} disabled={saving} /></div>
          <div>
            <Label>UF</Label>
            <select value={form.uf_end} onChange={e => setF("uf_end", e.target.value)} className={selectCls} disabled={saving}>
              <option value="">UF</option>{UFS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Registro profissional */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="w-4 h-4 text-primary" /> Registro Profissional</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Tipo de registro *</Label>
            <select value={form.tipo_registro} onChange={e => setF("tipo_registro", e.target.value)} className={selectCls} disabled={saving}>
              {["CREA","CFT","CRT","outro"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {erros.tipo_registro && <p className="text-xs text-red-500 mt-1">{erros.tipo_registro}</p>}
          </div>
          <div>
            <Label>UF do conselho regional *</Label>
            <select value={form.uf_profissional} onChange={e => setF("uf_profissional", e.target.value)} className={selectCls} disabled={saving}>
              <option value="">Selecione...</option>{UFS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            {erros.uf_profissional && <p className="text-xs text-red-500 mt-1">{erros.uf_profissional}</p>}
          </div>
          <div className="md:col-span-2"><Label>Número do registro *</Label><Input value={form.numero_registro} onChange={e => setF("numero_registro", e.target.value)} placeholder="Ex: 5062345678" disabled={saving} />{erros.numero_registro && <p className="text-xs text-red-500 mt-1">{erros.numero_registro}</p>}</div>
        </CardContent>
      </Card>

      {erro && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{erro}</div>}
      {sucesso && <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Perfil salvo!</div>}
      <div className="flex justify-end"><Button type="submit" disabled={saving}>{saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Salvando...</> : <><Save className="w-4 h-4 mr-2" />Salvar perfil</>}</Button></div>
    </form>
  );
}

function TrocarSenhaForm() {
  const [senhaAtual, setSenhaAtual] = useState(""); const [senhaNova, setSenhaNova] = useState(""); const [senhaConfirma, setSenhaConfirma] = useState("");
  const [saving, setSaving] = useState(false); const [erro, setErro] = useState<string|null>(null); const [sucesso, setSucesso] = useState(false);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErro(null);
    if (senhaNova !== senhaConfirma) { setErro("Confirmação não confere."); return; }
    if (senhaNova.length < 8) { setErro("Mínimo 8 caracteres."); return; }
    setSaving(true);
    try { await trocarSenha(senhaAtual, senhaNova); setSucesso(true); setSenhaAtual(""); setSenhaNova(""); setSenhaConfirma(""); setTimeout(()=>setSucesso(false),3000); }
    catch (ex) { setErro(ex instanceof Error ? ex.message : "Erro"); }
    finally { setSaving(false); }
  }
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="w-4 h-4 text-primary" /> Alterar senha</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Senha atual</Label><Input type="password" value={senhaAtual} onChange={e=>setSenhaAtual(e.target.value)} required disabled={saving} /></div>
          <div><Label>Nova senha</Label><Input type="password" value={senhaNova} onChange={e=>setSenhaNova(e.target.value)} minLength={8} required disabled={saving} /></div>
          <div><Label>Confirme</Label><Input type="password" value={senhaConfirma} onChange={e=>setSenhaConfirma(e.target.value)} minLength={8} required disabled={saving} /></div>
          {erro && <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{erro}</div>}
          {sucesso && <div className="p-2 rounded bg-green-50 border border-green-200 text-green-700 text-xs flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />Senha alterada!</div>}
          <div className="flex justify-end"><Button type="submit" disabled={saving}>{saving?"Alterando...":"Alterar senha"}</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}
