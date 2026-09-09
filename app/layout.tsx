import React from "react";
import "@/app/global.css";
import "@/components/navbar/side-bar.css";
import Navbar from "@/components/navbar/navbar";
import "./main-body.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css" />
      </head>
      <body>
        <div className="container">
          <Navbar />
          <main className="main-body">{children}</main>
        </div>
      </body>
    </html>
  );
}
