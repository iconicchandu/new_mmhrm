"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Play,
  Pause,
  Coffee,
  MapPin,
  CheckCircle,
  AlertCircle,
  Timer,
  History,
  Calendar,
  User
} from "lucide-react";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/auth/client";
import { format, parseISO, differenceInSeconds, differenceInMinutes, differenceInHours } from "date-fns";

interface CurrentTimeEntry {
  id: string;
  clock_in: string;
  clock_out?: string;
  break_start?: string;
  break_end?: string;
  status: 'active' | 'completed' | 'break';
  location?: string;
  total_hours?: number;
  break_duration: number;
}

interface RecentActivity {
  id: string;
  clock_in: string;
  clock_out?: string;
  total_hours?: number;
  status: 'active' | 'completed' | 'break';
  date: string;
}

export function TimeTrackingWidget() {
  const [currentEntry, setCurrentEntry] = useState<CurrentTimeEntry | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [breakTime, setBreakTime] = useState(0);
  const [isRealTime, setIsRealTime] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Real-time clock update
  useEffect(() => {
    setCurrentTime(new Date());
    clockIntervalRef.current = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      if (clockIntervalRef.current) clearInterval(clockIntervalRef.current);
    };
  }, []);

  // Timer update for current entry
  useEffect(() => {
    const updateTimer = () => {
      if (currentEntry?.status === 'active') {
        const clockInTime = new Date(currentEntry.clock_in).getTime();
        const now = Date.now();
        const elapsed = now - clockInTime;
        setElapsedTime(elapsed);
      } else if (currentEntry?.status === 'break' && currentEntry.break_start) {
        const breakStartTime = new Date(currentEntry.break_start).getTime();
        const now = Date.now();
        const breakElapsed = now - breakStartTime;
        setBreakTime(breakElapsed);
      }
    };

    if (currentEntry?.status === 'active' || currentEntry?.status === 'break') {
      updateTimer();
      intervalRef.current = setInterval(updateTimer, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentEntry]);

  // Fetch current time entry
  const fetchCurrentEntry = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        console.log('[Time Widget] No user found');
        return;
      }

      console.log('[Time Widget] Fetching current entry for user:', user.id);
      const response = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_current' })
      });
      console.log('[Time Widget] Response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('[Time Widget] Current entry result:', result);
        console.log('[Time Widget] Setting current entry:', result.data);
        setCurrentEntry(result.data);
        setIsRealTime(true);

        // If there's an active entry, start the timer immediately
        if (result.data && result.data.status === 'active') {
          console.log('[Time Widget] Active session detected, starting timer');
        }
      } else {
        console.error('[Time Widget] Failed to fetch current entry:', response.status);
        if (response.status === 404) {
          console.log('[Time Widget] Time tracking API not available');
        } else if (response.status === 401) {
          console.log('[Time Widget] User not authenticated');
        }
        setCurrentEntry(null);
      }
    } catch (error) {
      console.error('Error fetching current entry:', error);
      setCurrentEntry(null);
    }
  };

  // Fetch recent activities
  const fetchRecentActivities = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        console.log('[Time Widget] No user found for fetching activities');
        return;
      }

      console.log('[Time Widget] Fetching recent activities for user:', user.id, typeof user.id);
      const response = await fetch('/api/time-entries');
      console.log('[Time Widget] Activities response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('[Time Widget] Activities result:', result);
        if (result.success && result.data) {
          // Take only the first 3 entries
          const recentEntries = result.data.slice(0, 3);
          console.log('[Time Widget] Setting recent activities:', recentEntries.length, 'entries');
          console.log('[Time Widget] Recent entries data:', recentEntries);
          setRecentActivities(recentEntries);
        } else {
          console.error('[Time Widget] API returned error:', result.error);
          console.log('[Time Widget] Full result:', result);
        }
      } else {
        console.error('[Time Widget] Failed to fetch activities:', response.status);
        const errorText = await response.text();
        console.error('[Time Widget] Error response:', errorText);
      }
    } catch (error) {
      console.error('[Time Widget] Error fetching recent activities:', error);
    }
  };

  useEffect(() => {
    const initializeWidget = async () => {
      const user = await getCurrentUser();
      console.log('[Time Widget] Initializing with user:', user);
      if (user) {
        console.log('[Time Widget] User ID:', user.id, typeof user.id);
      }
      await Promise.all([
        fetchCurrentEntry(),
        fetchRecentActivities()
      ]);
      // Small delay for smooth skeleton-to-content transition
      setTimeout(() => setIsLoading(false), 150);
    };

    initializeWidget();
  }, []);

  // Format time display
  const formatTime = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format detailed time with hours, minutes, seconds
  const formatDetailedTime = (milliseconds: number): string => {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Format activity time
  const formatActivityTime = (timeString: string): string => {
    try {
      const date = parseISO(timeString);
      return format(date, 'HH:mm:ss');
    } catch {
      return timeString;
    }
  };

  // Format activity duration in HH:MM:SS format
  const formatActivityDuration = (clockIn: string, clockOut?: string): string => {
    if (!clockOut) return 'In Progress';

    try {
      const start = parseISO(clockIn);
      const end = parseISO(clockOut);
      const durationMs = end.getTime() - start.getTime();

      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);

      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } catch {
      return 'Unknown';
    }
  };

  // Clock in
  const handleClockIn = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) {
        console.log('[Time Widget] No user found for clock in');
        toast.error("Please log in to clock in");
        return;
      }

      console.log('[Time Widget] Clocking in user:', user.id, user.role);
      const response = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clock_in'
        })
      });

      console.log('[Time Widget] Clock in response status:', response.status);
      const result = await response.json();
      console.log('[Time Widget] Clock in result:', result);

      if (result.success) {
        toast.success("Clocked in successfully!", {
          description: `Started at ${new Date().toLocaleTimeString()}`
        });
        setCurrentEntry(result.data);

        // Dispatch custom event for real-time updates
        window.dispatchEvent(new CustomEvent('timeTrackingChanged'));
        // Refresh recent activities after a short delay to ensure data is saved
        setTimeout(() => {
          fetchRecentActivities();
        }, 1000);
      } else {
        console.error('[Time Widget] Clock in failed:', result.error);
        toast.error(result.error || "Failed to clock in");
      }
    } catch (error) {
      console.error('[Time Widget] Error clocking in:', error);
      toast.error("Failed to clock in");
    } finally {
      setIsLoading(false);
    }
  };

  // Clock out
  const handleClockOut = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clock_out' })
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Clocked out successfully!", {
          description: `Total hours: ${result.data.total_hours?.toFixed(2) || '0'}h`
        });
        setCurrentEntry(null);
        setElapsedTime(0);
        setBreakTime(0);

        // Dispatch custom event for real-time updates
        window.dispatchEvent(new CustomEvent('timeTrackingChanged'));
        // Refresh recent activities after a short delay to ensure data is saved
        setTimeout(() => {
          fetchRecentActivities();
        }, 1000);
      } else {
        toast.error(result.error || "Failed to clock out");
      }
    } catch (error) {
      console.error('Error clocking out:', error);
      toast.error("Failed to clock out");
    } finally {
      setIsLoading(false);
    }
  };

  // Start break
  const handleStartBreak = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_break' })
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Break started", {
          description: "Enjoy your break!"
        });
        setCurrentEntry(result.data);
        setBreakTime(0);

        // Dispatch custom event for real-time updates
        window.dispatchEvent(new CustomEvent('timeTrackingChanged'));
        // Refresh recent activities after a short delay to ensure data is saved
        setTimeout(() => {
          fetchRecentActivities();
        }, 1000);
      } else {
        toast.error(result.error || "Failed to start break");
      }
    } catch (error) {
      console.error('Error starting break:', error);
      toast.error("Failed to start break");
    } finally {
      setIsLoading(false);
    }
  };

  // End break
  const handleEndBreak = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end_break' })
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Break ended", {
          description: "Welcome back to work!"
        });
        setCurrentEntry(result.data);
        setBreakTime(0);

        // Dispatch custom event for real-time updates
        window.dispatchEvent(new CustomEvent('timeTrackingChanged'));
        // Refresh recent activities after a short delay to ensure data is saved
        setTimeout(() => {
          fetchRecentActivities();
        }, 1000);
      } else {
        toast.error(result.error || "Failed to end break");
      }
    } catch (error) {
      console.error('Error ending break:', error);
      toast.error("Failed to end break");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!currentEntry) return null;

    switch (currentEntry.status) {
      case 'active':
        return <Badge className=" bg-green-400/50 text-white hover:bg-green-100 text-[10px]">Active</Badge>;
      case 'break':
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 text-xs">On Break</Badge>;
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs">Completed</Badge>;
      default:
        return null;
    }
  };

  const content = isLoading ? (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
            <div className="skeleton h-5 w-5 opacity-60" />
          </div>
          <div>
            <div className="skeleton h-4 w-28 mb-1" />
            <div className="skeleton h-3 w-20" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="skeleton h-7 w-20" />
        </div>
      </div>
      <div className="mb-4 pb-3 border-b border-white/20">
        <div className="flex items-center justify-between text-xs text-blue-100">
          <div className="skeleton h-4 w-40" />
          <div className="skeleton h-4 w-24" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="skeleton h-10 w-full bg-white/20" />
        <div className="skeleton h-10 w-full bg-white/20" />
        <div className="skeleton h-10 w-full bg-white/20" />
      </div>
    </div>
  ) : (<>
    {/* Header Section */}
    <div className="flex items-center justify-between mb-4">
      {/* Left side - Status and Time */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Time Tracking</span>
              {isRealTime && (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-200">Live</span>
                </div>
              )}
            </div>
            {currentEntry ? (
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge()}
                <span className="text-xs text-blue-100">
                  Since {formatActivityTime(currentEntry.clock_in)}
                </span>
              </div>
            ) : (
              <span className="text-xs text-blue-100">Ready to clock in</span>
            )}
          </div>
        </div>

      </div>

      {/* Right side - Action Buttons */}
      <div className="flex items-center gap-2">
        {currentEntry ? (
          <>
            {currentEntry.status === 'active' && (
              <>
                <Button
                  onClick={handleClockOut}
                  disabled={isLoading}
                  size="sm"
                  className="bg-red-500/80 hover:bg-red-600/80 text-white"
                >
                  <Pause className="w-4 h-4 mr-1" />
                  Clock Out
                </Button>
              </>
            )}
          </>
        ) : (
          <Button
            onClick={handleClockIn}
            disabled={isLoading}
            size="sm"
            className="bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            <Play className="w-4 h-4 mr-1" />
            {isLoading ? "Clocking In..." : "Clock In"}
          </Button>
        )}
      </div>
    </div>

    {/* Real-time Timer */}
    {currentEntry && (
          <div className="bg-white/10 backdrop-blur-sm rounded-lg px-2 py-[3px] min-w-[120px] mb-4">
            <div className="flex items-center justify-between text-center">
              <div className="text-sm font-mono font-bold">
                {currentEntry.status === 'break'
                  ? formatTime(breakTime)
                  : formatTime(elapsedTime)
                }
              </div>
              <div className="text-xs text-blue-200">
                {currentEntry.status === 'break' ? 'Break Time' : 'Work Time'}
              </div>
            </div>
          </div>
        )}

    {/* Current Time Display */}
    <div className="mb-4 pb-3 border-b border-white/20">
      <div className="flex items-center justify-between text-xs text-blue-100">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Current Time: {format(currentTime, 'HH:mm:ss')}</span>
          </div>
          {currentEntry?.location && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>{currentEntry.location}</span>
            </div>
          )}
        </div>
        <div className="text-blue-200">
          {format(currentTime, 'MMM dd, yyyy')}
        </div>
      </div>
    </div>

    {/* Recent Attendance Records */}
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-blue-200" />
        <h3 className="text-sm font-medium text-blue-100">Recent Attendance</h3>
      </div>

      {recentActivities.length > 0 ? (
        <div className="space-y-2">
          {recentActivities.slice(0, 3).map((activity, index) => (
            <div key={activity.id} className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${activity.status === 'completed' ? 'bg-green-400/80' :
                      activity.status === 'active' ? 'bg-blue-400/80' : 'bg-orange-400/80'
                    }`}>
                    {activity.status === 'completed' ? (
                      <CheckCircle className="w-3 h-3 text-white" />
                    ) : activity.status === 'active' ? (
                      <Clock className="w-3 h-3 text-white" />
                    ) : (
                      <Coffee className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white">
                      {format(parseISO(activity.date), 'MMM dd, yyyy')}
                    </div>
                    <div className="text-xs text-blue-200">
                      {activity.status === 'completed' ? 'Work Session' :
                        activity.status === 'active' ? 'Active Session' : 'Break Session'}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-mono text-white">
                    {formatActivityTime(activity.clock_in)}
                    {activity.clock_out && (
                      <span className="text-blue-200"> - {formatActivityTime(activity.clock_out)}</span>
                    )}
                  </div>
                  <div className="text-xs text-blue-200">
                    Total: {formatActivityDuration(activity.clock_in, activity.clock_out)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-blue-200">
          <Clock className="w-6 h-6 mx-auto mb-2 opacity-50" />
          <p className="text-xs">No recent attendance records</p>
        </div>
      )}
    </div>
  </>);

  return (
    <Card className="bg-gradient-to-br from-blue-500 to-red-600 text-white border-0 shadow-lg">
      <CardContent className="px-3 py-0">
        {content}
      </CardContent>
    </Card>
  );
}
