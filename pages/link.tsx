import type {AnchorHTMLAttributes} from "react";

// The standalone game has a single route, with no Next.js server required.
export default function Link({href,...props}:AnchorHTMLAttributes<HTMLAnchorElement>){
  return <a {...props} href={href==="/"?"./":href}/>;
}
