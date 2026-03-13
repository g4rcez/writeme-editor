import { Button, Tag, useLocale, type SetState } from "@g4rcez/components";
import {
  CalendarIcon,
  CaretLeftIcon,
  CaretRightIcon,
  PlusCircleIcon,
} from "@phosphor-icons/react";
import {
  addDays,
  addMonths,
  addWeeks,
  isToday,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { type CalendarFilter, type ViewMode } from "./calendar.types";
import {
  formatDay,
  formatMonthShort,
  formatMonthYear,
  getWeekNumber,
} from "./calendar.utils";

const VIEWS: { value: ViewMode; label: string }[] = [
  { value: "month", label: "Month view" },
  { value: "week", label: "Week view" },
  { value: "day", label: "Day view" },
];

type CalendarHeaderProps = {
  currentDate: Date;
  currentView: ViewMode;
  onAddEvent: () => void;
  activeFilters: string[];
  filters: CalendarFilter[];
  setCurrentDate: SetState<Date>;
  setCurrentView: SetState<ViewMode>;
  setActiveFilters: SetState<string[]>;
};

export function CalendarHeader({
  currentDate,
  currentView,
  filters,
  activeFilters,
  setCurrentDate,
  setCurrentView,
  setActiveFilters,
  onAddEvent,
}: CalendarHeaderProps) {
  const locale = useLocale();
  const isDateToday = isToday(currentDate);

  const handlePrev = () => {
    setCurrentDate((currentDate) => {
      if (currentView === "month") return subMonths(currentDate, 1);
      if (currentView === "week") return subWeeks(currentDate, 1);
      return subDays(currentDate, 1);
    });
  };

  const handleNext = () => {
    setCurrentDate((currentDate) => {
      if (currentView === "month") return addMonths(currentDate, 1);
      if (currentView === "week") return addWeeks(currentDate, 1);
      return addDays(currentDate, 1);
    });
  };

  const toggleFilter = (id: string) =>
    setActiveFilters((prev) => {
      if (prev.includes(id)) return prev.filter((f) => f !== id);
      return prev.concat(id);
    });

  const weekNum = getWeekNumber(currentDate);

  return (
    <div className="flex flex-col gap-2 border-b border-border pb-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex flex-col items-center justify-center rounded-lg border w-12 h-12 text-xs font-semibold border-border overflow-hidden ${isDateToday ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}
          >
            <span className="uppercase leading-none text-[10px] opacity-70">
              {formatMonthShort(currentDate, locale)}
            </span>
            <span className="text-xl leading-none font-bold">
              {formatDay(currentDate, locale)}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">
              {formatMonthYear(currentDate, locale)}
            </h1>
            <span className="text-xs text-muted-foreground">
              Week {weekNum}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              size="small"
              title="Previous"
              theme="ghost-muted"
              onClick={handlePrev}
            >
              <CaretLeftIcon size={16} />
            </Button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-sm rounded-md hover:bg-muted/50 transition-colors"
            >
              Today
            </button>
            <Button
              size="small"
              title="Next"
              theme="ghost-muted"
              onClick={handleNext}
            >
              <CaretRightIcon size={16} />
            </Button>
          </div>
          <div className="flex rounded-md">
            {VIEWS.map((v) => (
              <Button
                size="small"
                key={v.value}
                onClick={() => setCurrentView(v.value)}
                theme={currentView === v.value ? "primary" : "muted"}
                className="rounded-none first:rounded-l-button last:rounded-r-button"
              >
                {v.label}
              </Button>
            ))}
          </div>
          <Button theme="primary" size="small" onClick={onAddEvent}>
            <PlusCircleIcon size={14} />
            Add event
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <CalendarIcon size={14} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground mr-1">Filter:</span>
        {filters.map((filter) => {
          const isActive = activeFilters.includes(filter.id);
          return (
            <Tag
              as="button"
              size="small"
              type="button"
              key={filter.id}
              theme={filter.theme}
              indicator={isActive ? filter.theme : undefined}
              onClick={() => toggleFilter(filter.id)}
            >
              {filter.label}
            </Tag>
          );
        })}
      </div>
    </div>
  );
}
