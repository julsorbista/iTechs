import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { handleAPIError, userAPI } from '../../utils/api';

const splitUsersByRole = (users = []) => ({
  allUsers: users,
  teachers: users.filter((user) => user.role === 'TEACHER'),
  students: users.filter((user) => user.role === 'STUDENT'),
});

export const useAdminDirectory = () => {
  const [allUsers, setAllUsers] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const applyUsers = useCallback((users = []) => {
    const nextState = splitUsersByRole(users);
    setAllUsers(nextState.allUsers);
    setTeachers(nextState.teachers);
    setStudents(nextState.students);
  }, []);

  const refreshAdminData = useCallback(async () => {
    const response = await userAPI.getUsers();

    if (response.status === 'success') {
      applyUsers(response.data.users || []);
    }
  }, [applyUsers]);

  useEffect(() => {
    let cancelled = false;

    const loadAdminData = async () => {
      try {
        await refreshAdminData();
      } catch (error) {
        if (!cancelled) {
          toast.error(handleAPIError(error).message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadAdminData();

    return () => {
      cancelled = true;
    };
  }, [refreshAdminData]);

  return {
    allUsers,
    teachers,
    students,
    isLoading,
    refreshAdminData,
  };
};
