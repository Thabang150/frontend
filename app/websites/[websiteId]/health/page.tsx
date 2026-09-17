import { AuthGuard } from '../../../../components/auth-guard';

export default function HealthPage() {
  return (
    <AuthGuard>
      <section className="page-placeholder">
        <p className="eyebrow">Website Health</p>
        <h2>Performance, SEO, accessibility, and security observations</h2>
        <p>Audit results and issue grouping will be implemented in the next stage.</p>
      </section>
    </AuthGuard>
  );
}
