// Clima do Órbita (7ª área, pedido do Alediov em 02/11/2026): as contas puras, sem tela nem estado (dá para testar no
// node: `node tools/teste_clima.mjs`). As respostas das fontes (Open-Meteo, a principal, e MET Norway, a reserva) viram
// um formato só:
//   { fonte, lugar {nome, regiao, lat, lon, fuso}, em (ISO da busca), offset (s do fuso do lugar),
//     agora {hora, t, sens, umid, orvalho, pressao, vento, rajada, dir, nuvens, vis, uv, mm, cod, dia},
//     horas [{h "AAAA-MM-DDTHH:00" (hora local do lugar), t, sens, prob, mm, cod, dia, vento, uv}],
//     dias [{d, max, min, prob, mm, cod, nascer, por ("AAAA-MM-DDTHH:MM" local), uv, vento, rajada, dir}],
//     ar {aqi, pm25, pm10} | null }
// Temperatura em °C, vento em km/h, pressão em hPa, visibilidade em m, chuva em mm, probabilidade em %.

export const PADRAO = { nome: "Cascavel", regiao: "Paraná", pais: "BR", lat: -24.9555, lon: -53.4552, fuso: "America/Sao_Paulo" };
// Casa, Faculdade e HUOP (pedido do Alediov, 03/11/2026): os padrões dos dois lugares fixos. A Faculdade é a clínica de
// Odontologia da UNIOESTE (a mesma coordenada de scan/geo.js `CLINICA`; o CEO fica nela); o HUOP, o Hospital
// Universitário do Oeste do Paraná (Av. Tancredo Neves, 3224, Santo Onofre), pelo mapa da página dele no Doctoralia.
export const FACULDADE = { nome: "UNIOESTE", regiao: "Paraná", pais: "BR", lat: -24.988, lon: -53.451, fuso: "America/Sao_Paulo" };
export const HUOP = { nome: "HUOP", regiao: "Paraná", pais: "BR", lat: -24.97438, lon: -53.4941, fuso: "America/Sao_Paulo" };
/**
 * O lugar que a tela mostra numa hora ("HH:MM") do dia: a escolha à mão (`manual`) vale; senão, com ida e volta da Agenda
 * (`trajetos` com `agenda`), do horário da ida ao da volta a Faculdade (ou o HUOP, num dia com HUOP) e a Casa no resto;
 * sem Agenda (ou sem compromisso presencial), a Casa.
 */
export function lugarDaHora({ hm, trajetos = [], manual = null }) {
  if (manual) return manual;
  const ida = trajetos.find(t => t.quando === "ida" && t.agenda), volta = trajetos.find(t => t.quando === "volta" && t.agenda);
  if (ida && volta && hm >= ida.hora && hm < volta.hora) return volta.huop ? "huop" : "faculdade";
  return "casa";
}
/**
 * Coordenadas coladas ou um link de mapa → {lat, lon} (null se não achar ou fora da faixa). Aceita "-24.95, -53.45",
 * "-24,95 -53,45", "-24.95,-53.45" e links do Google Maps (o alfinete "!3d…!4d…", "?q=", "query=", "ll=",
 * "destination=" e o "@lat,lon" do centro do mapa, nessa ordem de preferência), com ou sem %2C.
 */
export function lerCoordenadas(txt) {
  let t = String(txt || "");
  try { t = decodeURIComponent(t.replace(/%(?![0-9a-f]{2})/gi, "%25")); } catch { /* fica como veio */ }
  t = t.replace(/\+/g, " ").trim();
  if (!t) return null;
  const n = (x) => +String(x).replace(",", ".");
  const ok = (la, lo) => Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180 && !(la === 0 && lo === 0) ? { lat: Math.round(la * 1e6) / 1e6, lon: Math.round(lo * 1e6) / 1e6 } : null;
  const num = "(-?\\d{1,3}(?:\\.\\d+)?)";
  for (const re of [new RegExp(`!3d${num}!4d${num}`), new RegExp(`[?&](?:q|query|ll|destination|daddr)=(?:loc:)?\\s*${num}\\s*,\\s*${num}`, "i"), new RegExp(`@${num},${num}`)]) {
    const m = t.match(re); if (m) return ok(n(m[1]), n(m[2]));
  }
  if (/^https?:|maps\./i.test(t)) return null; // link sem coordenadas (link curto: abra e copie o da barra)
  const m = t.match(/^\(?\s*(-?\d{1,3}(?:[.,]\d+)?)\s*°?\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*°?\s*\)?$/);
  return m ? ok(n(m[1]), n(m[2])) : null;
}

// ---------------------------------------------------------------- as URLs (todas gratuitas e sem chave)
const r4 = (n) => Math.round(n * 1e4) / 1e4;
export function urlOpenMeteo(l) {
  const atual = "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m";
  const hora = "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,is_day,wind_speed_10m,uv_index,dew_point_2m,visibility,pressure_msl";
  const dia = "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant";
  return `https://api.open-meteo.com/v1/forecast?latitude=${r4(l.lat)}&longitude=${r4(l.lon)}&current=${atual}&hourly=${hora}&daily=${dia}&timezone=auto&forecast_days=14`;
}
export const urlAr = (l) => `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${r4(l.lat)}&longitude=${r4(l.lon)}&hourly=us_aqi,pm10,pm2_5&timezone=auto&forecast_days=2`;
export const urlBusca = (nome) => `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nome)}&count=8&language=pt&format=json`;
export const urlMET = (l) => `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${r4(l.lat)}&lon=${r4(l.lon)}`;

// ---------------------------------------------------------------- horas locais
const pad = (n) => String(n).padStart(2, "0");
/** "AAAA-MM-DDTHH:MM" no fuso do lugar (pelo deslocamento em segundos). */
export const localISO = (ms, offset) => new Date(ms + offset * 1000).toISOString().slice(0, 16);
/** De volta: a hora local do lugar em milissegundos (UTC). */
export const msDe = (iso, offset) => Date.parse(iso.slice(0, 16) + ":00Z") - offset * 1000;
/** O deslocamento de um fuso (IANA) agora, em segundos; sem Intl ou fuso desconhecido, o do aparelho. */
export function offsetDoFuso(fuso, ms = Date.now()) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: fuso, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(ms)).map(x => [x.type, x.value]));
    const como = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return Math.round((como - Math.floor(ms / 1000) * 1000) / 60000) * 60;
  } catch { return -new Date(ms).getTimezoneOffset() * 60; }
}
export const horaDe = (iso) => +iso.slice(11, 13);
export const rotuloHora = (iso) => { const h = horaDe(iso), m = iso.slice(14, 16); return m && m !== "00" ? `${h}h${m}` : `${h}h`; };

// ---------------------------------------------------------------- nascer e pôr do sol (equação do nascer do sol)
/** Nascer e pôr do sol (ms UTC) no dia `data` ("AAAA-MM-DD") em lat/lon; null no sol da meia-noite ou na noite polar. */
export function solDoDia(data, lat, lon) {
  const rad = Math.PI / 180, ms = Date.parse(data + "T12:00:00Z") - (lon / 15) * 3600e3;
  const n = Math.round(ms / 864e5 + 2440587.5 - 2451545.0 + 0.0008);
  const Js = n - lon / 360;
  const M = (357.5291 + 0.98560028 * Js) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (M + C + 180 + 102.9372) % 360;
  const Jt = 2451545.0 + Js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const sd = Math.sin(L * rad) * Math.sin(23.4397 * rad), cd = Math.cos(Math.asin(sd));
  const cw = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sd) / (Math.cos(lat * rad) * cd);
  if (cw < -1 || cw > 1) return null;
  const w = Math.acos(cw) / rad;
  const paraMs = (J) => (J - 2440587.5) * 864e5;
  return { nascer: paraMs(Jt - w / 360), por: paraMs(Jt + w / 360) };
}

// ---------------------------------------------------------------- o código do tempo (WMO) em palavras e ícones
const TEXTOS = {
  0: "Céu limpo", 1: "Quase limpo", 2: "Parcialmente nublado", 3: "Nublado", 45: "Neblina", 48: "Neblina com geada",
  51: "Garoa fraca", 53: "Garoa", 55: "Garoa forte", 56: "Garoa congelante", 57: "Garoa congelante forte",
  61: "Chuva fraca", 63: "Chuva", 65: "Chuva forte", 66: "Chuva congelante", 67: "Chuva congelante forte",
  71: "Neve fraca", 73: "Neve", 75: "Neve forte", 77: "Grãos de neve", 80: "Pancadas fracas", 81: "Pancadas de chuva", 82: "Pancadas fortes",
  85: "Pancadas de neve", 86: "Pancadas de neve fortes", 95: "Tempestade", 96: "Tempestade com granizo", 99: "Tempestade com granizo",
};
export const textoDe = (cod) => TEXTOS[cod] ?? "—";
/** O ícone do tempo: sol, lua, parcial, parcial-noite, nublado, neblina, garoa, chuva, chuva-forte, tempestade, neve. */
export function iconeDe(cod, dia = true) {
  if (cod == null) return "nublado";
  if (cod <= 1) return dia ? "sol" : "lua";
  if (cod === 2) return dia ? "parcial" : "parcial-noite";
  if (cod === 3) return "nublado";
  if (cod === 45 || cod === 48) return "neblina";
  if (cod >= 51 && cod <= 57) return "garoa";
  if (cod === 65 || cod === 67 || cod === 82) return "chuva-forte";
  if ((cod >= 61 && cod <= 67) || (cod >= 80 && cod <= 82)) return "chuva";
  if ((cod >= 71 && cod <= 77) || cod === 85 || cod === 86) return "neve";
  if (cod >= 95) return "tempestade";
  return "nublado";
}
export const chuvoso = (cod) => cod != null && cod >= 51 && !(cod >= 71 && cod <= 77) && cod !== 85 && cod !== 86;
/** O céu do fundo pelo tempo e pela hora: { periodo: dia | aurora | crepusculo | noite, tempo: limpo | nuvens | chuva | tempestade | neblina }. */
export function ceuDe(cod, ms, sol) {
  let periodo = "dia";
  if (sol) {
    const h = 3600e3;
    if (ms < sol.nascer - h / 2 || ms > sol.por + h / 2) periodo = "noite";
    else if (ms < sol.nascer + h) periodo = "aurora";
    else if (ms > sol.por - h) periodo = "crepusculo";
  }
  const i = iconeDe(cod, true);
  const tempo = i === "tempestade" ? "tempestade" : ["chuva", "chuva-forte", "garoa", "neve"].includes(i) ? "chuva" : i === "neblina" ? "neblina" : i === "nublado" ? "nuvens" : "limpo";
  return { periodo, tempo };
}

// MET Norway: symbol_code → código WMO (para usar os mesmos textos e ícones)
const MET = { clearsky: 0, fair: 1, partlycloudy: 2, cloudy: 3, fog: 45, lightrain: 61, rain: 63, heavyrain: 65, lightrainshowers: 80, rainshowers: 81, heavyrainshowers: 82,
  lightsleet: 66, sleet: 66, heavysleet: 67, lightsleetshowers: 66, sleetshowers: 66, heavysleetshowers: 67, lightsnow: 71, snow: 73, heavysnow: 75, lightsnowshowers: 85, snowshowers: 85, heavysnowshowers: 86 };
export function codigoMET(sym) {
  if (!sym) return null;
  const base = String(sym).replace(/_(day|night|polartwilight)$/, "");
  if (/thunder/.test(base)) return 95;
  return MET[base] ?? 3;
}

// ---------------------------------------------------------------- vento, UV, ar, pressão
const RUMOS = ["N", "NNE", "NE", "ENE", "L", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
export const rumo = (graus) => graus == null ? "—" : RUMOS[Math.round((((graus % 360) + 360) % 360) / 22.5) % 16];
const NOMES_RUMO = { N: "norte", L: "leste", S: "sul", O: "oeste", NE: "nordeste", SE: "sudeste", SO: "sudoeste", NO: "noroeste" };
export const deOnde = (graus) => { const r = rumo(graus); return NOMES_RUMO[r] ? `do ${NOMES_RUMO[r]}` : `de ${r}`; };
/** Escala de Beaufort em palavras (km/h). */
export function ventoEm(kmh) {
  if (kmh == null) return "";
  return kmh < 2 ? "Calmo" : kmh < 12 ? "Brisa leve" : kmh < 20 ? "Brisa fraca" : kmh < 29 ? "Brisa moderada" : kmh < 39 ? "Vento fresco" : kmh < 50 ? "Vento forte" : kmh < 62 ? "Ventania" : "Ventania forte";
}
export function nivelUV(uv) {
  if (uv == null) return { nome: "—", n: 0 };
  return uv < 3 ? { nome: "Baixo", n: 1 } : uv < 6 ? { nome: "Moderado", n: 2 } : uv < 8 ? { nome: "Alto", n: 3 } : uv < 11 ? { nome: "Muito alto", n: 4 } : { nome: "Extremo", n: 5 };
}
/** Índice de qualidade do ar dos EUA (o que o Open-Meteo dá) em palavras. */
export function nivelAr(aqi) {
  if (aqi == null) return { nome: "—", n: 0 };
  return aqi <= 50 ? { nome: "Boa", n: 1 } : aqi <= 100 ? { nome: "Moderada", n: 2 } : aqi <= 150 ? { nome: "Ruim para sensíveis", n: 3 } : aqi <= 200 ? { nome: "Ruim", n: 4 } : aqi <= 300 ? { nome: "Muito ruim", n: 5 } : { nome: "Perigosa", n: 6 };
}
export function nivelPressao(hpa) {
  if (hpa == null) return "";
  return hpa < 1000 ? "Baixa: tempo instável" : hpa < 1009 ? "Um pouco baixa" : hpa <= 1020 ? "Normal" : "Alta: tempo firme";
}
/** A pressão subiu, caiu ou ficou nas últimas 3 h (pela série de horas, se houver). */
export function tendencia(horas, i, campo = "pressao") {
  const a = horas[i - 3]?.[campo], b = horas[i]?.[campo];
  if (a == null || b == null) return 0;
  return b - a > 1 ? 1 : a - b > 1 ? -1 : 0;
}
export function visEm(m) {
  if (m == null) return "—";
  return m >= 10000 ? `${Math.round(m / 1000)} km` : m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${Math.round(m)} m`;
}

// ---------------------------------------------------------------- normalizar as respostas
const num = (v) => (v == null || Number.isNaN(+v) ? null : +v);
const um = (v) => (v == null ? null : Math.round(v * 10) / 10);

/** Open-Meteo (forecast + air-quality opcional) → o formato do app. */
export function normalizarOpenMeteo(b, ar, lugar, em = new Date().toISOString()) {
  if (!b?.hourly?.time?.length || !b?.daily?.time?.length) throw new Error("resposta do Open-Meteo sem as horas");
  const offset = num(b.utc_offset_seconds) ?? offsetDoFuso(lugar.fuso);
  const H = b.hourly, D = b.daily, c = b.current || {};
  const horas = H.time.map((h, i) => ({ h, t: um(num(H.temperature_2m?.[i])), sens: um(num(H.apparent_temperature?.[i])), prob: num(H.precipitation_probability?.[i]),
    mm: um(num(H.precipitation?.[i])), cod: num(H.weather_code?.[i]), dia: H.is_day ? !!H.is_day[i] : null, vento: um(num(H.wind_speed_10m?.[i])),
    uv: um(num(H.uv_index?.[i])), pressao: um(num(H.pressure_msl?.[i])), orvalho: um(num(H.dew_point_2m?.[i])), vis: num(H.visibility?.[i]) }));
  const dias = D.time.map((d, i) => ({ d, max: um(num(D.temperature_2m_max?.[i])), min: um(num(D.temperature_2m_min?.[i])), prob: num(D.precipitation_probability_max?.[i]),
    mm: um(num(D.precipitation_sum?.[i])), cod: num(D.weather_code?.[i]), nascer: D.sunrise?.[i] || null, por: D.sunset?.[i] || null,
    uv: um(num(D.uv_index_max?.[i])), vento: um(num(D.wind_speed_10m_max?.[i])), rajada: um(num(D.wind_gusts_10m_max?.[i])), dir: num(D.wind_direction_10m_dominant?.[i]) }));
  const hora = (c.time || localISO(Date.parse(em), offset)).slice(0, 16);
  const ih = indiceHora(horas, hora), hh = horas[ih] || {};
  const agora = { hora, t: um(num(c.temperature_2m)) ?? hh.t, sens: um(num(c.apparent_temperature)) ?? hh.sens, umid: num(c.relative_humidity_2m),
    orvalho: hh.orvalho ?? null, pressao: um(num(c.pressure_msl)), vento: um(num(c.wind_speed_10m)) ?? hh.vento, rajada: um(num(c.wind_gusts_10m)),
    dir: num(c.wind_direction_10m), nuvens: num(c.cloud_cover), vis: hh.vis ?? null, uv: hh.uv ?? null, mm: um(num(c.precipitation)),
    cod: num(c.weather_code) ?? hh.cod, dia: c.is_day != null ? !!c.is_day : hh.dia ?? true };
  for (const x of horas) { delete x.orvalho; delete x.vis; }
  return { fonte: "open-meteo", lugar, em, offset, agora, horas, dias, ar: normalizarAr(ar, hora) };
}
function normalizarAr(ar, hora) {
  const H = ar?.hourly; if (!H?.time?.length) return null;
  let i = H.time.findIndex(t => t.slice(0, 13) === hora.slice(0, 13));
  if (i < 0) i = 0;
  // a hora atual pode vir vazia (ainda sem medida): a mais próxima com valor
  for (let k = 0; k < 6 && H.us_aqi?.[i] == null; k++) i = Math.max(0, i - 1);
  const aqi = num(H.us_aqi?.[i]);
  return aqi == null ? null : { aqi: Math.round(aqi), pm25: um(num(H.pm2_5?.[i])), pm10: um(num(H.pm10?.[i])) };
}
/** O índice da hora `hora` ("AAAA-MM-DDTHH:MM") na série (a hora cheia em que ela cai). */
export function indiceHora(horas, hora) {
  const k = hora.slice(0, 13);
  const i = horas.findIndex(x => x.h.slice(0, 13) === k);
  if (i >= 0) return i;
  return hora < horas[0]?.h ? 0 : horas.length - 1;
}

/** MET Norway (locationforecast 2.0 complete) → o mesmo formato. Os dias são montados pelas horas locais; o nascer e o
 *  pôr do sol saem da conta (`solDoDia`). */
export function normalizarMET(b, lugar, em = new Date().toISOString()) {
  const ts = b?.properties?.timeseries;
  if (!ts?.length) throw new Error("resposta do MET Norway sem a série");
  const offset = offsetDoFuso(lugar.fuso || PADRAO.fuso);
  const horas = [], porDia = new Map();
  for (let i = 0; i < ts.length; i++) {
    const p = ts[i], ms = Date.parse(p.time), h = localISO(ms, offset).slice(0, 13) + ":00";
    const d = p.data?.instant?.details || {}, n1 = p.data?.next_1_hours, n6 = p.data?.next_6_hours;
    const passo = n1 ? 1 : 6; // as horas com next_1_hours vêm de hora em hora; depois, de 6 em 6 h
    const sym = n1?.summary?.symbol_code || n6?.summary?.symbol_code;
    const cod = codigoMET(sym), noite = /_night$/.test(sym || "") ? false : /_day$/.test(sym || "") ? true : null;
    const x = { h, t: um(num(d.air_temperature)), sens: null, prob: num(n1?.details?.probability_of_precipitation ?? n6?.details?.probability_of_precipitation),
      mm: um(num(n1?.details?.precipitation_amount ?? (n6?.details?.precipitation_amount != null ? n6.details.precipitation_amount / 6 : null))),
      cod, dia: noite, vento: d.wind_speed != null ? um(d.wind_speed * 3.6) : null, uv: um(num(d.ultraviolet_index_clear_sky)),
      pressao: um(num(d.air_pressure_at_sea_level)), umid: num(d.relative_humidity), orvalho: um(num(d.dew_point_temperature)),
      rajada: d.wind_speed_of_gust != null ? um(d.wind_speed_of_gust * 3.6) : null, dir: num(d.wind_from_direction), nuvens: num(d.cloud_area_fraction), nevoa: num(d.fog_area_fraction) };
    // só as horas de hora em hora entram na faixa (depois de ~60 h o MET passa a 6 h)
    if (passo <= 1.01) horas.push(x);
    const dia = h.slice(0, 10), g = porDia.get(dia) || { ts: [], mm: 0, prob: null, cods: [] };
    if (x.t != null) g.ts.push(x.t);
    if (n6?.details?.air_temperature_max != null) g.ts.push(n6.details.air_temperature_max);
    if (n6?.details?.air_temperature_min != null) g.ts.push(n6.details.air_temperature_min);
    g.mm += passo <= 1.01 ? (n1?.details?.precipitation_amount || 0) : (n6?.details?.precipitation_amount || 0);
    if (x.prob != null) g.prob = Math.max(g.prob ?? 0, x.prob);
    if (cod != null) g.cods.push([Math.abs(horaDe(h) - 13), cod]);
    if (x.uv != null) g.uv = Math.max(g.uv ?? 0, x.uv);
    if (x.vento != null) g.vento = Math.max(g.vento ?? 0, x.vento);
    if (x.rajada != null) g.rajada = Math.max(g.rajada ?? 0, x.rajada);
    porDia.set(dia, g);
  }
  const dias = [...porDia.entries()].filter(([, g]) => g.ts.length).map(([d, g]) => {
    const s = solDoDia(d, lugar.lat, lugar.lon);
    // o ícone do dia: o pior tempo entre 9h e 18h (a chuva conta mais), senão o de perto das 13h
    const tarde = g.cods.filter(([k]) => k <= 4).map(([, c]) => c), pior = tarde.length ? tarde.reduce((a, c) => (gravidade(c) > gravidade(a) ? c : a)) : g.cods.sort((a, b) => a[0] - b[0])[0]?.[1] ?? null;
    return { d, max: um(Math.max(...g.ts)), min: um(Math.min(...g.ts)), prob: g.prob, mm: um(g.mm), cod: pior, nascer: s ? localISO(s.nascer, offset) : null, por: s ? localISO(s.por, offset) : null,
      uv: g.uv ?? null, vento: g.vento ?? null, rajada: g.rajada ?? null, dir: null };
  });
  // o MET não diz se é dia: pela conta do sol
  for (const x of horas) if (x.dia == null) { const dd = dias.find(d => d.d === x.h.slice(0, 10)); x.dia = dd?.nascer ? x.h >= dd.nascer.slice(0, 13) && x.h < dd.por.slice(0, 13) : horaDe(x.h) >= 6 && horaDe(x.h) < 18; }
  const hora = localISO(Date.parse(em), offset), hh = horas[indiceHora(horas, hora)] || {};
  const agora = { hora, t: hh.t, sens: sensacao(hh.t, hh.umid, hh.vento), umid: hh.umid, orvalho: hh.orvalho, pressao: hh.pressao, vento: hh.vento, rajada: hh.rajada, dir: hh.dir,
    nuvens: hh.nuvens, vis: hh.nevoa != null && hh.nevoa > 50 ? 800 : null, uv: hh.uv, mm: hh.mm, cod: hh.cod, dia: hh.dia };
  for (const x of horas) { x.sens = sensacao(x.t, x.umid, x.vento); delete x.umid; delete x.orvalho; delete x.rajada; delete x.dir; delete x.nuvens; delete x.nevoa; }

  return { fonte: "met.no", lugar, em, offset, agora, horas, dias, ar: null };
}
// a chuva pesa mais que as nuvens na escolha do ícone do dia
const gravidade = (c) => c == null ? -1 : c >= 95 ? 9 : c === 65 || c === 82 ? 8 : chuvoso(c) ? 6 : c >= 71 && c <= 86 ? 7 : c === 45 || c === 48 ? 3 : c;
/** Sensação térmica aproximada (índice de calor acima de 27 °C, vento frio abaixo de 10 °C). */
export function sensacao(t, umid, vento) {
  if (t == null) return null;
  if (t >= 27 && umid != null) {
    const f = t * 9 / 5 + 32, R = umid;
    const hi = -42.379 + 2.04901523 * f + 10.14333127 * R - .22475541 * f * R - .00683783 * f * f - .05481717 * R * R + .00122874 * f * f * R + .00085282 * f * R * R - .00000199 * f * f * R * R;
    return um((hi - 32) * 5 / 9);
  }
  if (t <= 10 && vento != null && vento > 4.8) return um(13.12 + .6215 * t - 11.37 * Math.pow(vento, .16) + .3965 * t * Math.pow(vento, .16));
  return um(t);
}

// ---------------------------------------------------------------- o que mostrar agora
/** As próximas `n` horas a partir da hora de `ms` (o cache pode ter algumas horas: a série anda com o relógio). */
export function proximasHoras(c, ms = Date.now(), n = 24) {
  const agora = localISO(ms, c.offset).slice(0, 13);
  const i = c.horas.findIndex(x => x.h.slice(0, 13) >= agora);
  return i < 0 ? [] : c.horas.slice(i, i + n);
}
/** O dia de hoje (no lugar) e os próximos. */
export function proximosDias(c, ms = Date.now(), n = 10) {
  const hoje = localISO(ms, c.offset).slice(0, 10);
  return c.dias.filter(d => d.d >= hoje).slice(0, n);
}
/** O "agora": o que veio da fonte se a busca é recente (até 90 min); senão, a previsão para esta hora. */
export function agoraDe(c, ms = Date.now()) {
  const idade = ms - Date.parse(c.em);
  if (idade <= 90 * 60e3) return { ...c.agora, previsto: false };
  const h = proximasHoras(c, ms, 1)[0];
  if (!h) return { ...c.agora, previsto: false, velho: true };
  return { ...c.agora, hora: h.h, t: h.t, sens: h.sens ?? h.t, cod: h.cod, dia: h.dia, mm: h.mm, uv: h.uv, vento: h.vento ?? c.agora.vento, previsto: true };
}
/** Resumo curto para a Home e os widgets. */
export function resumo(c, ms = Date.now()) {
  const a = agoraDe(c, ms), hoje = proximosDias(c, ms, 1)[0] || {};
  // a chance de chuva do resto do dia (até a meia-noite), que diz mais que a do dia inteiro depois que a manhã passou
  const resto = proximasHoras(c, ms, 48).filter(x => x.h.slice(0, 10) === (hoje.d || ""));
  const prob = resto.length ? Math.max(...resto.map(x => x.prob ?? 0)) : hoje.prob;
  return { t: a.t, sens: a.sens, cod: a.cod, dia: a.dia, texto: textoDe(a.cod), icone: iconeDe(a.cod, a.dia), max: hoje.max, min: hoje.min, prob: prob ?? null, previsto: a.previsto };
}
export const grau = (t) => (t == null ? "—" : `${Math.round(t)}°`);

// ---------------------------------------------------------------- avisos curtos
/** Avisos úteis para as próximas horas. `trajetos(dia)` dá as saídas de casa e as voltas do dia ([{ quando: "ida" | "volta",
 *  hora: "HH:MM" }]); sem ele, nada sobre o ônibus. Até `max` avisos, os mais importantes primeiro:
 *  [{ tipo, ico, texto, prio, ate (ms) }]. */
export function avisos(c, ms = Date.now(), { trajetos = null, max = 3 } = {}) {
  const out = [], hs = proximasHoras(c, ms, 24), off = c.offset, hojeL = localISO(ms, off).slice(0, 10), agoraL = localISO(ms, off);
  if (!hs.length) return out;
  const fim = (h) => msDe(h, off) + 3600e3;
  const add = (tipo, ico, texto, prio, ate) => out.push({ tipo, ico, texto, prio, ate });
  // tempestade
  const temp = hs.slice(0, 12).find(x => x.cod >= 95 && (x.prob == null || x.prob >= 30));
  if (temp) add("tempestade", "⛈️", `Tempestade prevista ${quando(temp.h, agoraL)}${temp.prob != null ? ` (${temp.prob}%)` : ""}.`, 0, fim(temp.h));
  // as idas e voltas (ônibus) de hoje que ainda vêm e a ida de amanhã (depois das 18h)
  const amanha = c.dias.find(d => d.d > hojeL)?.d;
  const viagens = [];
  if (trajetos) {
    for (const dia of [hojeL, ...(horaDe(agoraL) >= 18 && amanha ? [amanha] : [])]) {
      for (const tj of trajetos(dia) || []) { const h = `${dia}T${tj.hora}`; if (h >= agoraL.slice(0, 13) + ":00" || dia > hojeL) viagens.push({ ...tj, h, dia }); }
    }
  }
  const chuvaNa = (h) => chuvaPerto(c, h);
  let avisouGuarda = false;
  for (const v of viagens.slice(0, 3)) {
    const ch = chuvaNa(v.h);
    const nome = v.quando === "ida" ? "na ida" : "na volta", dd = v.dia > hojeL ? " amanhã" : "";
    if (ch && !avisouGuarda) { add("chuva", "☂️", `Chuva provável ${nome}${dd} (${rotuloHora(v.h)}${ch.p ? `, ${ch.p}%` : ""}): leve o guarda-chuva.`, 1, fim(ch.h)); avisouGuarda = true; }
    const t = c.horas.find(x => x.h.slice(0, 13) === v.h.slice(0, 13))?.t;
    if (v.quando === "ida" && t != null && t < 14) add("frio", "🧥", `Frio ${nome}${dd} (${rotuloHora(v.h)}, ${grau(t)}): leve um casaco.`, 3, msDe(v.h, off) + 3600e3);
  }
  // a próxima chuva (se não falou dela pela viagem)
  if (!avisouGuarda) {
    const ch = hs.slice(0, 12).find(x => (x.prob ?? 0) >= 60 || (x.mm ?? 0) >= 0.5);
    if (ch && !temp) {
      const agoraChove = ch === hs[0] && chuvoso(c.agora.cod);
      add("chuva", "☂️", agoraChove ? `Chovendo agora${ch.prob ? ` (${ch.prob}%)` : ""}: leve o guarda-chuva.` : `Chuva ${quando(ch.h, agoraL)}${ch.prob ? ` (${ch.prob}%)` : ""}: leve o guarda-chuva.`, 1, fim(ch.h));
    }
  }
  // vento forte
  const raj = hs.slice(0, 12).reduce((m, x) => (x.vento ?? 0) > (m?.vento ?? 0) ? x : m, null);
  const rajMax = Math.max(c.agora.rajada ?? 0, raj?.vento ?? 0);
  if (rajMax >= 50) add("vento", "💨", `Rajadas de até ${Math.round(rajMax)} km/h.`, 2, fim(hs[Math.min(11, hs.length - 1)].h));
  // calor e sol forte (só até as 15h)
  const hoje = c.dias.find(d => d.d === hojeL);
  if (hoje && horaDe(agoraL) < 15) {
    if (hoje.max != null && hoje.max >= 32) add("calor", "🥵", `Calor de até ${grau(hoje.max)} hoje: beba bastante água.`, 2, msDe(`${hojeL}T18:00`, off));
    const uv = hoje.uv == null ? null : Math.round(hoje.uv);
    if (uv != null && uv >= 8) add("uv", "🧴", `UV ${nivelUV(uv).nome.toLowerCase()} (${uv}) perto do meio-dia: use protetor solar.`, 3, msDe(`${hojeL}T15:00`, off));
  }
  // madrugada fria
  const prox = c.dias.find(d => d.d > hojeL);
  if (prox?.min != null && prox.min <= 10 && horaDe(agoraL) >= 15) add("frio", "🥶", `Madrugada fria: mínima de ${grau(prox.min)} amanhã.`, 3, msDe(`${prox.d}T09:00`, off));
  // ar
  if (c.ar?.aqi > 100) add("ar", "😷", `Ar ${nivelAr(c.ar.aqi).nome.toLowerCase()} agora (índice ${c.ar.aqi}): evite esforço ao ar livre.`, 2, ms + 3 * 3600e3);
  // um aviso por tipo, os mais importantes primeiro
  const vistos = new Set();
  return out.sort((a, b) => a.prio - b.prio).filter(a => !vistos.has(a.tipo + a.ico) && vistos.add(a.tipo + a.ico)).slice(0, max);
}
/** Chuva que importa perto de uma hora (AAAA-MM-DDTHH:MM, hora do lugar): naquela hora ou na seguinte, chance ≥ 50%,
 *  ≥ 0,4 mm, ou código de chuva com chance ≥ 35%. { p, mm, h, ini, fim } (ini e fim: as horas da janela que têm chuva)
 *  ou null. A mesma régua dos avisos de ida e volta e do aviso das 6h (`chuvaNoCaminho`). */
export function chuvaPerto(c, h) {
  const i = c.horas.findIndex(x => x.h.slice(0, 13) === h.slice(0, 13)); if (i < 0) return null;
  const jan = c.horas.slice(Math.max(0, i), i + 2), p = Math.max(...jan.map(x => x.prob ?? 0)), mm = jan.reduce((s, x) => s + (x.mm || 0), 0), cod = jan.find(x => chuvoso(x.cod))?.cod;
  if (!(p >= 50 || mm >= 0.4 || (cod != null && (p >= 35 || p === 0 && mm > 0)))) return null;
  const com = jan.filter(x => (x.prob ?? 0) >= 35 || (x.mm ?? 0) > 0 || chuvoso(x.cod));
  return { p, mm, h: c.horas[i].h, ini: (com[0] || jan[0]).h, fim: (com.at(-1) || jan.at(-1)).h };
}
/** "7h–8h" (do começo da 1ª hora ao fim da última). */
export const faixaHoras = (ini, fim) => `${horaDe(ini)}h–${(horaDe(fim) + 1) % 24}h`;
/**
 * Chuva no caminho de um dia (pedido do Alediov, 03/11/2026: "Leve guarda-chuva: chuva prevista na ida, 7h–8h, 70%"):
 * para cada trajeto do dia (`trajetos(dia)`: ida e volta pela Agenda, dados.js `trajetosDe`), a chuva perto da hora.
 * { dia, itens: [{quando, hora, p, mm, faixa}], titulo, texto } ou null (sem chuva no caminho, sem trajetos ou sem a
 * previsão daquelas horas).
 */
export function chuvaNoCaminho(c, dia, trajetos) {
  // `c`: uma previsão, ou uma por lugar ({casa, faculdade, huop, unico}: a ida pela da Casa, a volta pela do lugar onde
  // ele está, o `onde` do trajeto; o que faltar cai no `unico`)
  const prev = (tj) => c?.horas ? c : c?.[tj.onde] || c?.unico || null;
  if (!c || typeof trajetos !== "function") return null;
  const itens = [];
  for (const tj of trajetos(dia) || []) {
    const cc = prev(tj); if (!cc?.horas?.length) continue;
    const ch = chuvaPerto(cc, `${dia}T${tj.hora}`);
    if (ch) itens.push({ quando: tj.quando, hora: tj.hora, p: ch.p, mm: Math.round(ch.mm * 10) / 10, faixa: faixaHoras(ch.ini, ch.fim) });
  }
  if (!itens.length) return null;
  const parte = (x) => `na ${x.quando} (${x.faixa}${x.p ? `, ${x.p}%` : ""})`;
  return { dia, itens, titulo: "Leve guarda-chuva ☂️", texto: `Chuva prevista ${itens.map(parte).join(" e ")}.` };
}
/** "às 17h", "agora", "amanhã às 6h". */
function quando(h, agoraL) {
  if (h.slice(0, 13) === agoraL.slice(0, 13)) return "agora";
  return `${h.slice(0, 10) > agoraL.slice(0, 10) ? "amanhã " : ""}às ${rotuloHora(h)}`;
}

// ---------------------------------------------------------------- busca de cidades
/** Os resultados do geocoding do Open-Meteo como lugares. */
export function lugaresDaBusca(b) {
  return (b?.results || []).map(r => ({ nome: r.name, regiao: r.admin1 || "", pais: r.country_code || "", paisNome: r.country || "", lat: r.latitude, lon: r.longitude, fuso: r.timezone || PADRAO.fuso }));
}
export const nomeLugar = (l) => l ? `${l.nome}${l.regiao ? `, ${siglaUF(l.regiao) || l.regiao}` : ""}` : "";
const UFS = { "Acre": "AC", "Alagoas": "AL", "Amapá": "AP", "Amazonas": "AM", "Bahia": "BA", "Ceará": "CE", "Distrito Federal": "DF", "Espírito Santo": "ES", "Goiás": "GO", "Maranhão": "MA", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS", "Minas Gerais": "MG", "Pará": "PA", "Paraíba": "PB", "Paraná": "PR", "Pernambuco": "PE", "Piauí": "PI", "Rio de Janeiro": "RJ", "Rio Grande do Norte": "RN", "Rio Grande do Sul": "RS", "Rondônia": "RO", "Roraima": "RR", "Santa Catarina": "SC", "São Paulo": "SP", "Sergipe": "SE", "Tocantins": "TO" };
export const siglaUF = (r) => UFS[r] || "";

// ---------------------------------------------------------------- para os widgets nativos
/** O que os widgets precisam para andar sozinhos ~2 dias: as horas com o instante (ms), a temperatura, o ícone, a chance
 *  de chuva e o texto; os dias com máx./mín./chuva; e o 1º aviso com a validade. */
export function paraWidget(c, avs = [], ms = Date.now()) {
  const horas = proximasHoras(c, ms - 3600e3, 60).map(x => [msDe(x.h, c.offset), x.t == null ? null : Math.round(x.t), iconeDe(x.cod, x.dia), x.prob ?? -1, textoDe(x.cod)]);
  const dias = proximosDias(c, ms - 864e5, 4).map(d => [d.d, d.max == null ? null : Math.round(d.max), d.min == null ? null : Math.round(d.min), d.prob ?? -1]);
  const a = avs[0];
  return { lugar: nomeLugar(c.lugar), horas: JSON.stringify(horas), dias: JSON.stringify(dias), aviso: a ? a.texto : "", avisoAte: a ? Math.round(a.ate) : 0, em: Date.parse(c.em) };
}

/** Teste: desloca todas as datas "AAAA-MM-DD…" de uma resposta de exemplo em `dias` dias (tools/clima/exemplo-*.json). */
export function deslocarDatas(o, dias) {
  const mover = (s) => s.replace(/^(\d{4}-\d{2}-\d{2})(.*)$/, (_, d, r) => {
    const z = r.endsWith("Z"), base = Date.parse(d + "T00:00:00Z") + dias * 864e5;
    return new Date(base).toISOString().slice(0, 10) + (z ? r : r);
  });
  if (typeof o === "string") return /^\d{4}-\d{2}-\d{2}/.test(o) ? mover(o) : o;
  if (Array.isArray(o)) return o.map(x => deslocarDatas(x, dias));
  if (o && typeof o === "object") return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, deslocarDatas(v, dias)]));
  return o;
}
