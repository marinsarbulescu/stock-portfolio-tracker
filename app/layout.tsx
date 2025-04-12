import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./app.css";
import './globals.css';
import '@aws-amplify/ui-react/styles.css';
import ConfigureAmplifyClientSide from '@/app/components/ConfigureAmplifyClientSide'; // Adjust path if neede

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Stocks Portfolio App', // Updated title
  description: 'Track your stock portfolio',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
      {/* Configure Amplify client side */}
      <ConfigureAmplifyClientSide />

      {/* Render children directly or within a main tag */}
      <main style={{ padding: '0 1rem' }}>
        {children}
      </main>

    </body>
    </html>
  );
}
