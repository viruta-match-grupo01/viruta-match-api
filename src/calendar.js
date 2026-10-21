const HOUR=3600000;
// Buenos Aires UTC-3; las fechas persistidas siempre son ISO UTC.
const local = (date) => new Date(new Date(date).getTime()-3*HOUR);
const utc = (date) => new Date(date.getTime()+3*HOUR);
export const localDate = (date) => local(date).toISOString().slice(0,10);
export function createCalendar({days=[0,1,2,3,4,5,6],holidays=[]}={}) {
  if (!days.length || days.some(d=>!Number.isInteger(d)||d<0||d>6)) throw new Error('Calendario inválido');
  const isDay = (d) => days.includes(d.getUTCDay())&&!holidays.includes(d.toISOString().slice(0,10));
  function nextOpen(date) {
    let d=local(date);
    if (!Number.isFinite(d.getTime())) throw new Error('Fecha inválida');
    for (let n=0;n<3700;n++) {
      const hour=d.getUTCHours()+d.getUTCMinutes()/60+d.getUTCSeconds()/3600+d.getUTCMilliseconds()/3600000;
      if (isDay(d)&&hour<20) {
        if (hour<8) d.setUTCHours(8,0,0,0);
        return utc(d);
      }
      d.setUTCDate(d.getUTCDate()+1);d.setUTCHours(8,0,0,0);
    }
    throw new Error('No existe próximo día de atención');
  }
  function nextDayOpen(date) {const d=local(date);d.setUTCDate(d.getUTCDate()+1);d.setUTCHours(8,0,0,0);return nextOpen(utc(d));}
  function isOpen(date) {return nextOpen(date).getTime()===new Date(date).getTime();}
  function addHours(date,hours) {
    if (!Number.isFinite(hours)||hours<0) throw new Error('Horas inválidas');
    let d=nextOpen(date),remaining=hours*HOUR;
    while(remaining>0) {
      const end=local(d);end.setUTCHours(20,0,0,0);
      const available=utc(end).getTime()-d.getTime();
      if(remaining<=available) return new Date(d.getTime()+remaining);
      remaining-=available;d=nextDayOpen(d);
    }
    return d;
  }
  function plusDays(date,daysCount) {const d=local(date);d.setUTCDate(d.getUTCDate()+daysCount);return utc(d);}
  return {nextOpen,nextDayOpen,isOpen,addHours,plusDays,localDate};
}
