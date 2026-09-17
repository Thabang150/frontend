import { AuthGuard } from '../../../../../components/auth-guard';

export default function WebsiteSettingsPage() {
  return (
    <AuthGuard>
      <section className="page-placeholder">
        <p className="eyebrow">Website</p>
        <h2>Website configuration</h2>
        <p>Website settings will be implemented in the next stage.</p>
      </section>
    </AuthGuard>
  );
}
