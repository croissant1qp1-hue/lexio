import Navbar from "./components/navbar/navbar";


export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de">
      <body>
        <div className="container">
          <Navbar />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
