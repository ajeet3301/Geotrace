/* GeoTrace — js/geo.js */
'use strict';

async function extractExif(file){
  try{
    const tags=await exifr.parse(file,{gps:true,tiff:true,exif:true,
      pick:['Make','Model','DateTimeOriginal','GPSLatitude','GPSLongitude','GPSLatitudeRef','GPSLongitudeRef',
            'FNumber','ExposureTime','ISOSpeedRatings','FocalLength','ImageWidth','ImageHeight','Software']})||{};
    const r={hasGPS:false,latitude:null,longitude:null,camera:null,dateTaken:null,
      fNumber:tags.FNumber?`f/${tags.FNumber}`:null,
      exposure:tags.ExposureTime?`1/${Math.round(1/tags.ExposureTime)}s`:null,
      iso:tags.ISOSpeedRatings||null,focal:tags.FocalLength?`${tags.FocalLength}mm`:null,
      width:tags.ImageWidth||null,height:tags.ImageHeight||null,software:tags.Software||null};
    if(tags.Make||tags.Model) r.camera=[tags.Make,tags.Model].filter(Boolean).join(' ');
    if(tags.DateTimeOriginal) r.dateTaken=new Date(tags.DateTimeOriginal);
    if(tags.GPSLatitude&&tags.GPSLongitude){
      r.hasGPS=true;
      r.latitude =tags.GPSLatitude *(tags.GPSLatitudeRef ==='S'?-1:1);
      r.longitude=tags.GPSLongitude*(tags.GPSLongitudeRef==='W'?-1:1);
    }
    return r;
  }catch(e){console.warn('EXIF:',e);return{hasGPS:false}}
}

function fileToBase64(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>res(r.result.split(',')[1]); r.onerror=rej;
    r.readAsDataURL(file);
  });
}

async function analyzeWithAI(file,apiKey){
  const model=window.APP_CONFIG?.anthropicModel||'claude-sonnet-4-6';
  const b64=await fileToBase64(file);
  const mime=file.type||'image/jpeg';
  const prompt=`Analyze this photo and determine where it was taken.
Return ONLY a JSON object (no markdown, no extra text):
{"country":"name or null","region":"state/province or null","city":"city or null","confidence":0-100,"latitude":decimal or null,"longitude":decimal or null,"source":"ai_visual","reasoning":"brief explanation max 3 sentences"}
Base analysis on: architecture, landscape, signage, vegetation, vehicles, cultural markers. If uncertain, set fields to null.`;

  const resp=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':apiKey,
      'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model,max_tokens:600,messages:[{role:'user',content:[
      {type:'image',source:{type:'base64',media_type:mime,data:b64}},
      {type:'text',text:prompt}
    ]}]})
  });
  if(!resp.ok){const e=await resp.json().catch(()=>({}));throw new Error(`API error ${resp.status}: ${e.error?.message||resp.statusText}`)}
  const data=await resp.json();
  const raw=(data.content?.[0]?.text||'{}').replace(/```json|```/g,'').trim();
  try{return JSON.parse(raw)}
  catch{const m=raw.match(/\{[\s\S]*\}/);if(m)return JSON.parse(m[0]);throw new Error('Could not parse AI response')}
}

const _geoCache={};
async function reverseGeocode(lat,lon){
  const k=`${lat.toFixed(3)},${lon.toFixed(3)}`;
  if(_geoCache[k])return _geoCache[k];
  try{
    const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,{headers:{'Accept-Language':'en'}});
    const d=await r.json();
    const addr=d.display_name?.split(',').slice(0,4).join(',').trim()||`${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    _geoCache[k]={display:addr,country:d.address?.country,state:d.address?.state,city:d.address?.city||d.address?.town||d.address?.village};
    return _geoCache[k];
  }catch{return{display:`${lat.toFixed(4)}, ${lon.toFixed(4)}`,country:null,state:null,city:null}}
}

async function saveSearch(uid,file,exif,aiResult,geocoded){
  if(!window._db)return null;
  try{
    const ref=await window._db.collection('searches').add({
      uid,timestamp:firebase.firestore.FieldValue.serverTimestamp(),
      fileName:file.name,fileSize:file.size,fileType:file.type,
      exif:{hasGPS:exif.hasGPS||false,latitude:exif.latitude||null,longitude:exif.longitude||null,
        camera:exif.camera||null,dateTaken:exif.dateTaken?firebase.firestore.Timestamp.fromDate(exif.dateTaken):null},
      result:aiResult,geocoded
    });
    await window._db.collection('users').doc(uid).set(
      {searchCount:firebase.firestore.FieldValue.increment(1),lastSearch:firebase.firestore.FieldValue.serverTimestamp()},
      {merge:true});
    return ref.id;
  }catch(e){console.warn('Firestore save:',e);return null}
}

window.GT_Geo={extractExif,analyzeWithAI,reverseGeocode,saveSearch};
