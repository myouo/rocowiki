import React from "react";
import { PreviewHeader } from "../../wiki/core";
export default function Navbar() {
  // The native TOC measures .navbar to keep active headings below the header.
  return <PreviewHeader className="navbar" />;
}
