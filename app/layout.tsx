import type { Metadata } from 'next';
import './styles.css';
import { AuthProvider } from '../components/auth-provider';

export const metadata: Metadata = {
  title: 'TMTR20 Website Intelligence',
  description: 'Website performance and analytics workspace',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
