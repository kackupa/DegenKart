import {TRACK, ROAD_HALF_WIDTH} from "./circuit.ts";

// Camera framing is derived from the same world geometry as the race.
export function stadiumProjection(width:number,height:number) {
  const margin=ROAD_HALF_WIDTH+28;
  const minX=Math.min(...TRACK.map(p=>p.x))-margin;
  const maxX=Math.max(...TRACK.map(p=>p.x))+margin;
  const minZ=Math.min(...TRACK.map(p=>p.z))-margin;
  const maxZ=Math.max(...TRACK.map(p=>p.z))+margin;
  const tilt=.68;
  const scale=Math.min((width-64)/(maxX-minX),(height-100)/((maxZ-minZ)*tilt));
  return {scale,tilt,project:(x:number,z:number)=>({x:width/2+(x-(minX+maxX)/2)*scale,y:height/2+15-(z-(minZ+maxZ)/2)*scale*tilt})};
}
export function shouldPauseOnBlur(controlledId:number) {return controlledId>=0;}
