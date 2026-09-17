import { AuthGuard } from '../../../../../components/auth-guard';

export default function TrackingSettingsPage() {
  return (
    <AuthGuard>
      <section className="page-placeholder">
        <p className="eyebrow">Tracking</p>
        <h2>Installation snippet and verification</h2>
        <p>Tracking setup and verification will be implemented in the next stage.</p>
      </section>
    </AuthGuard>
  );
}
