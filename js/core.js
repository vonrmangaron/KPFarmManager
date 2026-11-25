/* Shared by ProdWise, Tasks (cluckwise/index.html) and Crew (cluckwise/viewer.html).
   One copy of the helpers every app needs, so a fix lands in all three at once (step 1 of merging the apps, 25 Nov 2026).
   Only plain functions: no app state, no page elements. Each app's own scripts run inside their own scope and may still
   define a function with the same name, which wins there, so add a helper here only once every copy is removed. */

// Midnight of the same day on this device's clock.
function dateOnly(d){const x=new Date(d);x.setHours(0,0,0,0);return x;}

// 'YYYY-MM-DD' of a date on this device's clock.
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}

// Shed dates (placement, clean-out, pickups…) are calendar days. They used to be saved as local midnight, which is a
// different UTC time on every device clock (east of UTC it is the evening before in UTC), so a device on another
// clock read them a day out and saved them back moved (batch 2702, 25 Nov 2026). calDate reads any of them as the right day:
// after 12:00 UTC it's local midnight from east of UTC, i.e. the next day. calJson saves the day as 12:00 UTC, which every
// clock from UTC-11 to UTC+11 (and older app versions) reads as the same day.
function calDate(v){
  if(v==null||v==='')return null;
  if(typeof v==='string'){
    let m=v.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(m)return new Date(+m[1],+m[2]-1,+m[3]);
    m=v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]00:?00)$/);
    if(m){const h=+m[4],mi=+m[5];return new Date(+m[1],+m[2]-1,+m[3]+(h>12||(h===12&&mi>0)?1:0));}
  }
  return dateOnly(v);
}
function calJson(d){if(!d)return null;const x=dateOnly(d);return isNaN(x.getTime())?null:new Date(Date.UTC(x.getFullYear(),x.getMonth(),x.getDate(),12)).toISOString();}
// The same calendar day as a 'YYYY-MM-DD' key (what Tasks stores), or null.
function prodDay(v){if(!v)return null;const d=calDate(v);return d&&!isNaN(d.getTime())?dateKey(d):null;}

// 12-hour clock everywhere, same style on every device: "3 PM", "3:05 PM".
function fmt12(d,withMinutes){const h=d.getHours(),m=d.getMinutes(),hh=h%12||12,ap=h<12?'AM':'PM';return withMinutes===false?`${hh} ${ap}`:`${hh}:${String(m).padStart(2,'0')} ${ap}`;}

// Text that's safe inside HTML and attributes. null/undefined → ''.
function escapeHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
