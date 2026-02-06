import { format } from "date-fns"
export const Dates = {
  yearMonthDay: (d: Date) => format(d, "yyyy-MM-dd")
}
