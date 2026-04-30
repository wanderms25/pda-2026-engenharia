"use client";
import { validarCPF, validarCNPJ, formatarCPF, formatarCNPJ, formatarTelefone } from "@/lib/validacoes";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Badge,
} from "@/components/ui";
import {
  FolderKanban,
  Plus,
  Lock,
  Users,
  Building,
  Trash2,
  Loader2,
  X,
  LogIn,
  Database,
  FileText,
  Search,
  CheckCircle2,
} from "lucide-react";
import {
  isAuthenticated,
  listarClientes,
  criarCliente,
  deletarCliente,
  listarProjetos,
  criarProjeto,
  deletarProjeto,
  buscarCNPJ,
  type Cliente,
  type Projeto,
  ApiError,
} from "@/lib/api";

export default function ProjetosPage() {
  const [authed, setAuthed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setAuthed(isAuthenticated());
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-foreground-muted" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="space-y-6">
        <div>
          <Badge variant="primary" className="mb-2">
            <Database className="w-3 h-3" />
            Persistência PostgreSQL
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Projetos
          </h1>
          <p className="text-sm text-foreground-muted mt-1 max-w-2xl">
            Gerencie clientes, estruturas e o histórico versionado de análises
            e laudos.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center min-h-[400px] text-foreground-muted p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg text-foreground mb-2">
              Acesso restrito
            </h3>
            <p className="text-sm max-w-md mb-6">
              O CRUD de projetos requer autenticação JWT. Faça login ou
              registre-se para começar a gerenciar clientes e estruturas.
            </p>
            <Button asChild size="lg">
              <Link href="/login">
                <LogIn className="w-5 h-5" />
                Entrar no sistema
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <ProjetosCRUD />;
}

// =============================================================================
// CRUD (só renderiza se autenticado)
// =============================================================================
function ProjetosCRUD() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showClienteForm, setShowClienteForm] = useState(false);
  const [showProjetoForm, setShowProjetoForm] = useState(false);

  async function carregar() {
    setLoading(true);
    setError(null);
    try {
      const [cs, ps] = await Promise.all([listarClientes(), listarProjetos()]);
      setClientes(cs);
      setProjetos(ps);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? `${e.status}: ${e.message}`
          : "Falha ao carregar dados",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function handleDeletarCliente(id: string) {
    if (!confirm("Deletar este cliente? Todos os projetos dele serão removidos.")) return;
    try {
      await deletarCliente(id);
      await carregar();
      if (clienteSelecionado?.id === id) setClienteSelecionado(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao deletar");
    }
  }

  async function handleDeletarProjeto(id: string) {
    if (!confirm("Deletar este projeto?")) return;
    try {
      await deletarProjeto(id);
      await carregar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao deletar");
    }
  }

  const projetosFiltrados = clienteSelecionado
    ? projetos.filter((p) => p.cliente_id === clienteSelecionado.id)
    : projetos;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge variant="primary" className="mb-2">
            <Database className="w-3 h-3" />
            Persistência PostgreSQL
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Projetos
          </h1>
          <p className="text-sm text-foreground-muted mt-1">
            Gerencie clientes e projetos com persistência e auditoria
          </p>
        </div>
      </div>

      {error && (
        <Card className="border-danger/50 bg-danger-muted">
          <CardContent className="pt-5">
            <p className="text-sm text-danger">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ==================================================================
            CLIENTES
            ================================================================== */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <CardTitle>Clientes</CardTitle>
                <Badge variant="outline">{clientes.length}</Badge>
              </div>
              <Button
                size="sm"
                onClick={() => setShowClienteForm(!showClienteForm)}
              >
                <Plus className="w-4 h-4" /> Novo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showClienteForm && (
              <ClienteForm
                onSuccess={async () => {
                  setShowClienteForm(false);
                  await carregar();
                }}
                onCancel={() => setShowClienteForm(false)}
              />
            )}

            {loading && (
              <div className="py-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-foreground-muted" />
              </div>
            )}

            {!loading && clientes.length === 0 && !showClienteForm && (
              <div className="py-8 text-center text-sm text-foreground-muted">
                Nenhum cliente cadastrado. Clique em "Novo" para começar.
              </div>
            )}

            {!loading &&
              clientes.map((c) => (
                <div
                  key={c.id}
                  onClick={() =>
                    setClienteSelecionado(
                      clienteSelecionado?.id === c.id ? null : c,
                    )
                  }
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    clienteSelecionado?.id === c.id
                      ? "border-primary bg-primary/5"
                      : "border-border-subtle hover:bg-card-hover"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {c.razao_social}
                      </div>
                      {c.cnpj && (
                        <div className="text-[10px] text-foreground-muted font-mono">
                          CNPJ: {c.cnpj}
                        </div>
                      )}
                      {c.contato_nome && (
                        <div className="text-[10px] text-foreground-muted">
                          {c.contato_nome} — {c.contato_email ?? ""}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletarCliente(c.id);
                      }}
                      className="p-1 rounded hover:bg-danger-muted hover:text-danger transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        {/* ==================================================================
            PROJETOS
            ================================================================== */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-primary" />
                <CardTitle>
                  {clienteSelecionado
                    ? `Projetos de ${clienteSelecionado.razao_social}`
                    : "Todos os projetos"}
                </CardTitle>
                <Badge variant="outline">{projetosFiltrados.length}</Badge>
              </div>
              <Button
                size="sm"
                disabled={clientes.length === 0}
                onClick={() => setShowProjetoForm(!showProjetoForm)}
              >
                <Plus className="w-4 h-4" /> Novo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showProjetoForm && (
              <ProjetoForm
                clientes={clientes}
                clienteInicial={clienteSelecionado?.id}
                onSuccess={async () => {
                  setShowProjetoForm(false);
                  await carregar();
                }}
                onCancel={() => setShowProjetoForm(false)}
              />
            )}

            {loading && (
              <div className="py-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-foreground-muted" />
              </div>
            )}

            {!loading &&
              projetosFiltrados.length === 0 &&
              !showProjetoForm && (
                <div className="py-8 text-center text-sm text-foreground-muted">
                  {clientes.length === 0
                    ? "Crie um cliente antes de adicionar projetos."
                    : "Nenhum projeto. Clique em 'Novo' para criar."}
                </div>
              )}

            {!loading &&
              projetosFiltrados.map((p) => {
                const cliente = clientes.find((c) => c.id === p.cliente_id);
                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-lg border border-border-subtle hover:bg-card-hover"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {p.nome}
                        </div>
                        {cliente && (
                          <div className="text-[10px] text-foreground-muted">
                            {cliente.razao_social}
                          </div>
                        )}
                        {p.endereco && (
                          <div className="text-[10px] text-foreground-muted truncate">
                            {p.endereco}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletarProjeto(p.id)}
                        className="p-1 rounded hover:bg-danger-muted hover:text-danger transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>

      {/* Atalhos para criar análise/laudo */}
      {projetos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderKanban className="w-4 h-4 text-primary" />
              Próximos passos
            </CardTitle>
            <CardDescription>
              Com clientes e projetos cadastrados, siga para análise ou laudo
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/analise-risco">
                <FileText className="w-4 h-4" />
                Nova análise de risco
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/laudo">
                <FileText className="w-4 h-4" />
                Novo laudo de inspeção
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =============================================================================
// FORMULÁRIO DE CLIENTE
// =============================================================================
function ClienteForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [tipoPessoa, setTipoPessoa] = useState<"PF"|"PJ">("PJ");
  const [form, setForm] = useState({
    razao_social: "", cnpj: "", cpf_cnpj: "", contato_nome: "",
    contato_email: "", contato_telefone: "", endereco: "", cidade: "",
    uf_cliente: "", cep: "", nome_fantasia: "", responsavel: "",
  });
  const [saving, setSaving] = useState(false);
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoCnpj, setInfoCnpj] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string,string>>({});

  const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

  function setF(k: string, v: string) { setForm(f => ({...f, [k]: v})); setErros(e => { const n={...e}; delete n[k]; return n; }); }

  function handleCpfCnpj(v: string) {
    const fmt = tipoPessoa === "PF" ? formatarCPF(v) : formatarCNPJ(v);
    setF("cpf_cnpj", fmt);
    setInfoCnpj(null);
  }

  function handleTel(v: string) { setF("contato_telefone", formatarTelefone(v)); }
  function handleCEP(v: string) {
    const d = v.replace(/\D/g,"").slice(0,8);
    setF("cep", d.length > 5 ? `${d.slice(0,5)}-${d.slice(5)}` : d);
  }

  function handleTipoPessoa(t: "PF"|"PJ") { setTipoPessoa(t); setF("cpf_cnpj",""); setInfoCnpj(null); }

  async function buscarDadosCnpj() {
    if (!validarCNPJ(form.cpf_cnpj)) { setErros(e => ({...e, cpf_cnpj: "CNPJ inválido."})); return; }
    setBuscandoCnpj(true); setError(null); setInfoCnpj(null);
    try {
      const dados = await buscarCNPJ(form.cpf_cnpj);
      const end = [dados.logradouro, dados.numero, dados.complemento, dados.bairro].filter(Boolean).join(", ");
      setForm(f => ({
        ...f,
        razao_social: dados.razao_social || f.razao_social,
        nome_fantasia: dados.nome_fantasia || f.nome_fantasia,
        contato_email: dados.email || f.contato_email,
        contato_telefone: dados.telefone ? formatarTelefone(dados.telefone) : f.contato_telefone,
        endereco: end || f.endereco,
        cidade: dados.municipio || f.cidade,
        uf_cliente: dados.uf || f.uf_cliente,
        cep: dados.cep ? (dados.cep.length > 5 ? `${dados.cep.slice(0,5)}-${dados.cep.slice(5)}` : dados.cep) : f.cep,
      }));
      setInfoCnpj(dados.situacao ?? "Encontrado");
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao buscar CNPJ"); }
    finally { setBuscandoCnpj(false); }
  }

  function validarForm(): boolean {
    const e: Record<string,string> = {};
    if (!form.razao_social.trim()) e.razao_social = "Campo obrigatório.";
    if (form.cpf_cnpj) {
      if (tipoPessoa === "PF" && !validarCPF(form.cpf_cnpj)) e.cpf_cnpj = "CPF inválido.";
      if (tipoPessoa === "PJ" && !validarCNPJ(form.cpf_cnpj)) e.cpf_cnpj = "CNPJ inválido.";
    }
    if (form.contato_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contato_email)) e.contato_email = "E-mail inválido.";
    if (form.contato_telefone && ![10,11].includes(form.contato_telefone.replace(/\D/g,"").length)) e.contato_telefone = "Telefone inválido.";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validarForm()) return;
    setSaving(true); setError(null);
    try {
      await criarCliente({
        razao_social: form.razao_social,
        cnpj: tipoPessoa === "PJ" ? form.cpf_cnpj || undefined : undefined,
        tipo_pessoa: tipoPessoa,
        cpf_cnpj: form.cpf_cnpj || undefined,
        nome_fantasia: form.nome_fantasia || undefined,
        responsavel: form.responsavel || form.contato_nome || undefined,
        contato_nome: form.responsavel || form.contato_nome || undefined,
        email: form.contato_email || undefined,
        telefone: form.contato_telefone || undefined,
        contato_email: form.contato_email || undefined,
        contato_telefone: form.contato_telefone || undefined,
        endereco: form.endereco || undefined,
        cidade: form.cidade || undefined,
        uf_cliente: form.uf_cliente || undefined,
        cep: form.cep || undefined,
      });
      onSuccess();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-semibold">Novo cliente</div>
        <button type="button" onClick={onCancel}><X className="w-4 h-4 text-foreground-muted" /></button>
      </div>

      {/* Tipo */}
      <div className="flex gap-2">
        {(["PF","PJ"] as ("PF"|"PJ")[]).map(t => (
          <button key={t} type="button" onClick={() => handleTipoPessoa(t)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs transition-colors ${tipoPessoa === t ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground-muted"}`}>
            {t === "PJ" ? <Building className="w-3 h-3" /> : <Users className="w-3 h-3" />}
            {t === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
          </button>
        ))}
      </div>

      {/* CPF/CNPJ */}
      <div>
        <Label>{tipoPessoa === "PJ" ? "CNPJ" : "CPF"}</Label>
        <div className="flex gap-2">
          <Input value={form.cpf_cnpj} onChange={e => handleCpfCnpj(e.target.value)}
            placeholder={tipoPessoa === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
            maxLength={tipoPessoa === "PJ" ? 18 : 14} inputMode="numeric" disabled={saving} className="flex-1" />
          {tipoPessoa === "PJ" && (
            <Button type="button" variant="outline" size="default" onClick={buscarDadosCnpj}
              disabled={saving || buscandoCnpj || form.cpf_cnpj.replace(/\D/g,"").length !== 14}>
              {buscandoCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="hidden sm:inline">Buscar</span>
            </Button>
          )}
        </div>
        {erros.cpf_cnpj && <p className="text-xs text-red-500 mt-1">{erros.cpf_cnpj}</p>}
        {infoCnpj && <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{infoCnpj}</p>}
        {tipoPessoa === "PJ" && <p className="text-[10px] text-foreground-muted mt-1">Dados via BrasilAPI. Limite: 3/min.</p>}
      </div>

      {/* Nome */}
      <div>
        <Label>{tipoPessoa === "PJ" ? "Razão social *" : "Nome completo *"}</Label>
        <Input required value={form.razao_social} onChange={e => setF("razao_social", e.target.value)} disabled={saving} />
        {erros.razao_social && <p className="text-xs text-red-500 mt-1">{erros.razao_social}</p>}
      </div>

      {tipoPessoa === "PJ" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div><Label>Nome fantasia</Label><Input value={form.nome_fantasia} onChange={e => setF("nome_fantasia", e.target.value)} disabled={saving} /></div>
          <div><Label>Responsável</Label><Input value={form.responsavel} onChange={e => setF("responsavel", e.target.value)} disabled={saving} /></div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label>E-mail</Label>
          <Input type="email" value={form.contato_email} onChange={e => setF("contato_email", e.target.value)} disabled={saving} />
          {erros.contato_email && <p className="text-xs text-red-500 mt-1">{erros.contato_email}</p>}
        </div>
        <div>
          <Label>Telefone</Label>
          <Input value={form.contato_telefone} onChange={e => handleTel(e.target.value)} placeholder="(11) 99999-9999" maxLength={15} inputMode="tel" disabled={saving} />
          {erros.contato_telefone && <p className="text-xs text-red-500 mt-1">{erros.contato_telefone}</p>}
        </div>
      </div>

      <div><Label>Endereço</Label><Input value={form.endereco} onChange={e => setF("endereco", e.target.value)} placeholder="Rua, nº, Bairro" disabled={saving} /></div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="col-span-2 sm:col-span-1"><Label>CEP</Label><Input value={form.cep} onChange={e => handleCEP(e.target.value)} maxLength={9} inputMode="numeric" disabled={saving} /></div>
        <div><Label>Cidade</Label><Input value={form.cidade} onChange={e => setF("cidade", e.target.value)} disabled={saving} /></div>
        <div>
          <Label>UF</Label>
          <select value={form.uf_cliente} onChange={e => setF("uf_cliente", e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" disabled={saving}>
            <option value="">UF</option>{UFS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? <><Loader2 className="w-3 h-3 animate-spin" /> Salvando...</> : "Salvar cliente"}</Button>
      </div>
    </form>
  );
}


function ProjetoForm({
  clientes,
  clienteInicial,
  onSuccess,
  onCancel,
}: {
  clientes: Cliente[];
  clienteInicial?: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    cliente_id: clienteInicial ?? clientes[0]?.id ?? "",
    nome: "",
    endereco: "",
    uf: "",
    municipio: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await criarProjeto({
        cliente_id: form.cliente_id,
        nome: form.nome,
        endereco: form.endereco || undefined,
        uf: form.uf || undefined,
        municipio: form.municipio || undefined,
      });
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-semibold">Novo projeto</div>
        <button type="button" onClick={onCancel}>
          <X className="w-4 h-4 text-foreground-muted" />
        </button>
      </div>
      <div>
        <Label>Cliente *</Label>
        <select
          required
          value={form.cliente_id}
          onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
          className="input-modern w-full"
          disabled={saving}
        >
          <option value="">Selecione...</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.razao_social}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>Nome do projeto *</Label>
        <Input
          required
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          placeholder="Ex.: Reforma SPDA Edifício Sede"
          disabled={saving}
        />
      </div>
      <div>
        <Label>Endereço</Label>
        <Input
          value={form.endereco}
          onChange={(e) => setForm({ ...form, endereco: e.target.value })}
          disabled={saving}
        />
      </div>
      <div className="grid grid-cols-[1fr_3fr] gap-2">
        <div>
          <Label>UF</Label>
          <Input
            value={form.uf}
            onChange={(e) =>
              setForm({ ...form, uf: e.target.value.toUpperCase().slice(0, 2) })
            }
            placeholder="SP"
            maxLength={2}
            disabled={saving}
          />
        </div>
        <div>
          <Label>Município</Label>
          <Input
            value={form.municipio}
            onChange={(e) => setForm({ ...form, municipio: e.target.value })}
            disabled={saving}
          />
        </div>
      </div>
      {error && (
        <div className="p-2 rounded bg-danger-muted text-danger text-xs">
          {error}
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={saving}
        >
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving && <Loader2 className="w-3 h-3 animate-spin" />}
          Salvar
        </Button>
      </div>
    </form>
  );
}
