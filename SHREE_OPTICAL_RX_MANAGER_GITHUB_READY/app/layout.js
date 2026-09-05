import './globals.css';

export const metadata = {
  title: 'Shree Optical RX Order Manager',
  description: 'Shared SIZAL and Glass RX order management for Shree Optical',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
