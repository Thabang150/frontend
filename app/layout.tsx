import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: 'TMTR20 Website Intelligence',
  description: 'Website performance and analytics workspace',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
