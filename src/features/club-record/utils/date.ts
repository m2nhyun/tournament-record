export function getMonthStartIsoDate(input = new Date()) {
  const year = input.getFullYear();
  const month = String(input.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function shiftMonthStartIsoDate(monthStart: string, offset: number) {
  const [yearText, monthText] = monthStart.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const date = new Date(year, monthIndex + offset, 1);

  return getMonthStartIsoDate(date);
}

export function formatMonthLabel(monthStart: string) {
  const [yearText, monthText] = monthStart.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const date = new Date(year, monthIndex, 1);

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
  });
}
