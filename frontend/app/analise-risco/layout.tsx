/**
 * Layout da Análise de Risco — remove o padding do container padrão
 * para que o sticky tab bar funcione corretamente.
 * A página gerencia seu próprio layout.
 */
export default function AnaliseRiscoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}