import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WWFS 管理驾驶舱",
    short_name: "WWFS 管理",
    description: "Wallace Wang Financial Services 各部门经营数据总览",
    start_url: "/",
    display: "standalone",
    background_color: "#1e40af",
    theme_color: "#1d4ed8",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
