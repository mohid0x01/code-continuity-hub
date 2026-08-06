const body = `[out:json][timeout:40];way[building](around:300,24.8615984,67.0290744);out geom;`;
for (const h of [{}, {"User-Agent":"SceneIQ/1.0 (forensic reconstruction; contact admin@sceneiq.gov.pk)"}]) {
  const res = await fetch("https://overpass-api.de/api/interpreter", { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded", "Accept":"application/json", ...h }, body:"data="+encodeURIComponent(body)});
  console.log(JSON.stringify(h), res.status, (await res.text()).slice(0,120).replace(/\n/g," "));
}
