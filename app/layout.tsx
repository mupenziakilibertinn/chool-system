import "./globals.css";

export const metadata = {
  title: "New Generation School Management System",
  description: "Terminal Progress Analytics Panel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          @media print {
            .no-print { display: none !important; }
            .report-only { display: block !important; }
            body { background: white; color: black; padding: 0; margin: 0; }
            .page-break { page-break-after: always; break-after: page; }
          }
          @media screen {
            .report-only { display: none !important; }
          }
        `}</style>
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}