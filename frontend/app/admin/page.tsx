"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Input, Label, Badge } from "@/components/ui";
import {
  Users, Plus, Trash2, Key, Shield, Loader2, CheckCircle2,
  AlertCircle, X, Layout, Sliders
} from "lucide-react";
import {
  listarUsuariosAdmin, criarUsuarioAdmin, deletarUsuarioAdmin,
  resetSenhaUsuario, getCurrentUser, type UsuarioInfo
} from "@/lib/api";
import { validarCPF, validarEmail, validarTelefone, formatarCPF, formatarTelefone } from "@/lib/validacoes";
import { getFeatureFlags, setFeatureFlags, type FeatureFlag } from "@/lib/feature-flags";
import { API_BASE_URL } from "@/lib/config";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
type Aba = "usuarios" | "editor" | "funcionalidades";

interface UserOut { id:string;nome:string;email:string;role:string;ativo:boolean;criado_em:string;validade?:string; }

export default function AdminPage() {
  const [aba, setAba] = useState<Aba>("usuarios");
  const [currentUser, setCurrentUser] = useState<UsuarioInfo|null>(null);

  useEffect(() => { setCurrentUser(getCurrentUser()); }, []);

  if (currentUser?.role !== "ADMIN") return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Administração</h1>
      <Card><CardContent className="p-8 text-center text-foreground-muted">
        <Shield className="w-12 h-12 mx-auto mb-3 opacity-30"/>
        Acesso restrito a administradores.
      </CardContent></Card>
    </div>
  );

  const ABAS = [
    { id:"usuarios"as Aba, label:"Usuários", icon:Users },
    { id:"editor"as Aba, label:"Editor da Página", icon:Layout },
    { id:"funcionalidades"as Aba, label:"Funcionalidades", icon:Sliders },
  ];

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <Badge variant={"outline" as any} className="mb-2 gap-1"><Shield className="w-3 h-3"/>Admin</Badge>
        <h1 className="text-2xl font-bold">Administração do Sistema</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-2 flex-wrap">
        {ABAS.map(({id,label,icon:Icon})=>(
          <button key={id} type="button" onClick={()=>setAba(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t text-sm font-medium transition-colors ${
              aba===id?"bg-primary/10 text-primary border-b-2 border-primary":"text-foreground-muted hover:text-foreground"
            }`}>
            <Icon className="w-4 h-4"/>{label}
          </button>
        ))}
      </div>

      {aba==="usuarios" && <AbaUsuarios/>}
      {aba==="editor" && <AbaEditor/>}
      {aba==="funcionalidades" && <AbaFuncionalidades/>}
    </div>
  );
}

// ── Aba Usuários ──────────────────────────────────────────────────────────────
// ── Aba Usuários ──────────────────────────────────────────────────────────────
function AbaUsuarios() {
  const [users, setUsers] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Controle do painel de sucesso ao resetar a senha
  const [senhaResetada, setSenhaResetada] = useState<{nome: string, senha: string} | null>(null);

  useEffect(()=>{
    listarUsuariosAdmin().then(u=>setUsers(u as UserOut[])).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  async function handleDelete(id:string,nome:string){
    if(!confirm(`Excluir "${nome}"?`)) return;
    try { await deletarUsuarioAdmin(id); setUsers(u=>u.filter(x=>x.id!==id)); }
    catch(e){ alert(e instanceof Error?e.message:"Erro"); }
  }
  
  // Função corrigida: sem o popup do navegador!
  async function handleReset(id:string,nome:string){
    try { 
      // Chama a API para resetar
      const u: any = await resetSenhaUsuario(id); 
      
      // Exibe o painel integrado com a nova senha
      setSenhaResetada({
        nome: nome,
        senha: u?.senha_gerada || "Erro: A API não retornou a senha. Verifique o arquivo api.ts."
      });
    }
    catch(e){ 
      console.error("Erro ao resetar:", e);
      alert("Falha ao resetar a senha."); 
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-foreground-muted">Cadastre e gerencie os profissionais habilitados.</p>
        <Button size="sm" onClick={()=>setShowForm(!showForm)}><Plus className="w-4 h-4 mr-1"/>Novo usuário</Button>
      </div>

      {showForm && <FormNovoUsuario onSuccess={(u)=>{setUsers(p=>[u as UserOut,...p]);setShowForm(false);}} onCancel={()=>setShowForm(false)}/>}
      
      {/* ── PAINEL DE SUCESSO: RESET DE SENHA (Substitui o popup) ── */}
      {senhaResetada && (
        <Card className="border-orange-500/30 bg-orange-500/5 mb-4">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-orange-600" />
              <CardTitle className="text-sm text-orange-700">Senha resetada com sucesso!</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground-muted">
              A nova senha temporária para <strong>{senhaResetada.nome}</strong> é:
            </p>
            
            <div className="p-4 bg-background border border-border rounded-lg text-center flex items-center justify-center gap-3">
              <Key className="w-5 h-5 text-primary" />
              <span className="font-mono text-xl font-bold tracking-wider select-all">
                {senhaResetada.senha}
              </span>
            </div>
            
            <p className="text-xs text-orange-600 flex items-center gap-1.5 bg-orange-500/10 p-2 rounded border border-orange-500/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Copie esta senha e envie para o usuário. Por segurança, ela não será exibida novamente após fechar.
            </p>
            
            <div className="flex justify-end pt-2">
              <Button onClick={() => setSenhaResetada(null)}>Concluir e Fechar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-foreground-muted"/></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {users.map(u=>(
            <Card key={u.id} className="card-glass">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold ${u.role==="ADMIN"?"bg-primary/10 text-primary":"bg-background-secondary text-foreground-muted"}`}>
                      {u.nome[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{u.nome}</div>
                      <div className="text-xs text-foreground-muted truncate">{u.email}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant={"outline" as any} className="text-[10px]">{u.role}</Badge>
                        <span className={`text-[10px] ${u.ativo?"text-green-600":"text-red-500"}`}>{u.ativo?"● Ativo":"● Inativo"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {/* Botão que chama o handleReset */}
                    <button onClick={()=>handleReset(u.id,u.nome)} className="p-1.5 rounded hover:bg-background-secondary text-foreground-muted hover:text-primary" title="Resetar senha"><Key className="w-4 h-4"/></button>
                    
                    {u.role!=="ADMIN"&&<button onClick={()=>handleDelete(u.id,u.nome)} className="p-1.5 rounded hover:bg-red-50 text-foreground-muted hover:text-red-600" title="Excluir"><Trash2 className="w-4 h-4"/></button>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {users.length===0&&<div className="md:col-span-2"><Card><CardContent className="p-8 text-center text-foreground-muted"><Users className="w-12 h-12 mx-auto mb-3 opacity-30"/>Nenhum usuário.</CardContent></Card></div>}
        </div>
      )}
    </div>
  );
}

// ── Form Novo Usuário ─────────────────────────────────────────────────────────
// ── Form Novo Usuário ─────────────────────────────────────────────────────────
function FormNovoUsuario({onSuccess,onCancel}:{onSuccess:(u:unknown)=>void;onCancel:()=>void}) {
  const [form, setForm] = useState<{nome:string;email:string;cpf:string;telefone:string;tipo_registro:string;uf_profissional:string;numero_registro:string;role:"ADMIN"|"USER";validade:string;empresa:string}>({
    nome:"",email:"",cpf:"",telefone:"",tipo_registro:"CREA",uf_profissional:"",numero_registro:"",role:"USER",validade:"",empresa:"",
  });
  const [erros,setErros]=useState<Record<string,string>>({});
  const [saving,setSaving]=useState(false);
  const [erro,setErro]=useState<string|null>(null);
  
  // Novos estados para controlar a tela de sucesso nativa
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);
  const [usuarioSalvo, setUsuarioSalvo] = useState<unknown | null>(null);

  const selectCls="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground";

  function setF(k:string,v:string){ setForm(f=>({...f,[k]:v})); setErros(e=>{const n={...e};delete n[k];return n;}); }
  
  function validar(){
    const e:Record<string,string>={};
    if(!form.nome.trim()) e.nome="Obrigatório";
    if(!validarEmail(form.email)) e.email="E-mail inválido";
    if(form.cpf&&!validarCPF(form.cpf)) e.cpf="CPF inválido";
    if(form.telefone&&!validarTelefone(form.telefone)) e.telefone="Telefone inválido";
    if(!form.uf_profissional) e.uf_profissional="Selecione a UF";
    if(!form.numero_registro) e.numero_registro="Obrigatório";
    setErros(e); return Object.keys(e).length===0;
  }

  async function handleSubmit(ev:React.FormEvent){
    ev.preventDefault(); if(!validar()) return;
    setSaving(true); setErro(null);
    try {
      const u = await criarUsuarioAdmin({nome:form.nome,email:form.email,role:form.role,
        validade:form.validade||undefined,cpf:form.cpf||undefined,telefone:form.telefone||undefined,
        tipo_registro:form.tipo_registro,uf_profissional:form.uf_profissional,
        numero_registro:form.numero_registro,empresa:form.empresa||undefined});
      
      // Em vez de chamar o onSuccess e fechar direto, nós salvamos a senha gerada
      setSenhaGerada((u as any).senha_gerada || "SENHA_NAO_RETORNADA_PELO_BACKEND");
      setUsuarioSalvo(u);
    } catch(e){ 
      setErro(e instanceof Error?e.message:"Erro"); 
    } finally{ 
      setSaving(false); 
    }
  }

  // Se a senha foi gerada, mostra a TELA DE SUCESSO nativa em vez do formulário
  if (senhaGerada) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <CardTitle className="text-sm text-green-700">Usuário criado com sucesso!</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground-muted">
            A senha temporária para o acesso de <strong>{form.nome}</strong> é:
          </p>
          
          {/* Caixa de destaque para a senha */}
          <div className="p-4 bg-background border border-border rounded-lg text-center flex items-center justify-center gap-3">
            <Key className="w-5 h-5 text-primary" />
            <span className="font-mono text-xl font-bold tracking-wider select-all">
              {senhaGerada}
            </span>
          </div>
          
          <p className="text-xs text-orange-600 flex items-center gap-1.5 bg-orange-500/10 p-2 rounded border border-orange-500/20">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Copie esta senha e envie para o usuário. Por segurança, ela não será exibida novamente após você fechar este aviso.
          </p>
          
          <div className="flex justify-end pt-2">
            <Button onClick={() => onSuccess(usuarioSalvo)}>Concluir e Fechar</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Se não tem senha gerada, renderiza o formulário normalmente
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader><div className="flex items-center justify-between"><CardTitle className="text-sm">Novo usuário</CardTitle><button type="button" onClick={onCancel}><X className="w-4 h-4 text-foreground-muted"/></button></div></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label className="text-xs">Nome *</Label><Input value={form.nome} onChange={e=>setF("nome",e.target.value)} className="mt-1" disabled={saving}/>{erros.nome&&<p className="text-xs text-red-500 mt-0.5">{erros.nome}</p>}</div>
          <div><Label className="text-xs">E-mail *</Label><Input type="email" value={form.email} onChange={e=>setF("email",e.target.value)} className="mt-1" disabled={saving}/>{erros.email&&<p className="text-xs text-red-500 mt-0.5">{erros.email}</p>}</div>
          <div><Label className="text-xs">CPF</Label><Input value={form.cpf} onChange={e=>setF("cpf",formatarCPF(e.target.value))} placeholder="000.000.000-00" maxLength={14} className="mt-1" disabled={saving}/>{erros.cpf&&<p className="text-xs text-red-500 mt-0.5">{erros.cpf}</p>}</div>
          <div><Label className="text-xs">Telefone</Label><Input value={form.telefone} onChange={e=>setF("telefone",formatarTelefone(e.target.value))} placeholder="(11) 99999-9999" maxLength={15} className="mt-1" disabled={saving}/>{erros.telefone&&<p className="text-xs text-red-500 mt-0.5">{erros.telefone}</p>}</div>
          <div><Label className="text-xs">Tipo registro *</Label>
            <select value={form.tipo_registro} onChange={e=>setF("tipo_registro",e.target.value)} className={selectCls+" mt-1"} disabled={saving}>
              {["CREA","CFT","CRT","outro"].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div><Label className="text-xs">UF conselho *</Label>
            <select value={form.uf_profissional} onChange={e=>setF("uf_profissional",e.target.value)} className={selectCls+" mt-1"} disabled={saving}>
              <option value="">Selecione...</option>{UFS.map(u=><option key={u}>{u}</option>)}
            </select>
            {erros.uf_profissional&&<p className="text-xs text-red-500 mt-0.5">{erros.uf_profissional}</p>}
          </div>
          <div><Label className="text-xs">Nº registro *</Label><Input value={form.numero_registro} onChange={e=>setF("numero_registro",e.target.value)} className="mt-1" disabled={saving}/>{erros.numero_registro&&<p className="text-xs text-red-500 mt-0.5">{erros.numero_registro}</p>}</div>
          <div><Label className="text-xs">Empresa</Label><Input value={form.empresa} onChange={e=>setF("empresa",e.target.value)} className="mt-1" disabled={saving}/></div>
          <div><Label className="text-xs">Perfil</Label>
            <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value as "ADMIN"|"USER"}))} className={selectCls+" mt-1"} disabled={saving}>
              <option value="USER">Usuário</option><option value="ADMIN">Administrador</option>
            </select>
          </div>
          <div><Label className="text-xs">Validade</Label><Input type="date" value={form.validade} onChange={e=>setF("validade",e.target.value)} className="mt-1" disabled={saving}/></div>
          {erro&&<div className="sm:col-span-2 p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{erro}</div>}
          <div className="sm:col-span-2 flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={saving}>{saving?<><Loader2 className="w-3 h-3 animate-spin mr-1"/>Criando...</>:"Criar usuário"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Aba Editor ────────────────────────────────────────────────────────────────
// (inline — same logic as admin/editor/page.tsx but embedded as component)
function AbaEditor() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground-muted">Edite textos, imagens, seções e menus da página inicial.</p>
      <div className="p-4 rounded-lg border border-border bg-background-secondary text-sm text-foreground-muted text-center">
        O editor completo está disponível em{" "}
        <a href="/admin/editor" className="text-primary hover:underline font-medium">Abrir Editor da Página →</a>
      </div>
    </div>
  );
}

// ── Aba Funcionalidades ───────────────────────────────────────────────────────
function AbaFuncionalidades() {
  const [flags, setFlagsState] = useState<FeatureFlag[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(()=>{ setFlagsState(getFeatureFlags()); },[]);

  function toggle(id:string){
    const updated=flags.map(f=>f.id===id?{...f,habilitado:!f.habilitado}:f);
    setFlagsState(updated); setFeatureFlags(updated); setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground-muted">Ative ou desative funcionalidades. Itens desativados ficam ocultos para usuários comuns.</p>
      {saved&&<div className="flex items-center gap-2 p-2 rounded bg-green-50 border border-green-200 text-green-800 text-xs"><CheckCircle2 className="w-4 h-4"/>Salvo automaticamente.</div>}
      {flags.map(f=>(
        <Card key={f.id} className={f.habilitado?"":"opacity-60"}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-sm">{f.label}</div>
                <div className="text-xs text-foreground-muted">{f.descricao} · <code className="text-[10px]">{f.href}</code></div>
              </div>
              <div onClick={()=>toggle(f.id)}
                className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer shrink-0 ${f.habilitado?"bg-primary":"bg-border"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${f.habilitado?"translate-x-5":"translate-x-0.5"}`}/>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
