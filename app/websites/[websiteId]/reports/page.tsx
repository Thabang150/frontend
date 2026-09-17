import { AuthGuard } from '../../../../components/auth-guard';

export default function ReportsPage() {
  return (
    <AuthGuard>
      <section className="page-placeholder">
        <p className="eyebrow">Reports</p>
        <h2>Report history and distribution</h2>
        <p>Monthly reports and delivery controls will be implemented in the next stage.</p>
      </section>
    </AuthGuard>
  );
}
