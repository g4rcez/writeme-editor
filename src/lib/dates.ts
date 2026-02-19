import { format } from "date-fns";

export const Dates = {
  isoDate: (d: Date) => format(d, "yyyy-MM-dd"),
  time: (d: Date) => format(d, "HH:mm"),
  yearMonthDay: (d: Date) => format(d, "yyyy-MM-dd"),
};
