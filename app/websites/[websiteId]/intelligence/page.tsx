import { AuthGuard } from '../../../../components/auth-guard';

export default function IntelligencePage() {
  return (
    <AuthGuard>
      <section className="page-placeholder">
        <p className="eyebrow">Intelligence</p>
        <h2>Signals and recommendations</h2>
        <p>Deterministic insights and evidence-based recommendations will be added in the next stage.</p>
      </section>
    </AuthGuard>
  );
}
