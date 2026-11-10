// Horário padrão das clínicas da UNIOESTE (agenda do LINEARsis enviada pelo Alediov em 24/10/2026). "Pode mudar, mas
// em geral é esse": serve só de DICA na revisão (clínica × dia da semana × turno do horário de chegada) e para pôr na
// frente as clínicas que combinam nas previsões. Não entra na coerência nem nas estatísticas.
// Cada clínica: lista de horários { dias (0 = domingo … 6 = sábado; ausente = qualquer dia útil), turno, inicio }.
const M = "manha", T = "tarde", N = "noite";
export const AGENDA_CLINICAS = {
  "Clínica Integrada do Adulto": [{ turno: M, inicio: "08:00" }, { turno: T, inicio: "13:30" }, { turno: N, inicio: "19:00" }],
  "Clínica Integrada Infantil": [{ dias: [1, 3], turno: M, inicio: "08:00" }, { dias: [1, 3], turno: T, inicio: "13:30" }],
  "Cirurgia I": [{ turno: M, inicio: "08:00" }, { turno: M, inicio: "09:00" }, { turno: M, inicio: "09:50" }, { turno: T, inicio: "13:30" }, { turno: T, inicio: "16:00" }, { turno: T, inicio: "17:00" }],
  "Cirurgia II": [{ turno: M, inicio: "08:00" }, { turno: M, inicio: "09:50" }, { turno: T, inicio: "15:20" }, { turno: T, inicio: "17:00" }],
  "Dentística I": [{ turno: M, inicio: "09:20" }, { turno: T, inicio: "13:30" }],
  "Dentística II": [{ turno: M, inicio: "08:00" }, { turno: T, inicio: "15:20" }],
  "Endodontia": [{ turno: M, inicio: "08:00" }, { turno: T, inicio: "13:40" }],
  "Monitoria de Endodontia": [{ turno: M, inicio: "07:00" }],
  "Estomatologia": [{ turno: M, inicio: "08:00" }],
  "Liga Acadêmica de Diagnóstico Bucal": [{ turno: M, inicio: "09:50" }],
  "Liga Acadêmica de Periodontia": [{ dias: [2], turno: T, inicio: "16:00" }, { dias: [4], turno: M, inicio: "08:00" }],
  "Oclusão": [{ turno: T, inicio: "14:20" }, { turno: T, inicio: "16:20" }],
  "Odontopediatria": [{ turno: M, inicio: "08:00" }, { turno: T, inicio: "13:30" }],
  "Periodontia I": [{ turno: T, inicio: "13:30" }, { turno: T, inicio: "16:00" }],
  "Periodontia II": [{ turno: T, inicio: "13:30" }, { turno: T, inicio: "16:00" }],
  "Prótese I": [{ dias: [2], turno: M, inicio: "09:30" }, { dias: [2], turno: T, inicio: "13:30" }],
  "Prótese II": [{ dias: [5], turno: M, inicio: "09:30" }, { dias: [5], turno: T, inicio: "13:30" }],
  "Saúde Coletiva III": [{ dias: [4], turno: M, inicio: "09:30" }, { dias: [4], turno: T, inicio: "13:30" }],
  "Semiologia": [{ dias: [4], turno: M, inicio: "08:00" }, { dias: [4], turno: M, inicio: "09:50" }, { dias: [5], turno: M, inicio: "08:00" }],
};
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const NOME_TURNO = { manha: "de manhã", tarde: "à tarde", noite: "à noite" };
/** Turno do horário de chegada (HH:MM): antes das 12h manhã, até 18h30 tarde, depois noite. */
export function turnoDe(h) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(h || "").trim()); if (!m) return null;
  const min = +m[1] * 60 + +m[2];
  return min < 12 * 60 ? M : min < 18 * 60 + 30 ? T : N;
}
const diaDaSemana = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? new Date(iso + "T12:00").getDay() : null;
const lista = (xs) => xs.length > 1 ? `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}` : xs[0] || "";
/** Combina a clínica com o dia e o turno? true, false, ou null (sem agenda ou sem dados para comparar). */
export function combinaComAgenda(clinica, dataIso, horario) {
  const ag = AGENDA_CLINICAS[clinica]; if (!ag) return null;
  const dia = diaDaSemana(dataIso), turno = turnoDe(horario);
  if (dia == null && !turno) return null;
  return ag.some(h => (dia == null || !h.dias || h.dias.includes(dia)) && (!turno || h.turno === turno));
}
/** Dica para a revisão quando a clínica não combina com o dia ou o turno da agenda padrão (ou null). */
export function dicaAgenda(clinica, dataIso, horario) {
  if (combinaComAgenda(clinica, dataIso, horario) !== false) return null;
  const ag = AGENDA_CLINICAS[clinica], dia = diaDaSemana(dataIso), turno = turnoDe(horario);
  const diasClin = [...new Set(ag.flatMap(h => h.dias || []))];
  if (dia != null && diasClin.length && !ag.some(h => !h.dias || h.dias.includes(dia)))
    return `Pela agenda padrão, ${clinica} atende ${diasClin.length === 1 ? "às" : "nas"} ${lista(diasClin.map(d => DIAS[d] + (d > 0 && d < 6 && d !== 6 ? "s" : "")))}, e a data cai numa ${DIAS[dia]}: confira a clínica e a data.`;
  const turnos = [...new Set(ag.filter(h => dia == null || !h.dias || h.dias.includes(dia)).map(h => h.turno))];
  return `Pela agenda padrão, ${clinica} atende ${lista(turnos.map(t => NOME_TURNO[t]))}, e a chegada (${horario}) foi ${NOME_TURNO[turno]}: confira a clínica e o horário.`;
}
