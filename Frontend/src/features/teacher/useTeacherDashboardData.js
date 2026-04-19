import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { handleAPIError, userAPI } from '../../utils/api';

export const useTeacherDashboardData = (selectedStudentId, onStudentSelectionChange) => {
  const [isLoading, setIsLoading] = useState(true);
  const [roster, setRoster] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [flags, setFlags] = useState([]);

  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      const [rosterRes, leaderboardRes, flagsRes] = await Promise.all([
        userAPI.getMyStudentsRoster({ isArchived: 'false', limit: 100 }),
        userAPI.getRosterLeaderboard(),
        userAPI.getMyContentFlags(),
      ]);

      if (rosterRes.status === 'success') {
        const students = rosterRes.data.students || [];
        setRoster(students);

        if (typeof onStudentSelectionChange === 'function') {
          const nextSelectedStudent = students.find((student) => student.id === selectedStudentId) || students[0] || null;
          onStudentSelectionChange(nextSelectedStudent?.id || null);
        }
      }

      if (leaderboardRes.status === 'success') {
        setLeaderboard(leaderboardRes.data.leaderboard || []);
      }

      if (flagsRes.status === 'success') {
        setFlags(flagsRes.data.flags || []);
      }
    } catch (error) {
      toast.error(handleAPIError(error).message);
    } finally {
      setIsLoading(false);
    }
  }, [onStudentSelectionChange, selectedStudentId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return {
    isLoading,
    roster,
    leaderboard,
    flags,
    loadDashboard,
  };
};
