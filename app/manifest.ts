import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "ThesiSHS AI",
        short_name: "ThesiSHS",
        description: "Senior High School research management system.",
        start_url: "/dashboard",
        scope: "/",
        display: "standalone",
        theme_color: "#f5f3ea",
        background_color: "#f5f3ea",
        icons: [
            { src: "/icons/thesishs-192.png?v=2", sizes: "192x192", type: "image/png" },
            { src: "/icons/thesishs-512.png?v=2", sizes: "512x512", type: "image/png" },
        ],
    };
}
