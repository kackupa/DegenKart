import type {Racer} from "./simulation";

// Vector effects remain crisp at both stadium-marker and close chase-camera sizes.
export function drawSpecial(c:CanvasRenderingContext2D,r:Racer,time:number,w:number,h:number){
  const fx=r.specialFx;if(!fx)return;
  const t=time-fx.start;if(t<0||t>1.1)return;
  c.save();c.scale(w/160,h/160);c.lineJoin="round";c.lineCap="round";
  c.globalAlpha=Math.min(1,(1.1-t)*4);
  if(fx.kind==="chord"){
    c.strokeStyle="#adff52";c.lineWidth=4;
    for(let i=0;i<3;i++){const radius=15+((t+i*.16)%1)*145;c.beginPath();c.ellipse(80,100,radius,radius*.45,0,0,Math.PI*2);c.stroke();}
    c.fillStyle="#f4ffb2";c.font="bold 28px monospace";
    for(let i=0;i<4;i++)c.fillText(i%2?"♫":"♪",15+i*38,30-Math.sin(t*8+i)*15);
  }
  if(fx.kind==="seas"){
    const spread=Math.min(1,t*6),wave=Math.sin(t*15)*5;
    for(const side of [-1,1]){
      c.save();c.translate(80+side*(35+spread*70),0);c.scale(side,1);
      c.fillStyle="#087da9";c.strokeStyle="#95f6ff";c.lineWidth=3;
      c.beginPath();c.moveTo(0,160);c.lineTo(0,20+wave);c.bezierCurveTo(-35,-25,-45,20,-18,33);c.bezierCurveTo(5,45,8,85,30,160);c.closePath();c.fill();c.stroke();
      c.strokeStyle="#caffff";c.lineWidth=2;
      for(let i=0;i<5;i++){c.beginPath();c.moveTo(4+i*3,55+i*18);c.lineTo(13+i*3,65+i*18+wave);c.stroke();}
      c.restore();
    }
  }
  if(fx.kind==="claw"&&!fx.caster){
    const rise=t<.2?Math.sin(t/.2*Math.PI)*24:0;
    const retract=t>.35?(t-.35)*230:0;
    c.translate(80,-rise-retract);c.strokeStyle="#142331";c.lineWidth=12;
    c.beginPath();c.moveTo(0,-110);c.lineTo(0,0);c.stroke();
    c.strokeStyle="#a4b9c8";c.lineWidth=5;c.stroke();
    c.fillStyle="#f7bc42";c.fillRect(-23,-8,46,20);
    c.fillStyle="#293c50";for(let i=0;i<4;i++)c.fillRect(-20+i*12,-8,5,20);
    for(const side of [-1,1]){
      c.strokeStyle="#1b293b";c.lineWidth=12;c.beginPath();c.moveTo(side*18,7);c.lineTo(side*48,35);c.lineTo(side*34,62);c.lineTo(side*19,66);c.stroke();
      c.strokeStyle="#bedde8";c.lineWidth=6;c.stroke();
      c.fillStyle="#58eaff";c.beginPath();c.arc(side*48,35,5,0,Math.PI*2);c.fill();
    }
  }
  if(fx.kind==="balls"&&!fx.caster){
    // Deliberately cartoon anatomy: a two-lobed scrotum, no explicit detail.
    const drop=Math.min(1,t/.07),bounce=t<.2?Math.sin(t*40)*5:-(t-.2)*75;
    c.translate(80,-65+drop*83+bounce);c.scale(1+Math.max(0,.2-t)*.9,1-Math.max(0,.2-t)*.7);
    c.fillStyle="#df9d83";c.strokeStyle="#714b52";c.lineWidth=3;
    c.beginPath();c.moveTo(-10,-30);c.quadraticCurveTo(-12,-8,-27,0);c.bezierCurveTo(-54,12,-41,57,-14,54);c.quadraticCurveTo(0,52,0,43);c.quadraticCurveTo(4,58,23,54);c.bezierCurveTo(51,49,51,12,27,0);c.quadraticCurveTo(12,-10,10,-30);c.closePath();c.fill();c.stroke();
    c.beginPath();c.moveTo(0,12);c.quadraticCurveTo(-5,29,0,43);c.stroke();
    c.strokeStyle="#ffd3b1";c.lineWidth=4;c.beginPath();c.moveTo(-30,18);c.quadraticCurveTo(-36,34,-23,40);c.stroke();
    if(t<.35){c.strokeStyle="#fff2ad";for(let i=0;i<7;i++){const a=i*Math.PI*2/7;c.beginPath();c.moveTo(Math.cos(a)*57,25+Math.sin(a)*45);c.lineTo(Math.cos(a)*72,25+Math.sin(a)*58);c.stroke();}}
  }
  c.restore();
}
