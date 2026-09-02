import './globals.css';

export const metadata = {
  title: 'Shree Optical RX Order Manager',
  description: 'Shared RX order management for Shree Optical',
  icons: { icon: '/logo.png', shortcut: '/logo.png', apple: '/logo.png' }
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
