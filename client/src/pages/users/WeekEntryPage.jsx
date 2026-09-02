import React, { useState, useEffect, useCallback, useMemo } from "react";
import { DayPicker } from "react-day-picker";
import {
  format,
  parse,
  startOfMonth,
  getDay,
  addDays,
  isSameMonth,
  isSameDay,
  startOfWeek,
  endOfMonth,
} from "date-fns";
import "react-day-picker/dist/style.css";
import Notice from "../../components/ui/Notice";
import useNotice from "../../hooks/useNotice";
import { createWeek, getWeeks, updateWeek } from "../../services/weekServices";

const WeeklyDateSelector = ({
  initialMonth = new Date(),
  initialDates = null,
  onChange = null,
  maxWeeks = 5,
}) => {
  // State management
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [selectedDates, setSelectedDates] = useState({});
  const [activeWeek, setActiveWeek] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [isFormValid, setIsFormValid] = useState(true);
  const [weekCount, setWeekCount] = useState(4);
  const [inputValues, setInputValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);
  // Maps weekKey -> the backend Week id it was loaded from (or just saved
  // as). Only slots with a known id get updated in place on Save; anything
  // else is treated as a new date to create (or adopt, if it happens to
  // already exist under a different slot).
  const [weekIds, setWeekIds] = useState({});
  const [notice, showNotice] = useNotice();

  // Helper: Check if date is valid
  const isValidDate = useCallback((date) => {
    return date instanceof Date && !isNaN(date.getTime());
  }, []);

  // Helper: Format date to YYYY-MM-DD
  const formatDateToYYYYMMDD = useCallback(
    (date) => {
      if (!date || !isValidDate(date)) return null;
      return format(date, "yyyy-MM-dd");
    },
    [isValidDate],
  );

  // Helper: Parse YYYY-MM-DD to Date object
  const parseYYYYMMDD = useCallback(
    (dateString) => {
      if (!dateString) return null;
      try {
        const parsed = parse(dateString, "yyyy-MM-dd", new Date());
        return isValidDate(parsed) ? parsed : null;
      } catch (error) {
        return null;
      }
    },
    [isValidDate],
  );

  // Calculate the first day (Monday) of each week in the month
  const calculateFirstDayOfEachWeek = useCallback((monthDate) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    // Find the first Monday of the month (or the first day of the first week)
    let firstDay = startOfWeek(monthStart, { weekStartsOn: 2 }); // Tuesday as first day of week

    // If the first Monday is before the month start, move to the next Monday
    while (firstDay < monthStart) {
      firstDay = addDays(firstDay, 7);
    }

    const weekStarts = [];
    let currentWeekStart = firstDay;

    // Get all week starts (Mondays) that fall within the month
    while (currentWeekStart <= monthEnd) {
      weekStarts.push(currentWeekStart);
      currentWeekStart = addDays(currentWeekStart, 7);
    }

    return weekStarts;
  }, []);

  // Get the number of weeks in the month
  const getWeeksCount = useCallback(
    (monthDate) => {
      const weekStarts = calculateFirstDayOfEachWeek(monthDate);
      return weekStarts.length;
    },
    [calculateFirstDayOfEachWeek],
  );

  // Initialize dates based on an explicit initialDates prop, if one was
  // passed in (nobody currently does, but the prop is kept for API
  // compatibility). Falls back to plain computed week starts.
  const initializeFromProp = useCallback(
    (month, initialDatesProp) => {
      const weekStarts = calculateFirstDayOfEachWeek(month);
      const weekCount = weekStarts.length;

      if (initialDatesProp) {
        const newDates = {};
        let allValid = true;

        for (let i = 1; i <= weekCount; i++) {
          const weekKey = `week${i}`;
          const dateStr = initialDatesProp[weekKey];
          if (dateStr) {
            const parsed = parseYYYYMMDD(dateStr);
            if (parsed && isSameMonth(parsed, month)) {
              newDates[weekKey] = parsed;
            } else {
              allValid = false;
              break;
            }
          } else {
            allValid = false;
            break;
          }
        }

        if (allValid && Object.keys(newDates).length === weekCount) {
          return newDates;
        }
      }

      const newDates = {};
      for (let i = 1; i <= weekCount; i++) {
        newDates[`week${i}`] = weekStarts[i - 1];
      }
      return newDates;
    },
    [calculateFirstDayOfEachWeek, parseYYYYMMDD],
  );

  // Load this month's dates when the month changes: check the database
  // first (so editing re-opens what's actually saved, and Save updates
  // those rows instead of inserting duplicates), and only fall back to
  // plain computed week starts for slots the database has nothing for.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const weekStarts = calculateFirstDayOfEachWeek(currentMonth);
      const weekCount = weekStarts.length;
      if (!cancelled) setWeekCount(weekCount);

      if (initialDates) {
        const newDates = initializeFromProp(currentMonth, initialDates);
        if (!cancelled) {
          setSelectedDates(newDates);
          setWeekIds({});
          setActiveWeek(null);
          setValidationErrors({});
          setInputValues({});
        }
        return;
      }

      setLoadingMonth(true);
      try {
        const monthPrefix = format(currentMonth, "yyyy-MM");
        const savedWeeks = await getWeeks();
        const savedForMonth = savedWeeks
          .filter((w) => w.week.startsWith(monthPrefix))
          .sort((a, b) => a.week.localeCompare(b.week));

        const newDates = {};
        const newWeekIds = {};
        for (let i = 0; i < weekCount; i++) {
          const weekKey = `week${i + 1}`;
          const saved = savedForMonth[i];
          if (saved) {
            newDates[weekKey] = parseYYYYMMDD(saved.week);
            newWeekIds[weekKey] = saved.id;
          } else {
            newDates[weekKey] = weekStarts[i];
          }
        }

        if (!cancelled) {
          setSelectedDates(newDates);
          setWeekIds(newWeekIds);
          setActiveWeek(null);
          setValidationErrors({});
          setInputValues({});
        }
      } catch (err) {
        if (!cancelled) {
          showNotice(
            err.message ||
              "Failed to load saved weeks - showing defaults instead.",
            "err",
          );
          const newDates = {};
          for (let i = 1; i <= weekCount; i++) {
            newDates[`week${i}`] = weekStarts[i - 1];
          }
          setSelectedDates(newDates);
          setWeekIds({});
          setActiveWeek(null);
          setValidationErrors({});
          setInputValues({});
        }
      } finally {
        if (!cancelled) setLoadingMonth(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [
    currentMonth,
    initialDates,
    initializeFromProp,
    calculateFirstDayOfEachWeek,
    parseYYYYMMDD,
    showNotice,
  ]);

  // Validate all dates
  const validateDates = useCallback(() => {
    const errors = {};
    const dateValues = Object.values(selectedDates);
    const weekKeys = Object.keys(selectedDates);

    weekKeys.forEach((weekKey) => {
      if (!selectedDates[weekKey]) {
        errors[weekKey] = "Date is required";
      }
    });

    const dateStrings = dateValues
      .filter((d) => d !== null && isValidDate(d))
      .map((d) => formatDateToYYYYMMDD(d));

    const duplicates = dateStrings.filter(
      (d, index) => dateStrings.indexOf(d) !== index,
    );

    if (duplicates.length > 0) {
      weekKeys.forEach((weekKey) => {
        const date = selectedDates[weekKey];
        if (date && duplicates.includes(formatDateToYYYYMMDD(date))) {
          errors[weekKey] = "Duplicate date selected";
        }
      });
    }

    weekKeys.forEach((weekKey) => {
      const date = selectedDates[weekKey];
      if (date && !isSameMonth(date, currentMonth)) {
        errors[weekKey] = "Date must be in current month";
      }
    });

    setValidationErrors(errors);
    const valid = Object.keys(errors).length === 0;
    setIsFormValid(valid);
    return valid;
  }, [selectedDates, currentMonth, formatDateToYYYYMMDD, isValidDate]);

  // Handle date selection from calendar
  const handleDateSelect = useCallback(
    (date) => {
      if (!date || !activeWeek) return;

      if (!isSameMonth(date, currentMonth)) {
        return;
      }

      const dateString = formatDateToYYYYMMDD(date);
      const isDuplicate = Object.entries(selectedDates).some(([key, value]) => {
        if (key === activeWeek) return false;
        return value && formatDateToYYYYMMDD(value) === dateString;
      });

      if (isDuplicate) {
        setValidationErrors({
          ...validationErrors,
          [activeWeek]: "This date is already assigned to another week",
        });
        return;
      }

      setSelectedDates((prev) => ({
        ...prev,
        [activeWeek]: date,
      }));

      // Update input value
      setInputValues((prev) => ({
        ...prev,
        [activeWeek]: format(date, "yyyy-MM-dd"),
      }));

      if (validationErrors[activeWeek]) {
        const newErrors = { ...validationErrors };
        delete newErrors[activeWeek];
        setValidationErrors(newErrors);
      }

      setTimeout(() => validateDates(), 0);
    },
    [
      activeWeek,
      selectedDates,
      currentMonth,
      formatDateToYYYYMMDD,
      validationErrors,
      validateDates,
    ],
  );

  // Handle direct date input from text field
  const handleDateInput = useCallback(
    (weekKey, event) => {
      const value = event.target.value;

      // Update input value immediately for better UX
      setInputValues((prev) => ({
        ...prev,
        [weekKey]: value,
      }));

      if (!value) {
        setSelectedDates((prev) => ({
          ...prev,
          [weekKey]: null,
        }));
        // Clear any validation error for this week
        if (validationErrors[weekKey]) {
          const newErrors = { ...validationErrors };
          delete newErrors[weekKey];
          setValidationErrors(newErrors);
        }
        return;
      }

      // Try to parse the date
      try {
        const parsedDate = new Date(value + "T00:00:00");
        if (isValidDate(parsedDate) && isSameMonth(parsedDate, currentMonth)) {
          // Check for duplicates
          const dateString = formatDateToYYYYMMDD(parsedDate);
          const isDuplicate = Object.entries(selectedDates).some(
            ([key, value]) => {
              if (key === weekKey) return false;
              return value && formatDateToYYYYMMDD(value) === dateString;
            },
          );

          if (isDuplicate) {
            setValidationErrors({
              ...validationErrors,
              [weekKey]: "This date is already assigned to another week",
            });
            return;
          }

          setSelectedDates((prev) => ({
            ...prev,
            [weekKey]: parsedDate,
          }));

          // Clear validation error for this week
          if (validationErrors[weekKey]) {
            const newErrors = { ...validationErrors };
            delete newErrors[weekKey];
            setValidationErrors(newErrors);
          }

          setTimeout(() => validateDates(), 0);
        } else {
          setValidationErrors({
            ...validationErrors,
            [weekKey]: "Please enter a valid date in the current month",
          });
        }
      } catch (error) {
        setValidationErrors({
          ...validationErrors,
          [weekKey]: "Please enter a valid date",
        });
      }
    },
    [
      currentMonth,
      selectedDates,
      validationErrors,
      formatDateToYYYYMMDD,
      isValidDate,
    ],
  );

  // Handle week card click
  const handleWeekClick = useCallback((weekKey) => {
    setActiveWeek((prev) => (prev === weekKey ? null : weekKey));
  }, []);

  const handleSave = useCallback(async () => {
    if (!validateDates()) return;

    const formattedDates = {};
    Object.keys(selectedDates).forEach((weekKey) => {
      formattedDates[weekKey] = formatDateToYYYYMMDD(selectedDates[weekKey]);
    });

    setSaving(true);
    try {
      const existingWeeks = await getWeeks();
      const existingByDate = new Map(existingWeeks.map((w) => [w.week, w.id]));

      const nextWeekIds = { ...weekIds };
      let createdCount = 0;
      let updatedCount = 0;
      let adoptedCount = 0;

      for (const weekKey of Object.keys(formattedDates)) {
        const date = formattedDates[weekKey];
        if (!date) continue;

        const knownId = weekIds[weekKey];
        if (knownId) {
          // Already tied to a saved row - edit it in place (a no-op on the
          // backend if the date didn't actually change).
          await updateWeek(knownId, date);
          updatedCount += 1;
          continue;
        }

        const existingId = existingByDate.get(date);
        if (existingId) {
          // This exact date is already saved under a different slot -
          // link to it instead of erroring out on a duplicate.
          nextWeekIds[weekKey] = existingId;
          adoptedCount += 1;
          continue;
        }

        const created = await createWeek(date);
        nextWeekIds[weekKey] = created.id;
        existingByDate.set(date, created.id);
        createdCount += 1;
      }

      setWeekIds(nextWeekIds);

      const parts = [];
      if (createdCount) parts.push(`${createdCount} added`);
      if (updatedCount) parts.push(`${updatedCount} updated`);
      if (adoptedCount) parts.push(`${adoptedCount} already saved`);
      showNotice(
        parts.length ? `Weeks saved: ${parts.join(", ")}.` : "Nothing to save.",
        "ok",
      );

      if (onChange) {
        onChange(formattedDates);
      }
    } catch (error) {
      showNotice(error.message || "Failed to save weeks.", "err");
    } finally {
      setSaving(false);
    }
  }, [
    selectedDates,
    weekIds,
    validateDates,
    formatDateToYYYYMMDD,
    onChange,
    showNotice,
  ]);

  // Navigate month
  const handleMonthChange = useCallback((month) => {
    setCurrentMonth(month);
  }, []);

  // Get the week label
  const getWeekLabel = useCallback((weekKey) => {
    const weekNumber = parseInt(weekKey.replace("week", ""));
    return `Week ${weekNumber}`;
  }, []);

  // Format date for display
  const formatDisplayDate = useCallback(
    (date) => {
      if (!date || !isValidDate(date)) return "No date selected";
      return format(date, "EEEE, MMMM d, yyyy");
    },
    [isValidDate],
  );

  // Memoized date values for calendar highlighting
  const highlightedDates = useMemo(() => {
    return Object.values(selectedDates).filter(
      (d) => d !== null && isValidDate(d),
    );
  }, [selectedDates, isValidDate]);

  // Check if a date is selected for a specific week
  const isDateSelectedForWeek = useCallback(
    (date, weekKey) => {
      if (!date) return false;
      const selectedDate = selectedDates[weekKey];
      return selectedDate && isSameDay(date, selectedDate);
    },
    [selectedDates],
  );

  // Get the week keys
  const weekKeys = useMemo(() => {
    return Object.keys(selectedDates).sort((a, b) => {
      const numA = parseInt(a.replace("week", ""));
      const numB = parseInt(b.replace("week", ""));
      return numA - numB;
    });
  }, [selectedDates]);

  // Get max weeks count info for display
  const weeksCount = useMemo(() => {
    return getWeeksCount(currentMonth);
  }, [currentMonth, getWeeksCount]);

  // Update input values when selectedDates changes (for initial load)
  useEffect(() => {
    const newInputValues = {};
    Object.keys(selectedDates).forEach((weekKey) => {
      const date = selectedDates[weekKey];
      if (date && isValidDate(date)) {
        newInputValues[weekKey] = format(date, "yyyy-MM-dd");
      } else {
        newInputValues[weekKey] = "";
      }
    });
    setInputValues(newInputValues);
  }, [selectedDates, isValidDate]);

  return (
    <div className="font-sans bg-gray-50 min-h-screen p-4 sm:p-5">
      <div className="max-w-[1400px] mx-auto mb-3">
        <Notice message={notice?.message} type={notice?.type} />
      </div>
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 max-w-[1400px] mx-auto bg-white rounded-xl shadow-md p-4 sm:p-6 lg:p-8">
        {/* Calendar Section - Always on top on mobile, left on desktop */}
        <div className="w-full lg:w-1/2 min-w-0 flex flex-col items-center">
          <div className="w-full max-w-md mx-auto lg:mx-0">
            <div className="mb-4 lg:hidden">
              <h3 className="text-lg font-semibold text-gray-800 text-center">
                Select Dates
              </h3>
              <p className="text-sm text-gray-500 text-center">
                Click a week below, then select a date on the calendar
              </p>
            </div>

            <div className="flex justify-center">
              <DayPicker
                mode="single"
                selected={activeWeek ? selectedDates[activeWeek] : null}
                onSelect={handleDateSelect}
                month={currentMonth}
                onMonthChange={handleMonthChange}
                modifiers={{
                  highlighted: highlightedDates,
                  active: (date) => {
                    if (!activeWeek) return false;
                    return isDateSelectedForWeek(date, activeWeek);
                  },
                }}
                modifiersStyles={{
                  highlighted: {
                    backgroundColor: "#e8f0fe",
                    color: "#1a73e8",
                    fontWeight: "bold",
                    borderRadius: "50%",
                  },
                  active: {
                    backgroundColor: "#1a73e8",
                    color: "white",
                    fontWeight: "bold",
                    borderRadius: "50%",
                  },
                }}
                disabled={[
                  { before: startOfMonth(currentMonth) },
                  { after: addDays(startOfMonth(currentMonth), 42) },
                ]}
                styles={{
                  caption: { color: "#1a2332" },
                  head: { color: "#6b7a8f" },
                  day: {
                    margin: "2px",
                    width: "40px",
                    height: "40px",
                  },
                }}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Weeks Section - Always on bottom on mobile, right on desktop */}
        <div className="w-full lg:w-1/2 min-w-0 flex flex-col gap-4 sm:gap-5">
          <div className="pb-3 sm:pb-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 m-0">
                  Configure Weekly Dates
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 font-medium">
                  {format(currentMonth, "MMMM yyyy")}
                </p>
              </div>
              <span className="text-xs sm:text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full whitespace-nowrap">
                {weeksCount} {weeksCount === 1 ? "Week" : "Weeks"}
              </span>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-2 sm:gap-3 max-h-[400px] sm:max-h-[500px] overflow-y-auto pr-1">
            {weekKeys.map((weekKey) => {
              const date = selectedDates[weekKey];
              const isActive = activeWeek === weekKey;
              const error = validationErrors[weekKey];
              const inputValue = inputValues[weekKey] || "";

              return (
                <div
                  key={weekKey}
                  className={`p-3 sm:p-4 border-2 rounded-lg transition-all duration-200 bg-white cursor-pointer
                    ${
                      isActive
                        ? "border-blue-600 bg-blue-50 shadow-[0_0_0_3px_rgba(26,115,232,0.1)]"
                        : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                    }
                    ${error ? "border-red-500 bg-red-50" : ""}
                  `}
                  onClick={() => handleWeekClick(weekKey)}
                >
                  <div className="flex flex-wrap justify-between items-center gap-2 mb-1 sm:mb-2">
                    <span className="font-semibold text-sm sm:text-base text-gray-800">
                      {getWeekLabel(weekKey)}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap
                      ${date && isValidDate(date) ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}
                    `}
                    >
                      {date && isValidDate(date) ? "✓ Selected" : "⚠ No date"}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center">
                    <div className="text-xs sm:text-sm text-gray-600 py-1 flex-1 min-w-0 break-words">
                      {date && isValidDate(date)
                        ? formatDisplayDate(date)
                        : "Click to select a date"}
                    </div>

                    {/* Date Input Field for Custom Entry */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="date"
                        className={`text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 border rounded-md focus:outline-none focus:ring-2 w-full sm:w-auto min-w-[130px]
                          ${
                            error
                              ? "border-red-500 focus:ring-red-500"
                              : "border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                          }
                        `}
                        value={inputValue}
                        onChange={(e) => handleDateInput(weekKey, e)}
                        onClick={(e) => e.stopPropagation()}
                        min={format(startOfMonth(currentMonth), "yyyy-MM-dd")}
                        max={format(
                          addDays(startOfMonth(currentMonth), 42),
                          "yyyy-MM-dd",
                        )}
                      />
                    </div>
                  </div>

                  {isActive && (
                    <div className="mt-2 text-xs text-blue-600">
                      💡 Click a date on the calendar or use the date picker
                    </div>
                  )}

                  {error && (
                    <div className="mt-2 text-xs text-red-500 bg-red-50 px-2 py-1 rounded">
                      ⚠ {error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-3 sm:pt-4 border-t border-gray-200 flex flex-col gap-2 sm:gap-2.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                className={`flex-1 py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg text-sm sm:text-base font-medium transition-all duration-200
                  ${
                    isFormValid && !saving && !loadingMonth
                      ? "bg-blue-600 text-white hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-lg"
                      : "bg-gray-400 text-white cursor-not-allowed"
                  }
                `}
                onClick={handleSave}
                disabled={!isFormValid || saving || loadingMonth}
              >
                {saving ? "Saving…" : "💾 Save Configuration"}
              </button>
              <button
                className="py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg text-sm sm:text-base font-medium border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={saving || loadingMonth}
                onClick={() => {
                  const weekStarts = calculateFirstDayOfEachWeek(currentMonth);
                  const newDates = {};
                  const newInputs = {};
                  weekStarts.forEach((weekStart, index) => {
                    const weekKey = `week${index + 1}`;
                    newDates[weekKey] = weekStart;
                    newInputs[weekKey] = format(weekStart, "yyyy-MM-dd");
                  });
                  setSelectedDates(newDates);
                  setInputValues(newInputs);
                  setActiveWeek(null);
                  setValidationErrors({});
                  // Deliberately keep weekIds as-is: each slot may still be
                  // tied to a saved row, and Reset only changes what date is
                  // *displayed* for it. Clearing weekIds here used to make
                  // Save treat every slot as brand new, so instead of
                  // editing the existing row in place it inserted a new one
                  // and left the old row behind under its original date.
                }}
              >
                ↩️ Reset to Week Start Dates
              </button>
            </div>
            {loadingMonth && (
              <div className="text-xs sm:text-sm text-gray-500 text-center py-2 px-3 bg-gray-50 rounded">
                Loading saved weeks for this month…
              </div>
            )}
            {!isFormValid && Object.keys(validationErrors).length > 0 && (
              <div className="text-xs sm:text-sm text-red-500 text-center py-2 px-3 bg-red-50 rounded">
                ⚠ Please fix validation errors before saving
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyDateSelector;
