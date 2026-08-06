const UA="SceneIQ/1.0 (test)";
async function q(out:string){
 const body=`[out:json][timeout:25];(way["building"](around:300,24.8615984,67.0290744);way["highway"](around:300,24.8615984,67.0290744););${out}`;
 const r=await fetch("https://overpass-api.de/api/interpreter",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json","User-Agent":UA},body:"data="+encodeURIComponent(body)});
 if(!r.ok){console.log(out,r.status);return;}
 const j:any=await r.json();
 const els=j.elements??[];
 console.log(out,"els",els.length,"withGeom",els.filter((e:any)=>e.geometry).length,"withCenter",els.filter((e:any)=>e.center).length);
}
await q("out geom tags center;");
await q("out geom;");
