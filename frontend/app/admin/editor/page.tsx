"use client";
import { useState, useEffect, useRef, ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Input, Label, Badge } from "@/components/ui";
import { Settings, Layout, Type, Navigation, Plus, Trash2, Eye, EyeOff, Save, Loader2, Upload, GripVertical, ChevronDown, ChevronUp, Globe, AlertCircle, CheckCircle2, X } from "lucide-react";
import { getCurrentUser, request } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";

const selectCls = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground";

interface MenuItem { label: string; href: string; }
interface Statistic { valor: string; label: string; }
interface CardItem { titulo: string; descricao: string; icone: string; }
interface PlanItem { nome: string; preco: string; periodo: string; destaque: boolean; recursos: string[]; }
interface Secao { id: string; tipo: string; titulo: string; subtitulo?: string; descricao?: string; visivel: boolean; itens?: CardItem[]; planos?: PlanItem[]; }
interface SiteConfig { nome: string; subtitulo: string; cor_primaria: string; logo_base64: string; }
interface HeroConfig { titulo: string; titulo_destaque: string; subtitulo: string; descricao: string; imagem_base64: string; botao_primario: {texto:string;href:string}; botao_secundario: {texto:string;href:string}; estatisticas: Statistic[]; }
interface PageConfig { site: SiteConfig; menu: MenuItem[]; hero: HeroConfig; secoes: Secao[]; rodape: {texto:string;links:MenuItem[]}; }

const BLANK: PageConfig = {
  site: { nome: "PDA NBR 5419", subtitulo: "Edição 2026", cor_primaria: "#6366f1", logo_base64: "" },
  menu: [{ label: "Recursos", href: "#recursos" }],
  hero: { titulo: "Análise de risco contra", titulo_destaque: "descargas atmosféricas", subtitulo: "automatizada, auditável e conforme a norma", descricao: "", imagem_base64: "", botao_primario: { texto: "Acessar o sistema", href: "/login" }, botao_secundario: { texto: "Ver recursos", href: "#recursos" }, estatisticas: [{ valor: "5.524", label: "Municípios" }, { valor: "30", label: "Checklist" }] },
  secoes: [],
  rodape: { texto: "© 2026 PDA NBR 5419", links: [{ label: "Termos", href: "/termos" }, { label: "Privacidade", href: "/privacidade" }] },
};

const TIPO_LABELS: Record<string,string> = { cards:"Cards de recursos", texto:"Texto livre", precos:"Planos e preços" };
const ICONES = ["Shield","Zap","FileText","MapPin","BarChart3","BookOpen","CheckCircle2","Star","Users","Award"];

export default function EditorPage() {
  const [cfg, setCfg] = useState<PageConfig>(BLANK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{tipo:"ok"|"erro";texto:string}|null>(null);
  const [aba, setAba] = useState<"site"|"menu"|"hero"|"secoes"|"rodape">("hero");
  const [aberta, setAberta] = useState<string|null>(null);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const u = getCurrentUser();
    if (u?.role !== "ADMIN") { setLoading(false); return; }
    setAuthed(true);
    request<PageConfig>("/pagina/config", {}, false)
      .then(c => {
        // Deep merge with BLANK to ensure all required fields exist
        setCfg({
          ...BLANK,
          ...c,
          site: { ...BLANK.site, ...(c.site || {}) },
          menu: c.menu || BLANK.menu,
          hero: {
            ...BLANK.hero,
            ...(c.hero || {}),
            botao_primario: { ...BLANK.hero.botao_primario, ...(c.hero?.botao_primario || {}) },
            botao_secundario: { ...BLANK.hero.botao_secundario, ...(c.hero?.botao_secundario || {}) },
            estatisticas: c.hero?.estatisticas || BLANK.hero.estatisticas,
          },
          secoes: (c.secoes || []).map(s => ({
            ...s,
            titulo: s.titulo || "",
            itens: (s.itens || []).map(item => ({ titulo: item.titulo || "", descricao: item.descricao || "", icone: item.icone || "Shield" })),
            planos: (s.planos || []).map(p => ({ nome: p.nome || "", preco: p.preco || "", periodo: p.periodo || "", destaque: p.destaque || false, recursos: p.recursos || [] })),
          })),
          rodape: { ...BLANK.rodape, ...(c.rodape || {}), links: c.rodape?.links || BLANK.rodape.links },
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function salvar() {
    setSaving(true); setMsg(null);
    try {
      await request("/pagina/config", { method:"PUT", body: JSON.stringify({ conteudo: cfg }) }, true);
      setMsg({ tipo:"ok", texto:"Salvo! Recarregue a página inicial para ver." });
    } catch(e) { setMsg({ tipo:"erro", texto: e instanceof Error ? e.message : "Erro" }); }
    finally { setSaving(false); }
  }

  function setS<K extends keyof SiteConfig>(k:K, v:SiteConfig[K]) { setCfg(c=>({...c, site:{...c.site,[k]:v}})); }
  function setH<K extends keyof HeroConfig>(k:K, v:HeroConfig[K]) { setCfg(c=>({...c, hero:{...c.hero,[k]:v}})); }
  function setSecao(si:number, patch:Partial<Secao>) { setCfg(c=>{ const s=[...c.secoes]; s[si]={...s[si],...patch}; return {...c,secoes:s}; }); }

  async function handleImg(e:ChangeEvent<HTMLInputElement>, setter:(v:string)=>void) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 600_000) { setMsg({tipo:"erro",texto:"Imagem muito grande (máx 500 KB)"}); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result as string;
      try {
        const token = localStorage.getItem("pda_token");
        const res = await fetch(`${API_BASE_URL}/pagina/upload-imagem`, {
          method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},
          body: JSON.stringify({ nome: file.name, base64: b64 }),
        });
        if (!res.ok) { const e=await res.json().catch(()=>({detail:"Erro"})); setMsg({tipo:"erro",texto:e.detail}); return; }
        const data = await res.json();
        setter(data.base64);
        setMsg({tipo:"ok",texto:`Imagem: ${data.tamanho_kb} KB`});
      } catch { setMsg({tipo:"erro",texto:"Erro no upload"}); }
    };
    reader.readAsDataURL(file);
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-foreground-muted"/></div>;
  if (!authed) return <Card><CardContent className="p-8 text-center text-foreground-muted"><AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30"/>Acesso restrito a administradores.</CardContent></Card>;

  const ABAS = [{id:"site",label:"Site",icon:Settings},{id:"menu",label:"Menu",icon:Navigation},{id:"hero",label:"Hero",icon:Layout},{id:"secoes",label:"Seções",icon:Type},{id:"rodape",label:"Rodapé",icon:Globe}] as const;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Badge variant={"outline" as any} className="mb-2 gap-1"><Layout className="w-3 h-3"/>Admin</Badge>
          <h1 className="text-2xl font-bold">Editor da Página de Apresentação</h1>
          <p className="text-sm text-foreground-muted">Edite e clique em Salvar para publicar.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><a href="/" target="_blank" className="flex items-center gap-1.5"><Eye className="w-4 h-4"/>Visualizar</a></Button>
          <Button onClick={salvar} disabled={saving}>{saving?<><Loader2 className="w-4 h-4 animate-spin mr-1"/>Salvando...</>:<><Save className="w-4 h-4 mr-1"/>Salvar</>}</Button>
        </div>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${msg.tipo==="ok"?"bg-green-50 border-green-200 text-green-800":"bg-red-50 border-red-200 text-red-700"}`}>
          {msg.tipo==="ok"?<CheckCircle2 className="w-4 h-4 shrink-0"/>:<AlertCircle className="w-4 h-4 shrink-0"/>}
          {msg.texto}
          <button onClick={()=>setMsg(null)} className="ml-auto"><X className="w-4 h-4"/></button>
        </div>
      )}

      <div className="flex gap-1 flex-wrap border-b border-border pb-2">
        {ABAS.map(({id,label,icon:Icon})=>(
          <button key={id} type="button" onClick={()=>setAba(id as typeof aba)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t text-sm transition-colors ${aba===id?"bg-primary/10 text-primary border-b-2 border-primary":"text-foreground-muted hover:text-foreground"}`}>
            <Icon className="w-3.5 h-3.5"/>{label}
          </button>
        ))}
      </div>

      {aba==="site" && (
        <Card><CardHeader><CardTitle className="text-base">Configurações gerais</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Nome do sistema</Label><Input value={cfg.site.nome} onChange={e=>setS("nome",e.target.value)} className="mt-1"/></div>
              <div><Label>Subtítulo</Label><Input value={cfg.site.subtitulo} onChange={e=>setS("subtitulo",e.target.value)} className="mt-1"/></div>
              <div><Label>Cor primária</Label><div className="flex gap-2 mt-1"><input type="color" value={cfg.site.cor_primaria} onChange={e=>setS("cor_primaria",e.target.value)} className="w-10 h-9 rounded border border-input cursor-pointer"/><Input value={cfg.site.cor_primaria} onChange={e=>setS("cor_primaria",e.target.value)} className="flex-1 font-mono"/></div></div>
            </div>
            <ImgField label="Logo" value={cfg.site.logo_base64} onUp={e=>handleImg(e,v=>setS("logo_base64",v))} onClear={()=>setS("logo_base64","")}/>
          </CardContent>
        </Card>
      )}

      {aba==="menu" && (
        <Card><CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Menu de navegação</CardTitle><Button size="sm" variant="outline" onClick={()=>setCfg(c=>({...c,menu:[...c.menu,{label:"Novo",href:"#"}]}))}><Plus className="w-3.5 h-3.5 mr-1"/>Adicionar</Button></div></CardHeader>
          <CardContent className="space-y-2">
            {(cfg.menu || []).map((item,i)=>(
              <div key={i} className="flex gap-2 items-center">
                <GripVertical className="w-4 h-4 text-foreground-muted"/>
                <Input value={item.label} onChange={e=>{const m=[...cfg.menu];m[i]={...m[i],label:e.target.value};setCfg(c=>({...c,menu:m}));}} placeholder="Label" className="flex-1"/>
                <Input value={item.href} onChange={e=>{const m=[...cfg.menu];m[i]={...m[i],href:e.target.value};setCfg(c=>({...c,menu:m}));}} placeholder="#ancora ou /pagina" className="flex-1"/>
                <button onClick={()=>setCfg(c=>({...c,menu:c.menu.filter((_,j)=>j!==i)}))} className="p-1.5 hover:text-red-600 text-foreground-muted"><Trash2 className="w-4 h-4"/></button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {aba==="hero" && (
        <div className="space-y-4">
          <Card><CardHeader><CardTitle className="text-base">Seção hero (topo da página)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Título linha 1</Label><Input value={cfg.hero?.titulo ?? ""} onChange={e=>setH("titulo",e.target.value)} className="mt-1"/></div>
              <div><Label>Título destaque (linha 2, cor primária)</Label><Input value={cfg.hero?.titulo_destaque ?? ""} onChange={e=>setH("titulo_destaque",e.target.value)} className="mt-1"/></div>
              <div><Label>Subtítulo</Label><Input value={cfg.hero?.subtitulo ?? ""} onChange={e=>setH("subtitulo",e.target.value)} className="mt-1"/></div>
              <div><Label>Descrição</Label><textarea value={cfg.hero?.descricao ?? ""} onChange={e=>setH("descricao",e.target.value)} rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none"/></div>
              <ImgField label="Imagem / banner" value={cfg.hero?.imagem_base64 ?? ""} onUp={e=>handleImg(e,v=>setH("imagem_base64",v))} onClear={()=>setH("imagem_base64","")}/>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label>Botão principal — texto</Label><Input value={cfg.hero?.botao_primario?.texto ?? ""} onChange={e=>setH("botao_primario",{...cfg.hero.botao_primario,texto:e.target.value})} className="mt-1"/>
                  <Label className="mt-2 block">Link</Label><Input value={cfg.hero?.botao_primario?.href ?? ""} onChange={e=>setH("botao_primario",{...cfg.hero.botao_primario,href:e.target.value})} className="mt-1"/>
                </div>
                <div><Label>Botão secundário — texto</Label><Input value={cfg.hero?.botao_secundario?.texto ?? ""} onChange={e=>setH("botao_secundario",{...cfg.hero.botao_secundario,texto:e.target.value})} className="mt-1"/>
                  <Label className="mt-2 block">Link</Label><Input value={cfg.hero?.botao_secundario?.href ?? ""} onChange={e=>setH("botao_secundario",{...cfg.hero.botao_secundario,href:e.target.value})} className="mt-1"/>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card><CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Estatísticas</CardTitle>
            <Button size="sm" variant="outline" onClick={()=>setH("estatisticas",[...(cfg.hero?.estatisticas || []),{valor:"0",label:"Label"}])}><Plus className="w-3.5 h-3.5 mr-1"/>Adicionar</Button></div></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(cfg.hero?.estatisticas || []).map((s,i)=>(
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <Input value={s.valor} onChange={e=>{const ss=[...cfg.hero.estatisticas];ss[i]={...ss[i],valor:e.target.value};setH("estatisticas",ss);}} placeholder="Valor"/>
                    <Input value={s.label} onChange={e=>{const ss=[...cfg.hero.estatisticas];ss[i]={...ss[i],label:e.target.value};setH("estatisticas",ss);}} placeholder="Label"/>
                  </div>
                  <button onClick={()=>setH("estatisticas",cfg.hero.estatisticas.filter((_,j)=>j!==i))} className="p-1.5 hover:text-red-600 text-foreground-muted mt-0.5"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {aba==="secoes" && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {Object.entries(TIPO_LABELS).map(([tipo,label])=>(
              <Button key={tipo} size="sm" variant="outline" onClick={()=>{ const nova:Secao={id:`sec_${Date.now()}`,tipo,titulo:label,visivel:true,itens:tipo==="cards"?[{titulo:"Recurso",descricao:"Descrição",icone:"Shield"}]:undefined,planos:tipo==="precos"?[{nome:"Plano",preco:"R$ 0",periodo:"/mês",destaque:false,recursos:["Recurso 1"]}]:undefined}; setCfg(c=>({...c,secoes:[...c.secoes,nova]})); setAberta(nova.id); }}>
                <Plus className="w-3.5 h-3.5 mr-1"/>{label}
              </Button>
            ))}
          </div>
          {cfg.secoes.length===0&&<Card><CardContent className="p-8 text-center text-foreground-muted text-sm">Nenhuma seção. Clique em + para adicionar.</CardContent></Card>}
          {(cfg.secoes || []).map((sec,si)=>(
            <Card key={sec.id} className={sec.visivel?"":"opacity-60"}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical className="w-4 h-4 text-foreground-muted shrink-0"/>
                    <span className="font-medium text-sm truncate">{sec.titulo ?? ""}</span>
                    <Badge variant={"outline" as any} className="text-[10px] shrink-0">{TIPO_LABELS[sec.tipo]||sec.tipo}</Badge>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={()=>setSecao(si,{visivel:!sec.visivel})} className="p-1.5 hover:bg-background-secondary text-foreground-muted rounded">{sec.visivel?<Eye className="w-4 h-4"/>:<EyeOff className="w-4 h-4"/>}</button>
                    <button onClick={()=>setAberta(aberta===sec.id?null:sec.id)} className="p-1.5 hover:bg-background-secondary text-foreground-muted rounded">{aberta===sec.id?<ChevronUp className="w-4 h-4"/>:<ChevronDown className="w-4 h-4"/>}</button>
                    <button onClick={()=>setCfg(c=>({...c,secoes:c.secoes.filter(s=>s.id!==sec.id)}))} className="p-1.5 hover:text-red-600 text-foreground-muted rounded"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
              </CardHeader>
              {aberta===sec.id&&(
                <CardContent className="border-t border-border pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label>Título</Label><Input value={sec.titulo ?? ""} onChange={e=>setSecao(si,{titulo:e.target.value})} className="mt-1"/></div>
                    <div><Label>Subtítulo</Label><Input value={sec.subtitulo||""} onChange={e=>setSecao(si,{subtitulo:e.target.value})} className="mt-1"/></div>
                    <div><Label>ID / Âncora (ex: recursos)</Label><Input value={sec.id} onChange={e=>setSecao(si,{id:e.target.value})} className="mt-1 font-mono text-xs"/></div>
                    {sec.tipo==="texto"&&<div className="sm:col-span-2"><Label>Descrição</Label><textarea value={sec.descricao||""} onChange={e=>setSecao(si,{descricao:e.target.value})} rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none"/></div>}
                  </div>
                  {sec.tipo==="cards"&&(
                    <div className="space-y-2">
                      <div className="flex items-center justify-between"><Label>Cards</Label>
                        <Button size="sm" variant="outline" onClick={()=>setSecao(si,{itens:[...(sec.itens||[]),{titulo:"Novo",descricao:"",icone:"Shield"}]})}><Plus className="w-3 h-3 mr-1"/>Card</Button>
                      </div>
                      {(sec.itens||[]).map((item,ii)=>(
                        <div key={ii} className="p-3 rounded-lg border border-border space-y-2">
                          <div className="flex gap-2">
                            <Input value={item.titulo ?? ""} onChange={e=>{const it=[...(sec.itens||[])];it[ii]={...it[ii],titulo:e.target.value};setSecao(si,{itens:it});}} placeholder="Título" className="flex-1"/>
                            <select value={item.icone} onChange={e=>{const it=[...(sec.itens||[])];it[ii]={...it[ii],icone:e.target.value};setSecao(si,{itens:it});}} className={selectCls+" w-32"}>{ICONES.map(ic=><option key={ic}>{ic}</option>)}</select>
                            <button onClick={()=>setSecao(si,{itens:(sec.itens||[]).filter((_,j)=>j!==ii)})} className="p-1.5 hover:text-red-600 text-foreground-muted"><Trash2 className="w-4 h-4"/></button>
                          </div>
                          <textarea value={item.descricao} onChange={e=>{const it=[...(sec.itens||[])];it[ii]={...it[ii],descricao:e.target.value};setSecao(si,{itens:it});}} rows={2} className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm resize-none"/>
                        </div>
                      ))}
                    </div>
                  )}
                  {sec.tipo==="precos"&&(
                    <div className="space-y-2">
                      <div className="flex items-center justify-between"><Label>Planos</Label>
                        <Button size="sm" variant="outline" onClick={()=>setSecao(si,{planos:[...(sec.planos||[]),{nome:"Plano",preco:"R$ 0",periodo:"/mês",destaque:false,recursos:["Recurso"]}]})}><Plus className="w-3 h-3 mr-1"/>Plano</Button>
                      </div>
                      {(sec.planos||[]).map((pl,pi)=>(
                        <div key={pi} className="p-3 rounded-lg border border-border space-y-2">
                          <div className="flex gap-2 flex-wrap">
                            <Input value={pl.nome} onChange={e=>{const p=[...(sec.planos||[])];p[pi]={...p[pi],nome:e.target.value};setSecao(si,{planos:p});}} placeholder="Nome" className="flex-1 min-w-[100px]"/>
                            <Input value={pl.preco} onChange={e=>{const p=[...(sec.planos||[])];p[pi]={...p[pi],preco:e.target.value};setSecao(si,{planos:p});}} placeholder="Preço" className="w-28"/>
                            <Input value={pl.periodo} onChange={e=>{const p=[...(sec.planos||[])];p[pi]={...p[pi],periodo:e.target.value};setSecao(si,{planos:p});}} placeholder="/mês" className="w-20"/>
                            <label className="flex items-center gap-1 text-xs cursor-pointer"><input type="checkbox" checked={pl.destaque} onChange={e=>{const p=[...(sec.planos||[])];p[pi]={...p[pi],destaque:e.target.checked};setSecao(si,{planos:p});}} className="w-3.5 h-3.5 accent-primary"/>Destaque</label>
                            <button onClick={()=>setSecao(si,{planos:(sec.planos||[]).filter((_,j)=>j!==pi)})} className="p-1.5 hover:text-red-600 text-foreground-muted"><Trash2 className="w-4 h-4"/></button>
                          </div>
                          <p className="text-[10px] text-foreground-muted">Recursos (um por linha):</p>
                          <textarea value={pl.recursos.join("\n")} onChange={e=>{const p=[...(sec.planos||[])];p[pi]={...p[pi],recursos:e.target.value.split("\n")};setSecao(si,{planos:p});}} rows={4} className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm resize-none"/>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {aba==="rodape"&&(
        <Card><CardHeader><CardTitle className="text-base">Rodapé</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Texto</Label><Input value={cfg.rodape.texto} onChange={e=>setCfg(c=>({...c,rodape:{...c.rodape,texto:e.target.value}}))} className="mt-1"/></div>
            <div>
              <div className="flex items-center justify-between mb-2"><Label>Links</Label>
                <Button size="sm" variant="outline" onClick={()=>setCfg(c=>({...c,rodape:{...c.rodape,links:[...c.rodape.links,{label:"Link",href:"/"}]}}))}><Plus className="w-3.5 h-3.5 mr-1"/>Adicionar</Button>
              </div>
              {(cfg.rodape?.links || []).map((lk,i)=>(
                <div key={i} className="flex gap-2 items-center mb-2">
                  <Input value={lk.label} onChange={e=>{const l=[...cfg.rodape.links];l[i]={...l[i],label:e.target.value};setCfg(c=>({...c,rodape:{...c.rodape,links:l}}));}} placeholder="Label" className="flex-1"/>
                  <Input value={lk.href} onChange={e=>{const l=[...cfg.rodape.links];l[i]={...l[i],href:e.target.value};setCfg(c=>({...c,rodape:{...c.rodape,links:l}}));}} placeholder="/pagina" className="flex-1"/>
                  <button onClick={()=>setCfg(c=>({...c,rodape:{...c.rodape,links:c.rodape.links.filter((_,j)=>j!==i)}}))} className="p-1.5 hover:text-red-600 text-foreground-muted"><Trash2 className="w-4 h-4"/></button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ImgField({label,value,onUp,onClear}:{label:string;value:string;onUp:(e:ChangeEvent<HTMLInputElement>)=>void;onClear:()=>void}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div><Label>{label}</Label>
      <div className="mt-1 flex items-start gap-3">
        {value?(
          <div className="relative w-24 h-16 rounded-lg border border-border overflow-hidden shrink-0 bg-white">
            <img src={value} alt="" className="w-full h-full object-contain"/>
            <button type="button" onClick={onClear} className="absolute top-0.5 right-0.5 bg-background rounded-full p-0.5 border border-border"><X className="w-3 h-3 text-foreground-muted"/></button>
          </div>
        ):(
          <div className="w-24 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-foreground-muted shrink-0 text-xs">Sem img</div>
        )}
        <div className="space-y-1">
          <Button type="button" variant="outline" size="sm" onClick={()=>ref.current?.click()}><Upload className="w-3.5 h-3.5 mr-1"/>{value?"Trocar":"Enviar"}</Button>
          <p className="text-[10px] text-foreground-muted">PNG, JPG, WebP · máx 500 KB</p>
          <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onUp}/>
        </div>
      </div>
    </div>
  );
}
