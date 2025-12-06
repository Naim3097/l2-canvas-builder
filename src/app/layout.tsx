import './globals.css'

export const metadata = {
  title: 'X-IDE - Design Tool v2.0',
  description: 'Professional design tool like Figma & Adobe XD',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-[#0f0f0f] text-white h-screen w-screen overflow-hidden">{children}</body>
    </html>
  )
}
