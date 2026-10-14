import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "ThesiSHS AI",
        short_name: "ThesiSHS",
        description: "Senior High School research management system.",
        start_url: "/dashboard",
        scope: "/",
        display: "standalone",
        theme_color: "#f6f8fb",
        background_color: "#f6f8fb",
        icons: [
            { src: "/icons/thesishs-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icons/thesishs-512.png", sizes: "512x512", type: "image/png" },
        ],
    };
}
