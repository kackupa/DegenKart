// Original code-native pixel artwork. Coordinates are a 64 × 64 logical grid.
// Kept independent of physics so the same art works in every camera.
export function drawKartSprite(c:CanvasRenderingContext2D,id:number,color:string,angle:number,frame=0){
  const front=Math.cos(angle)<-.35,side=Math.abs(Math.sin(angle))>.45;
  const ink="#101624",metal="#899bad",light="#edf1d5";
  const rect=(x:number,y:number,w:number,h:number,fill:string)=>{c.fillStyle=fill;c.fillRect(x,y,w,h);};
  c.save();if(side&&Math.sin(angle)<0){c.translate(64,0);c.scale(-1,1);}
  // Wide rubber tyres, tread animation and a visible chassis.
  rect(8,50,48,10,ink);rect(4,38,12,20,ink);rect(48,38,12,20,ink);
  rect(5,40,3,15,"#344454");rect(55,40,3,15,"#344454");
  for(let y=41+(frame%2)*3;y<56;y+=6){rect(5,y,5,2,"#5d6f7b");rect(54,y,5,2,"#5d6f7b");}
  rect(12,32,8,13,ink);rect(44,32,8,13,ink);
  rect(14,37,36,19,ink);rect(11,42,42,11,color);rect(17,35,30,18,color);
  rect(16,37,3,11,light);rect(20,36,24,3,light);rect(14,49,36,5,"#263448");
  rect(21,39,22,8,"#101c2b");rect(24,39,16,4,"#617381");
  // Seat and driving suit; the head is exaggerated for readability at distance.
  rect(20,26,24,16,ink);rect(22,28,20,12,id===2?"#247a63":id===3?"#6a459a":"#33465b");
  rect(17,32,7,8,"#d69a78");rect(40,32,7,8,"#d69a78");
  rect(21,7,23,22,ink);rect(18,11,29,14,ink);rect(23,5,18,4,ink);
  const skin=id===1?"#dbab7c":"#e9b08a";
  rect(21,10,23,16,skin);rect(24,25,16,5,"#b76f55");
  rect(23,11,15,4,"#ffdab1");rect(19,17,3,6,skin);rect(44,17,3,6,skin);
  if(id===3){
    rect(20,9,25,19,"#7249ac");rect(24,5,17,6,"#9872d4");rect(18,15,4,12,"#513679");
    rect(24,12,17,13,front||side?ink:"#8457bc");
    if(front||side){rect(26,18,4,2,"#bdffe9");rect(35,18,4,2,"#bdffe9");}
    rect(25,28,15,3,"#b89adb");
  }else{
    const hair=id===1?"#282d30":id===2?"#27232c":"#624035";
    rect(22,7,21,id===1?5:8,hair);rect(19,11,5,id===2?17:9,hair);rect(41,10,5,id===2?18:8,hair);
    if(id===0){rect(26,4,16,5,hair);rect(31,3,9,3,hair);rect(23,8,13,3,"#a16b48");}
    if(id===2){rect(24,6,18,4,"#41313b");rect(18,22,5,8,hair);rect(42,23,5,8,hair);}
    if(!front&&!side){rect(22,11,21,13,hair);rect(25,23,15,3,hair);rect(24,12,3,9,id===0?"#87523c":"#414147");}
    else{
      const offset=side?4:0;
      rect(24+offset,17,4,2,ink);rect(35+offset,17,4,2,ink);
      rect(31+offset,20,3,3,"#bd7b5e");rect(28+offset,25,10,2,id===2?"#55403a":"#914f43");
      if(id===1){rect(22+offset,15,9,6,ink);rect(33+offset,15,9,6,ink);rect(30+offset,16,4,2,ink);rect(24+offset,16,5,3,"#b7d9d7");rect(35+offset,16,5,3,"#b7d9d7");}
    }
  }
  if(front){
    rect(16,46,32,9,color);rect(28,46,8,9,light);rect(12,53,40,4,metal);
    rect(15,48,7,3,"#fff0aa");rect(42,48,7,3,"#fff0aa");
  }else{
    // Rear wing, engine cooling fins, exhausts and bright tail lamps.
    rect(17,43,3,9,metal);rect(44,43,3,9,metal);rect(9,44,46,5,ink);rect(11,43,42,3,color);
    rect(23,49,18,7,metal);for(let x=25;x<40;x+=4)rect(x,49,2,6,ink);
    rect(14,53,8,4,"#ff6765");rect(42,53,8,4,"#ff6765");
    rect(19,56,6,4,metal);rect(39,56,6,4,metal);rect(20,57,4,3,ink);rect(40,57,4,3,ink);
  }
  c.restore();
}

export function drawPalm(c:CanvasRenderingContext2D,w:number,h:number){
  c.save();c.scale(w/48,h/64);
  c.fillStyle="#543d38";c.fillRect(23,20,6,44);c.fillStyle="#bc8955";c.fillRect(23,23,2,41);
  for(let y=30;y<62;y+=7){c.fillStyle="#76553f";c.fillRect(23,y,6,2);}
  const leaves=[[3,16,23,6],[0,22,13,5],[6,10,18,5],[13,5,13,6],[23,10,19,6],[32,16,16,6],[39,22,9,5],[20,2,6,16],[14,21,10,7],[10,27,8,5]];
  leaves.forEach(([x,y,l,t],i)=>{c.fillStyle=i%2?"#65b775":"#347e65";c.fillRect(x,y,l,t);});
  c.fillStyle="#95d58b";c.fillRect(9,12,12,2);c.fillRect(27,12,11,2);c.restore();
}
