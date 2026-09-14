import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath} from "node:url";

const base="/DegenKart/";
const path=(relative:string)=>fileURLToPath(new URL(relative,import.meta.url));
export default defineConfig({
  root:path("./pages"),
  base,
  publicDir:path("./public"),
  resolve:{alias:{"next/link":path("./pages/link.tsx")}},
  plugins:[react(),{
    name:"pages-public-asset-paths",
    // Canvas Image.src and profile strings are not rewritten by Vite's HTML pipeline.
    transform(code,id){
      if(!id.replaceAll("\\","/").includes("/app/"))return;
      return code.replace(/(["'])\/(assets\/|art\/)/g,`$1${base}$2`);
    },
  }],
  build:{outDir:path("./dist-pages"),emptyOutDir:true},
});
