import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Activity,
  BarChart3,
  Flag,
  KeyRound,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Trophy,
  UserRound,
  Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authAPI, userAPI, handleAPIError } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useTeacherDashboardData } from '../features/teacher/useTeacherDashboardData';
import { GAME_TYPE_ORDER, getGameTrackLabel, normalizeGameType, sortByGameType } from '../utils/gameTracks';
import logo from '../assets/logo.png';

const CLASS_SECTION_ALL = 'ALL';

const PERFORMANCE_BAND_META = {
  SUPPORT: {
    label: 'Support Band',
    badgeClass: 'bg-rose-100 text-rose-700 border-rose-300'
  },
  PROGRESS: {
    label: 'Progress Band',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300'
  },
  MASTERY: {
    label: 'Mastery Band',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-300'
  }
};

const getStudentDisplayName = (student) => {
  if (!student) {
    return 'No student selected';
  }

  const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
  return fullName || student.username || student.email || 'Unnamed student';
};

const getStudentSectionLabel = (student) => String(student?.section || '').trim() || 'Unassigned';

const getPerformanceBandKey = (student) => {
  const progressPercent = Number(student?.metrics?.progressPercent || 0);

  if (progressPercent >= 80) {
    return 'MASTERY';
  }

  if (progressPercent >= 40) {
    return 'PROGRESS';
  }

  return 'SUPPORT';
};

const getPerformanceBandMeta = (student) => PERFORMANCE_BAND_META[getPerformanceBandKey(student)] || PERFORMANCE_BAND_META.SUPPORT;

const formatDateTime = (value) => {
  if (!value) {
    return 'No activity yet';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
};

const getRecentActivityLabel = (value) => {
  if (!value) {
    return 'No activity yet';
  }

  const daysSince = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);

  if (daysSince <= 0) {
    return 'Active today';
  }

  if (daysSince === 1) {
    return 'Active yesterday';
  }

  if (daysSince < 7) {
    return `Active ${daysSince} days ago`;
  }

  return `Inactive for ${daysSince} days`;
};

const TeacherPage = () => {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('roster');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSection, setSelectedSection] = useState(CLASS_SECTION_ALL);
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    email: ''
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [teacherCourseCode, setTeacherCourseCode] = useState('');
  const [isLoadingCourseCode, setIsLoadingCourseCode] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    difficultyPreset: 'STANDARD',
    freeMistakes: 3,
    hintStarCost: 1,
    notes: ''
  });
  const [flagForm, setFlagForm] = useState({
    gameType: 'GAME_ONE',
    levelNumber: 1,
    reason: ''
  });
  const [levelCompletionRows, setLevelCompletionRows] = useState([]);
  const [levelCompletionLoading, setLevelCompletionLoading] = useState(false);
  const {
    isLoading,
    roster,
    leaderboard,
    flags,
    loadDashboard,
  } = useTeacherDashboardData(selectedStudentId, setSelectedStudentId);

  const selectedStudent = useMemo(
    () => roster.find((item) => item.id === selectedStudentId) || null,
    [roster, selectedStudentId]
  );

  const sectionOptions = useMemo(() => (
    [
      CLASS_SECTION_ALL,
      ...new Set(
        roster
          .map((student) => getStudentSectionLabel(student))
          .filter(Boolean)
          .sort((left, right) => left.localeCompare(right))
      )
    ]
  ), [roster]);

  const filteredRoster = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return roster.filter((student) => {
      const studentSection = getStudentSectionLabel(student);
      const matchesSection = selectedSection === CLASS_SECTION_ALL || studentSection === selectedSection;

      if (!matchesSection) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        student.firstName,
        student.lastName,
        student.username,
        student.email,
        studentSection,
        getStudentDisplayName(student)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [roster, searchTerm, selectedSection]);

  const filteredLeaderboard = useMemo(() => {
    const visibleStudentIds = new Set(filteredRoster.map((student) => student.id));
    return leaderboard.filter((entry) => visibleStudentIds.has(entry.studentId));
  }, [leaderboard, filteredRoster]);

  const levelCompletionByGame = useMemo(() => (
    GAME_TYPE_ORDER.map((gameType) => ({
      gameType,
      levels: levelCompletionRows.filter((row) => row.gameType === gameType),
    }))
  ), [levelCompletionRows]);

  const rosterSummary = useMemo(() => {
    const totalStudents = filteredRoster.length;
    const totalProgress = filteredRoster.reduce((sum, student) => sum + Number(student.metrics?.progressPercent || 0), 0);
    const needsSupportCount = filteredRoster.filter((student) => getPerformanceBandKey(student) === 'SUPPORT').length;
    const masteryCount = filteredRoster.filter((student) => getPerformanceBandKey(student) === 'MASTERY').length;
    const activeThisWeekCount = filteredRoster.filter((student) => {
      if (!student.metrics?.lastAttemptAt) {
        return false;
      }

      const daysSince = Math.floor((Date.now() - new Date(student.metrics.lastAttemptAt).getTime()) / 86400000);
      return daysSince <= 7;
    }).length;
    const sectionCount = new Set(filteredRoster.map((student) => getStudentSectionLabel(student))).size;

    return {
      totalStudents,
      averageProgress: totalStudents > 0 ? Math.round(totalProgress / totalStudents) : 0,
      needsSupportCount,
      masteryCount,
      activeThisWeekCount,
      sectionCount
    };
  }, [filteredRoster]);

  const performanceOverview = useMemo(() => {
    if (!filteredRoster.length) {
      return {
        strongestSignal: 'No students in the current filter yet.',
        weakestSignal: 'Add students to start tracking performance.',
      };
    }

    const sortedByStars = [...filteredRoster].sort(
      (left, right) => Number(right.metrics?.totalStars || 0) - Number(left.metrics?.totalStars || 0)
    );
    const sortedByCompletion = [...filteredRoster].sort(
      (left, right) => Number(right.metrics?.completedLevels || 0) - Number(left.metrics?.completedLevels || 0)
    );
    const sortedByNeeds = [...filteredRoster].sort((left, right) => {
      const leftScore = Number(left.metrics?.completedLevels || 0) + Number(left.metrics?.totalStars || 0);
      const rightScore = Number(right.metrics?.completedLevels || 0) + Number(right.metrics?.totalStars || 0);
      return leftScore - rightScore;
    });

    const topStarStudent = sortedByStars[0];
    const topCompletionStudent = sortedByCompletion[0];
    const supportStudent = sortedByNeeds[0];

    return {
      strongestSignal: `${getStudentDisplayName(topStarStudent)} leads star collection with ${topStarStudent?.metrics?.totalStars || 0} stars.`,
      strongestCompletion: `${getStudentDisplayName(topCompletionStudent)} has cleared ${topCompletionStudent?.metrics?.completedLevels || 0} levels.`,
      weakestSignal: `${getStudentDisplayName(supportStudent)} may need support with ${supportStudent?.metrics?.completedLevels || 0} completed levels and ${supportStudent?.metrics?.totalStars || 0} stars.`,
    };
  }, [filteredRoster]);

  const studentInsights = useMemo(() => {
    if (!selectedStudent || !studentDetail) {
      return null;
    }

    const completedLevels = studentDetail.levelProgress.filter((level) => level.status === 'COMPLETED');
    const totalLevels = studentDetail.summary?.totalLevels || studentDetail.levelProgress.length || 1;
    const recentAttempts = studentDetail.timeline.slice(0, 5);
    const recentWins = recentAttempts.filter((attempt) => attempt.completed).length;
    const recentWinRate = recentAttempts.length > 0
      ? Math.round((recentWins / recentAttempts.length) * 100)
      : 0;

    const rankedLevels = [...studentDetail.levelProgress]
      .filter((level) => Number(level.bestScore || 0) > 0)
      .sort((a, b) => Number(b.bestScore || 0) - Number(a.bestScore || 0));

    const strongestLevel = rankedLevels[0] || null;
    const focusLevel = studentDetail.levelProgress.find((level) => level.status !== 'COMPLETED')
      || studentDetail.levelProgress[studentDetail.levelProgress.length - 1]
      || null;

    const leaderboardEntry = leaderboard.find((entry) => entry.studentId === selectedStudent.id) || null;
    const completionRate = Math.round((Number(studentDetail.summary?.totalLevelsCompleted || 0) / totalLevels) * 100);
    const averageStars = completedLevels.length > 0
      ? (Number(studentDetail.summary?.totalStars || 0) / completedLevels.length).toFixed(1)
      : '0.0';

    let recommendedAction = 'Maintain the current pace and keep checking recent attempts.';
    if (getPerformanceBandKey(selectedStudent) === 'SUPPORT') {
      recommendedAction = 'Review early levels, add more guidance notes, and consider a lighter preset.';
    } else if (getPerformanceBandKey(selectedStudent) === 'MASTERY') {
      recommendedAction = 'Keep momentum high with tougher pacing and leaderboard goals.';
    }

    const averageStarsValue = Number(averageStars);
    const strengths = [];
    const weaknesses = [];

    if (completionRate >= 70) {
      strengths.push(`Strong completion pace with ${completionRate}% of assigned levels cleared.`);
    } else if (completionRate <= 40) {
      weaknesses.push(`Only ${completionRate}% of assigned levels are completed so far.`);
    }

    if (averageStarsValue >= 2.4) {
      strengths.push(`High star efficiency with an average of ${averageStars} stars on completed levels.`);
    } else if (averageStarsValue > 0 && averageStarsValue < 1.8) {
      weaknesses.push(`Average star gain is ${averageStars}, so replay support may help improve results.`);
    }

    if ((leaderboardEntry?.totalStars || 0) >= 15) {
      strengths.push(`Collected ${leaderboardEntry.totalStars} total stars across completed work.`);
    }

    if ((leaderboardEntry?.completedLevels || 0) <= 2) {
      weaknesses.push('Very few levels have been fully cleared yet.');
    }

    if (recentWinRate >= 60) {
      strengths.push(`Recent attempt quality is solid with a ${recentWinRate}% win rate.`);
    } else if (recentAttempts.length > 0 && recentWinRate < 50) {
      weaknesses.push(`Recent attempts show a ${recentWinRate}% win rate and may need reinforcement.`);
    }

    if (!strengths.length) {
      strengths.push('The student is building momentum and has room to strengthen star collection.');
    }

    if (!weaknesses.length) {
      weaknesses.push('No immediate weakness stands out from stars earned and completed levels.');
    }

    return {
      completionRate,
      averageStars,
      recentAttempts,
      recentWinRate,
      strongestLevel,
      focusLevel,
      leaderboardEntry,
      activityLabel: getRecentActivityLabel(selectedStudent.metrics?.lastAttemptAt),
      recommendedAction,
      classSection: getStudentSectionLabel(selectedStudent),
      performanceBand: getPerformanceBandMeta(selectedStudent),
      strengths,
      weaknesses
    };
  }, [selectedStudent, studentDetail, leaderboard]);

  const loadStudentDetail = async (studentId) => {
    if (!studentId) {
      setStudentDetail(null);
      return;
    }

    try {
      setDetailLoading(true);
      setStudentDetail(null);
      const response = await userAPI.getStudentProgress(studentId);
      if (response.status === 'success') {
        setStudentDetail(response.data);
        const policy = response.data.policy || {};
        setPolicyForm({
          difficultyPreset: policy.difficultyPreset || 'STANDARD',
          freeMistakes: policy.freeMistakes ?? 3,
          hintStarCost: policy.hintStarCost ?? 1,
          notes: policy.notes || ''
        });
      }
    } catch (error) {
      const errorInfo = handleAPIError(error);
      toast.error(errorInfo.message);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    setProfileForm({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || ''
    });
  }, [user]);

  useEffect(() => {
    if (filteredRoster.length === 0) {
      setSelectedStudentId(null);
      setStudentDetail(null);
      return;
    }

    if (!filteredRoster.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId(filteredRoster[0].id);
    }
  }, [filteredRoster, selectedStudentId]);

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentDetail(selectedStudentId);
    }
  }, [selectedStudentId]);

  useEffect(() => {
    let isCancelled = false;

    const loadTeacherCourseCode = async () => {
      if (user?.role !== 'TEACHER') {
        setTeacherCourseCode('');
        return;
      }

      try {
        setIsLoadingCourseCode(true);
        const response = await userAPI.getMyCourseCode();
        if (!isCancelled && response.status === 'success') {
          setTeacherCourseCode(response.data.courseCode || '');
        }
      } catch (error) {
        if (!isCancelled) {
          const errorInfo = handleAPIError(error);
          toast.error(errorInfo.message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingCourseCode(false);
        }
      }
    };

    loadTeacherCourseCode();

    return () => {
      isCancelled = true;
    };
  }, [user?.role]);

  useEffect(() => {
    let isCancelled = false;

    const loadLevelCompletionSummary = async () => {
      if (activeTab !== 'difficulty') {
        return;
      }

      if (!filteredRoster.length) {
        setLevelCompletionRows([]);
        setLevelCompletionLoading(false);
        return;
      }

      setLevelCompletionLoading(true);

      const progressResponses = await Promise.all(
        filteredRoster.map(async (student) => {
          try {
            const response = await userAPI.getStudentProgress(student.id);
            return response?.status === 'success' ? response.data : null;
          } catch (error) {
            return null;
          }
        })
      );

      if (isCancelled) {
        return;
      }

      const levelMap = new Map();

      progressResponses.forEach((detail) => {
        const levelProgress = Array.isArray(detail?.levelProgress) ? detail.levelProgress : [];

        levelProgress.forEach((level) => {
          const normalizedGameType = normalizeGameType(level?.gameType);
          const levelNumber = Number(level?.levelNumber);

          if (!normalizedGameType || !Number.isFinite(levelNumber) || levelNumber <= 0) {
            return;
          }

          const key = `${normalizedGameType}:${levelNumber}`;

          if (!levelMap.has(key)) {
            levelMap.set(key, {
              gameType: normalizedGameType,
              levelNumber,
              completedCount: 0,
            });
          }

          if (level.status === 'COMPLETED') {
            levelMap.get(key).completedCount += 1;
          }
        });
      });

      const orderedRows = [...levelMap.values()].sort((left, right) => {
        const gameSort = sortByGameType(left.gameType, right.gameType);
        if (gameSort !== 0) {
          return gameSort;
        }
        return left.levelNumber - right.levelNumber;
      });

      setLevelCompletionRows(orderedRows);
      setLevelCompletionLoading(false);
    };

    loadLevelCompletionSummary();

    return () => {
      isCancelled = true;
    };
  }, [activeTab, filteredRoster]);

  const onSaveProfile = async () => {
    const trimmedEmail = profileForm.email.trim();
    if (!trimmedEmail) {
      toast.error('Email is required');
      return;
    }

    try {
      setIsSavingProfile(true);
      const response = await authAPI.updateProfile({
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        email: trimmedEmail
      });

      if (response.status === 'success') {
        updateUser(response.data);
        setProfileForm({
          firstName: response.data.firstName || '',
          lastName: response.data.lastName || '',
          email: response.data.email || ''
        });
        toast.success('Teacher profile updated');
      }
    } catch (error) {
      const errorInfo = handleAPIError(error);
      toast.error(errorInfo.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const onChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('Complete all password fields');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New password and confirmation must match');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }

    try {
      setIsChangingPassword(true);
      const response = await authAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword
      });

      if (response.status === 'success') {
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        toast.success('Password changed successfully');
      }
    } catch (error) {
      const errorInfo = handleAPIError(error);
      toast.error(errorInfo.message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const onSavePolicy = async () => {
    if (!selectedStudentId) {
      return;
    }

    try {
      const payload = {
        ...policyForm,
        freeMistakes: Number(policyForm.freeMistakes),
        hintStarCost: Number(policyForm.hintStarCost)
      };

      const response = await userAPI.updateStudentPolicy(selectedStudentId, payload);
      if (response.status === 'success') {
        toast.success('Student policy updated');
        await loadStudentDetail(selectedStudentId);
      }
    } catch (error) {
      const errorInfo = handleAPIError(error);
      toast.error(errorInfo.message);
    }
  };

  const onRequestRegeneration = async () => {
    if (!selectedStudentId) {
      return;
    }

    if (!flagForm.reason || flagForm.reason.trim().length < 10) {
      toast.error('Please provide at least 10 characters for the reason');
      return;
    }

    try {
      const payload = {
        gameType: flagForm.gameType,
        levelNumber: Number(flagForm.levelNumber),
        reason: flagForm.reason.trim()
      };

      const response = await userAPI.requestContentRegeneration(selectedStudentId, payload);
      if (response.status === 'success') {
        toast.success('Regeneration request submitted');
        setFlagForm({ gameType: 'GAME_ONE', levelNumber: 1, reason: '' });
        await loadDashboard();
      }
    } catch (error) {
      const errorInfo = handleAPIError(error);
      toast.error(errorInfo.message);
    }
  };

  if (isLoading) {
    return (
      <div className="landscape-shell flex min-h-screen items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-7 text-center shadow-sm">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="landscape-shell page-enter">
      <header className="rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-black text-slate-900 md:text-2xl">
              <img src={logo} alt="iTECHS Logo" className="h-8 w-8 object-contain md:h-9 md:w-9" />
              Teacher Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600">{user?.firstName || user?.username}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/teacher/level-editor')} className="btn btn-primary">
              Level Editor
            </button>
            <button onClick={logout} className="btn btn-secondary">Sign Out</button>
          </div>
        </div>
      </header>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="grid min-h-[72vh] lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-slate-50 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Navigation</p>
            </div>

            <nav className="divide-y divide-slate-200 border-b border-slate-200">
              {[
                { id: 'roster', label: 'Overview', icon: Users },
                { id: 'difficulty', label: 'Progress', icon: Activity },
                { id: 'leaderboard', label: 'Ranking', icon: Trophy },
                { id: 'policy', label: 'Settings', icon: Settings2 }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold transition ${
                      activeTab === item.id
                        ? 'bg-white text-emerald-800'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="border-b border-slate-200 px-4 py-3 text-xs text-slate-600">
              <div className="flex items-center justify-between"><span>Students</span><span className="font-bold text-slate-900">{rosterSummary.totalStudents}</span></div>
              <div className="mt-1 flex items-center justify-between"><span>Avg. Progress</span><span className="font-bold text-slate-900">{rosterSummary.averageProgress}%</span></div>
              <div className="mt-1 flex items-center justify-between"><span>Needs Support</span><span className="font-bold text-rose-700">{rosterSummary.needsSupportCount}</span></div>
            </div>

            <div>
              <div className="border-b border-slate-200 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Student List</p>
              </div>
              <div className="max-h-75 divide-y divide-slate-200 overflow-y-auto">
                {filteredRoster.slice(0, 12).map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`flex w-full items-center justify-between px-4 py-2 text-left text-xs ${selectedStudentId === student.id ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-100'}`}
                  >
                    <span className="truncate pr-2 font-semibold">{getStudentDisplayName(student)}</span>
                    <span className="font-bold">{student.metrics?.progressPercent || 0}%</span>
                  </button>
                ))}
                {filteredRoster.length === 0 && (
                  <p className="px-4 py-3 text-xs text-slate-500">No students found.</p>
                )}
              </div>
            </div>
          </aside>

          <div className="min-w-0 overflow-y-auto bg-white">
          {activeTab === 'roster' && (
            <div>
              <div className="border-b border-slate-200 p-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <label className="relative">
                    <span className="sr-only">Search students</span>
                    <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      className="input-field pl-10"
                      placeholder="Search by name, username, or email"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Section</span>
                    <select
                      className="input-field"
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                    >
                      <option value={CLASS_SECTION_ALL}>All Sections</option>
                      {sectionOptions
                        .filter((section) => section !== CLASS_SECTION_ALL)
                        .map((section) => (
                          <option key={section} value={section}>{section}</option>
                        ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="grid border-b border-slate-200 sm:grid-cols-2 xl:grid-cols-5 sm:divide-x sm:divide-slate-200">
                <div className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Students</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">{rosterSummary.totalStudents}</p>
                </div>
                <div className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Average Progress</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">{rosterSummary.averageProgress}%</p>
                </div>
                <div className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Needs Support</p>
                  <p className="mt-1 text-2xl font-black text-rose-700">{rosterSummary.needsSupportCount}</p>
                </div>
                <div className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active This Week</p>
                  <p className="mt-1 text-2xl font-black text-emerald-700">{rosterSummary.activeThisWeekCount}</p>
                </div>
                <div className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sections</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">{rosterSummary.sectionCount}</p>
                </div>
              </div>

              <div className="grid gap-4 border-b border-slate-200 bg-slate-50 p-4 xl:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Strongest Signal</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{performanceOverview.strongestSignal}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Completion Lead</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{performanceOverview.strongestCompletion}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Watchlist</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{performanceOverview.weakestSignal}</p>
                </div>
              </div>

              <div className="grid xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
                <div className="overflow-hidden border-b border-slate-200 xl:border-b-0 xl:border-r">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
                    <h3 className="text-base font-black text-slate-900">Students</h3>
                    <span className="text-xs font-bold text-slate-600">{filteredRoster.length} records</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-120 border-collapse bg-white">
                      <thead>
                        <tr className="bg-slate-50 text-left text-sm text-slate-900">
                          <th className="border-b border-slate-200 px-4 py-3 font-black">Student</th>
                          <th className="border-b border-slate-200 px-4 py-3 font-black">Section</th>
                          <th className="border-b border-slate-200 px-4 py-3 font-black">Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRoster.map((student) => {
                          const isSelected = selectedStudentId === student.id;

                          return (
                            <tr
                              key={student.id}
                              onClick={() => setSelectedStudentId(student.id)}
                              className={`cursor-pointer border-b border-slate-100 last:border-b-0 ${isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50'}`}
                            >
                              <td className="px-4 py-3 align-top">
                                <p className="font-bold text-slate-900">{getStudentDisplayName(student)}</p>
                                <p className="text-xs text-slate-600">{student.username}</p>
                              </td>
                              <td className="px-4 py-3 align-top text-sm font-semibold text-slate-700">
                                {getStudentSectionLabel(student)}
                              </td>
                              <td className="px-4 py-3 align-top">
                                <div className="flex items-center gap-3">
                                  <div className="h-2.5 w-full max-w-30 overflow-hidden rounded-full bg-slate-200">
                                    <div className="h-full rounded-full bg-[#16876d]" style={{ width: `${student.metrics?.progressPercent || 0}%` }}></div>
                                  </div>
                                  <span className="text-sm font-bold text-slate-900">{student.metrics?.completedLevels || 0}/{student.metrics?.totalLevels || 1}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredRoster.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                              No matching students.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="self-start p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="text-base font-black text-slate-900">Selected Student</h3>
                    {studentInsights && (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                          {studentInsights.classSection}
                        </span>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${studentInsights.performanceBand.badgeClass}`}>
                          {studentInsights.performanceBand.label}
                        </span>
                      </div>
                    )}
                  </div>

                  {!selectedStudent && <p className="text-sm text-slate-600">Select a student to view details.</p>}
                  {selectedStudent && detailLoading && <p className="text-sm text-slate-600">Loading student details...</p>}

                  {selectedStudent && !detailLoading && studentDetail && studentInsights && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm font-bold text-slate-900">{getStudentDisplayName(selectedStudent)}</p>
                        <p className="mt-1 text-xs text-slate-600">{selectedStudent.email}</p>
                        <p className="mt-1 text-xs text-slate-600">Section: {studentInsights.classSection}</p>
                        <p className="mt-1 text-xs text-slate-600">Last attempt: {formatDateTime(selectedStudent.metrics?.lastAttemptAt)}</p>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">Completion</p>
                          <p className="mt-1 text-xl font-black text-slate-900">{studentInsights.completionRate}%</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">Win Rate</p>
                          <p className="mt-1 text-xl font-black text-slate-900">{studentInsights.recentWinRate}%</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">Average Stars</p>
                          <p className="mt-1 text-xl font-black text-amber-600">{studentInsights.averageStars}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">Rank</p>
                          <p className="mt-1 text-xl font-black text-emerald-700">{studentInsights.leaderboardEntry ? `#${studentInsights.leaderboardEntry.rank}` : '--'}</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <h4 className="text-sm font-black text-slate-900">Recent Attempts</h4>
                        <div className="mt-2 space-y-2">
                          {studentInsights.recentAttempts.slice(0, 3).map((attempt) => (
                            <div key={attempt.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                                <span>Level {attempt.levelNumber}</span>
                                <span>{attempt.completed ? 'Completed' : 'In progress'}</span>
                              </div>
                              <p className="mt-1 text-xs text-slate-600">Score {attempt.finalScore} | Stars {attempt.starsEarned}</p>
                            </div>
                          ))}
                          {studentInsights.recentAttempts.length === 0 && <p className="text-xs text-slate-500">No attempts recorded.</p>}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-[#16876d]" />
                          <h4 className="text-sm font-black text-slate-900">Performance Analytics</h4>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Strengths</p>
                            <div className="mt-2 space-y-2 text-sm text-emerald-950">
                              {studentInsights.strengths.map((item) => (
                                <p key={item}>{item}</p>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">Weaknesses</p>
                            <div className="mt-2 space-y-2 text-sm text-amber-950">
                              {studentInsights.weaknesses.map((item) => (
                                <p key={item}>{item}</p>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                          <span className="font-bold text-slate-900">Recommended action:</span> {studentInsights.recommendedAction}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab('policy')}
                        className="btn btn-primary w-full"
                      >
                        Open Settings
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'difficulty' && (
            <div>
              <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">Progress</h2>
                  <p className="text-sm text-gray-600 mt-1">Students who completed each level.</p>
                </div>
                <label className="min-w-[220px]">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Section</span>
                  <select
                    className="input-field"
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                  >
                    <option value={CLASS_SECTION_ALL}>All Sections</option>
                    {sectionOptions
                      .filter((section) => section !== CLASS_SECTION_ALL)
                      .map((section) => (
                        <option key={section} value={section}>{section}</option>
                      ))}
                  </select>
                </label>
              </div>

              {levelCompletionLoading && (
                <p className="p-4 text-sm text-slate-600">Loading level completion summary...</p>
              )}

              {!levelCompletionLoading && filteredRoster.length === 0 && (
                <p className="p-4 text-sm text-slate-600">No students available.</p>
              )}

              {!levelCompletionLoading && filteredRoster.length > 0 && (
                <div className="grid divide-y divide-slate-200 xl:grid-cols-3 xl:divide-x xl:divide-y-0">
                  {levelCompletionByGame.map((group) => (
                    <div key={group.gameType} className="p-4">
                      <h3 className="text-base font-black text-slate-900">{getGameTrackLabel(group.gameType)}</h3>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-80 border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-left text-sm text-slate-900">
                              <th className="border-b border-slate-200 px-3 py-2 font-black">Level</th>
                              <th className="border-b border-slate-200 px-3 py-2 font-black">Students Completed</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.levels.map((row) => (
                              <tr key={`${row.gameType}-${row.levelNumber}`} className="border-b border-slate-100 last:border-b-0">
                                <td className="px-3 py-2 text-sm font-semibold text-slate-800">Level {row.levelNumber}</td>
                                <td className="px-3 py-2 text-sm font-black text-slate-900">{row.completedCount}</td>
                              </tr>
                            ))}
                            {group.levels.length === 0 && (
                              <tr>
                                <td colSpan={2} className="px-3 py-4 text-sm text-slate-500">No level data available.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div>
              <div className="flex flex-col gap-2 border-b border-slate-200 p-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">Ranking</h2>
                  <p className="text-sm text-gray-600 mt-1">Uses the same filters from Overview.</p>
                </div>
                <div className="flex flex-col gap-2 md:items-end">
                  <label className="min-w-[220px]">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Section</span>
                    <select
                      className="input-field"
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                    >
                      <option value={CLASS_SECTION_ALL}>All Sections</option>
                      {sectionOptions
                        .filter((section) => section !== CLASS_SECTION_ALL)
                        .map((section) => (
                          <option key={section} value={section}>{section}</option>
                        ))}
                    </select>
                  </label>
                  <div className="rounded-full border border-amber-300 bg-[#fff8e8] px-4 py-2 text-sm font-bold text-amber-800">
                    {filteredLeaderboard.length} students ranked
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto p-4">
                <table className="pixel-table min-w-170">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Student</th>
                      <th>Section</th>
                      <th>Performance</th>
                      <th>Completed</th>
                      <th>Stars</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeaderboard.map((row) => {
                      const rosterStudent = roster.find((student) => student.id === row.studentId) || null;
                      const performanceBand = rosterStudent ? getPerformanceBandMeta(rosterStudent) : PERFORMANCE_BAND_META.SUPPORT;

                      return (
                        <tr key={row.studentId}>
                          <td>#{row.rank}</td>
                          <td>{row.studentName}</td>
                          <td>{row.section || 'Unassigned'}</td>
                          <td>
                            <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${performanceBand.badgeClass}`}>
                              {performanceBand.label}
                            </span>
                          </td>
                          <td>{row.completedLevels}/{row.totalLevels || 1}</td>
                          <td>{row.totalStars}</td>
                          <td>{row.totalScore}</td>
                        </tr>
                      );
                    })}
                    {filteredLeaderboard.length === 0 && (
                      <tr>
                        <td colSpan={7}>No students available for the current filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'policy' && (
            <div>
              <div className="border-b border-slate-200 p-4">
                <h2 className="text-2xl font-black text-gray-900">Settings</h2>
                <p className="text-sm text-gray-600 mt-1">Profile, security, and student configuration.</p>
              </div>

              <div className="grid border-b border-slate-200 xl:grid-cols-2 xl:divide-x xl:divide-slate-200">
                <div className="pixel-panel-muted space-y-4">
                  <div className="flex items-center gap-2 text-gray-900">
                    <UserRound className="w-5 h-5 text-[#16876d]" />
                    <h3 className="text-xl font-black">Profile Settings</h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold mb-1">First Name</label>
                      <input
                        className="input-field"
                        value={profileForm.firstName}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))}
                        placeholder="Teacher first name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Last Name</label>
                      <input
                        className="input-field"
                        value={profileForm.lastName}
                        onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Teacher last name"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Email Address</label>
                    <input
                      className="input-field"
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="teacher@school.com"
                    />
                  </div>
                  <div className="rounded-xl border border-amber-300 bg-[#fff8e8] px-4 py-3 text-sm text-gray-700">
                    <p className="font-bold text-gray-900">Account identity</p>
                    <p className="mt-1">Username: <span className="font-mono font-bold">{user?.username}</span></p>
                    <p className="mt-1">Role: <span className="font-bold">{user?.role}</span></p>
                    <p className="mt-1">
                      Course Code:{' '}
                      <span className="font-mono font-bold">{isLoadingCourseCode ? 'Loading...' : (teacherCourseCode || '--')}</span>
                    </p>
                  </div>
                  <button className="btn btn-primary" onClick={onSaveProfile} disabled={isSavingProfile}>
                    <Save className="w-4 h-4 mr-2" />
                    {isSavingProfile ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>

                <div className="pixel-panel-muted space-y-4">
                  <div className="flex items-center gap-2 text-gray-900">
                    <ShieldCheck className="w-5 h-5 text-[#16876d]" />
                    <h3 className="text-xl font-black">Security</h3>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Current Password</label>
                    <input
                      className="input-field"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder="Enter current password"
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold mb-1">New Password</label>
                      <input
                        className="input-field"
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                        placeholder="At least 8 characters"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Confirm Password</label>
                      <input
                        className="input-field"
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Repeat new password"
                      />
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
                    Password updates apply to your next sign-in.
                  </div>
                  <button className="btn btn-secondary" onClick={onChangePassword} disabled={isChangingPassword}>
                    <KeyRound className="w-4 h-4 mr-2" />
                    {isChangingPassword ? 'Updating...' : 'Change Password'}
                  </button>
                </div>
              </div>

              <div className="grid xl:grid-cols-2 xl:divide-x xl:divide-slate-200">
                <div className="pixel-panel-muted space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black text-gray-900">Student Policy</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {selectedStudent ? `${getStudentDisplayName(selectedStudent)}` : 'Select a student in Overview to edit policy.'}
                      </p>
                    </div>
                  </div>

                  {!selectedStudent && <p className="text-gray-600">No student selected.</p>}

                  {selectedStudent && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Difficulty Preset</label>
                        <select
                          className="input-field"
                          value={policyForm.difficultyPreset}
                          onChange={(e) => setPolicyForm((prev) => ({ ...prev, difficultyPreset: e.target.value }))}
                        >
                          <option value="EASY">Easy</option>
                          <option value="STANDARD">Standard</option>
                          <option value="HARD">Hard</option>
                        </select>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="block text-sm font-semibold mb-1">Free Mistakes</label>
                          <input
                            className="input-field"
                            type="number"
                            min={1}
                            max={10}
                            value={policyForm.freeMistakes}
                            onChange={(e) => setPolicyForm((prev) => ({ ...prev, freeMistakes: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1">Hint Star Cost</label>
                          <input
                            className="input-field"
                            type="number"
                            min={0}
                            max={3}
                            value={policyForm.hintStarCost}
                            onChange={(e) => setPolicyForm((prev) => ({ ...prev, hintStarCost: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Teacher Notes</label>
                        <textarea
                          className="input-field min-h-28"
                          value={policyForm.notes}
                          onChange={(e) => setPolicyForm((prev) => ({ ...prev, notes: e.target.value }))}
                          placeholder="Add internal notes for this student."
                        />
                      </div>
                      <button className="btn btn-primary" onClick={onSavePolicy}>Save Policy</button>
                    </>
                  )}
                </div>

                <div className="pixel-panel-muted space-y-4">
                  <div className="flex items-center gap-2 text-gray-900">
                    <Flag className="w-5 h-5 text-[#16876d]" />
                    <h3 className="text-xl font-black">Content Requests</h3>
                  </div>
                  {!selectedStudent && <p className="text-gray-600">Select a student before submitting a request.</p>}
                  {selectedStudent && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Level Number (Game 1)</label>
                        <input
                          className="input-field"
                          type="number"
                          min={1}
                          max={20}
                          value={flagForm.levelNumber}
                          onChange={(e) => setFlagForm((prev) => ({ ...prev, levelNumber: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">Reason</label>
                        <textarea
                          className="input-field min-h-24"
                          value={flagForm.reason}
                          onChange={(e) => setFlagForm((prev) => ({ ...prev, reason: e.target.value }))}
                          placeholder="Describe the issue to review."
                        />
                      </div>
                      <button className="btn btn-secondary" onClick={onRequestRegeneration}>Submit Request</button>
                    </>
                  )}

                  <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
                    <h4 className="font-black mb-3">Submitted Requests</h4>
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                      {flags.length === 0 && <p className="text-sm text-gray-500">No requests yet.</p>}
                      {flags.map((flag) => (
                        <div key={flag.id} className="rounded-lg border border-(--ui-border-soft) bg-[#fff8e8] px-3 py-2 text-sm">
                          <p className="font-bold text-gray-900">{getStudentDisplayName(flag.student)} | {getGameTrackLabel(flag.gameType)} Level {flag.levelNumber}</p>
                          <p className="text-xs text-gray-600">Status: {flag.status} | {formatDateTime(flag.requestedAt)}</p>
                          <p className="text-sm mt-1 text-gray-700">{flag.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
};

export default TeacherPage;
